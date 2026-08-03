import type {
  TransactionInsert,
  TransactionRecord,
  TransactionType,
  TransactionUpdate,
} from "@/contracts/backend";
import {
  addPendingOp,
  getCachedTransactions,
  patchCachedMonth,
  setCachedTransactions,
} from "@/services/offline/offline-store";
import type {
  PendingCreate,
  PendingDelete,
  PendingUpdate,
} from "@/services/offline/pending-op";
import { toBackendError } from "@/services/backend/errors";
import { supabaseClient } from "./supabase-client";

export type Transaction = TransactionRecord;
export type { TransactionInsert, TransactionType, TransactionUpdate };
export {
  calcCategoryBreakdown,
  calcDailyTotals,
  calcMonthSummary,
} from "@/features/transactions/analytics";
export type {
  CategoryBreakdown,
  DailyTotal,
  MonthSummary,
} from "@/features/transactions/analytics";

function transactionsTable() {
  return supabaseClient.from("transactions");
}

function tempId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseDateParts(date: string): [number, number] {
  const [year, month] = date.split("-").map(Number);
  return [year, month];
}

/**
 * Creates a financial transaction online or records an immediate local entry
 * and durable pending operation while offline.
 */
export async function createTransaction(
  data: TransactionInsert,
  isOnline = true,
): Promise<Transaction> {
  if (isOnline) {
    const { data: saved, error } = await transactionsTable()
      .insert(data)
      .select()
      .single();

    if (error) throw toBackendError(error, "TRANSACTION_WRITE_FAILED");

    const [year, month] = parseDateParts(saved.transaction_date);
    await patchCachedMonth(saved.user_id, year, month, (transactions) => [
      ...transactions.filter((transaction) => transaction.id !== saved.id),
      saved,
    ]);
    return saved;
  }

  const id = tempId();
  const createdAt = new Date().toISOString();
  const localTransaction: Transaction = {
    ...data,
    created_at: createdAt,
    id,
    updated_at: createdAt,
  };
  const [year, month] = parseDateParts(data.transaction_date);

  await patchCachedMonth(data.user_id, year, month, (transactions) => [
    ...transactions.filter((transaction) => transaction.id !== id),
    localTransaction,
  ]);

  const operation: PendingCreate = {
    createdAt: Date.now(),
    id,
    opType: "create",
    payload: { ...data, tempId: id },
  };
  await addPendingOp(operation);
  return localTransaction;
}

export async function deleteTransaction(
  id: string,
  options?: { userId?: string; date?: string; isOnline?: boolean },
): Promise<void> {
  const isOnline = options?.isOnline ?? true;

  if (isOnline) {
    const { error } = await transactionsTable().delete().eq("id", id);
    if (error) throw toBackendError(error, "TRANSACTION_WRITE_FAILED");
  } else {
    const operation: PendingDelete = {
      createdAt: Date.now(),
      id: `del_${id}`,
      opType: "delete",
      payload: { transactionId: id },
    };
    await addPendingOp(operation);
  }

  if (options?.userId && options.date) {
    const [year, month] = parseDateParts(options.date);
    await patchCachedMonth(options.userId, year, month, (transactions) =>
      transactions.filter((transaction) => transaction.id !== id),
    );
  }
}

export async function updateTransaction(
  id: string,
  data: TransactionUpdate,
  isOnline = true,
): Promise<Transaction> {
  if (isOnline) {
    const { data: saved, error } = await transactionsTable()
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (error) throw toBackendError(error, "TRANSACTION_WRITE_FAILED");
    return saved;
  }

  const operation: PendingUpdate = {
    createdAt: Date.now(),
    id: `upd_${id}`,
    opType: "update",
    payload: { data, transactionId: id },
  };
  await addPendingOp(operation);
  return { id, ...data } as Transaction;
}

/**
 * Reads one month or year. A provider/schema error is never converted into an
 * empty data set. Only a true network failure may fall back to an existing
 * monthly cache.
 */
export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month?: number,
  isOnline = true,
): Promise<Transaction[]> {
  if (!isOnline) {
    if (!month) return [];
    return (await getCachedTransactions(userId, year, month)) ?? [];
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const start = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
  const lastDay = month ? new Date(year, month, 0).getDate() : 31;
  const end = month
    ? `${year}-${pad(month)}-${pad(lastDay)}`
    : `${year}-12-31`;

  const { data, error } = await transactionsTable()
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false });

  if (error) {
    const backendError = toBackendError(error, "TRANSACTION_READ_FAILED");
    if (backendError.code === "NETWORK_UNAVAILABLE" && month) {
      const cached = await getCachedTransactions(userId, year, month);
      if (cached !== null) return cached;
    }
    throw backendError;
  }

  const transactions = data ?? [];
  if (month) {
    await setCachedTransactions(userId, year, month, transactions);
  }
  return transactions;
}
