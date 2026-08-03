import type {
  TransactionInsert,
  TransactionRecord,
  TransactionSource,
  TransactionType,
  TransactionUpdate,
  TransactionView,
} from "@/contracts/backend";
import { BackendError, toBackendError } from "@/services/backend/errors";
import {
  addPendingOp,
  getCachedTransactions,
  getCachedTransactionsByYear,
  patchCachedMonth,
  replaceCachedTransaction,
  setCachedTransactions,
} from "@/services/offline/offline-store";
import type {
  PendingCreate,
  PendingDelete,
  PendingUpdate,
} from "@/services/offline/pending-op";

import { supabaseClient } from "./supabase-client";

export type Transaction = TransactionView;
export type { TransactionInsert, TransactionType, TransactionUpdate };
export {
  calcCategoryBreakdown,
  calcDailyTotals,
  calcMonthSummary,
  transactionsForBaseCurrency,
} from "@/features/transactions/analytics";
export type {
  CategoryBreakdown,
  DailyTotal,
  MonthSummary,
} from "@/features/transactions/analytics";

type CreateOptions = {
  idempotencyKey?: string;
  isOnline?: boolean;
  queueOnNetworkFailure?: boolean;
  source?: TransactionSource;
};

type WriteOptions = {
  current?: Transaction;
  expectedRevision?: number | null;
  idempotencyKey?: string;
  isOnline?: boolean;
  queueOnNetworkFailure?: boolean;
  transactionDate?: string;
  userId?: string;
  workspaceId?: string;
};

function transactionsTable() {
  return supabaseClient.from("transactions");
}

function randomToken() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function operationIdentity(operation: "create" | "delete" | "update") {
  const token = randomToken();
  return {
    id: `op_${operation}_${token}`,
    idempotencyKey: `transaction:${operation}:${token}`,
  };
}

function parseDateParts(date: string): [number, number] {
  const [year, month] = date.split("-").map(Number);
  return [year, month];
}

function toSyncedTransaction(row: TransactionRecord): Transaction {
  return { ...row, sync_state: "synced" };
}

function pendingBase(
  operation: "create" | "delete" | "update",
  userId: string,
  identity = operationIdentity(operation),
) {
  const now = Date.now();
  return {
    createdAt: now,
    id: identity.id,
    idempotencyKey: identity.idempotencyKey,
    lastAttemptAt: null,
    lastError: null,
    nextRetryAt: 0,
    retryCount: 0,
    status: "queued" as const,
    updatedAt: now,
    userId,
  };
}

async function mutateTransaction({
  data,
  expectedRevision,
  idempotencyKey,
  operation,
  source = "mobile_app",
  transactionId,
}: {
  data?: TransactionInsert | TransactionUpdate;
  expectedRevision?: number | null;
  idempotencyKey: string;
  operation: "create" | "delete" | "update";
  source?: TransactionSource;
  transactionId?: string | null;
}) {
  const scopedData = data as Partial<TransactionInsert> | undefined;
  const { data: saved, error } = await supabaseClient
    .rpc("mutate_transaction", {
      p_operation: operation,
      p_idempotency_key: idempotencyKey,
      p_transaction_id: transactionId ?? null,
      p_expected_revision: expectedRevision ?? null,
      p_type: data?.type ?? null,
      p_amount: data?.amount ?? null,
      p_note: data?.note ?? null,
      p_category_id: data?.category_id ?? null,
      p_transaction_date: data?.transaction_date ?? null,
      p_source: source,
      p_workspace_id: scopedData?.workspace_id ?? null,
      p_account_id: data?.account_id ?? null,
      p_currency_code: data?.currency_code ?? null,
      p_base_currency_code: scopedData?.base_currency_code ?? null,
      p_exchange_rate: data?.exchange_rate ?? null,
    })
    .single();

  if (error) throw toBackendError(error, "TRANSACTION_WRITE_FAILED");
  return toSyncedTransaction(saved);
}

async function createQueuedTransaction(
  data: TransactionInsert,
  identity: ReturnType<typeof operationIdentity>,
  source: TransactionSource,
) {
  const createdAt = new Date().toISOString();
  const id = `local_${identity.id.slice(3)}`;
  const localTransaction: Transaction = {
    ...data,
    base_amount: Number((data.amount * data.exchange_rate).toFixed(2)),
    created_at: createdAt,
    deleted_at: null,
    id,
    idempotency_key: identity.idempotencyKey,
    lifecycle: "confirmed",
    revision: 1,
    source,
    sync_state: "queued",
    updated_at: createdAt,
  };
  const [year, month] = parseDateParts(data.transaction_date);

  await patchCachedMonth(
    data.user_id,
    data.workspace_id,
    year,
    month,
    (transactions) => [
      ...transactions.filter((transaction) => transaction.id !== id),
      localTransaction,
    ],
  );

  const operation: PendingCreate = {
    ...pendingBase("create", data.user_id, identity),
    opType: "create",
    payload: { data, source, tempId: id },
  };
  await addPendingOp(data.user_id, operation);
  return localTransaction;
}

/** Creates a transaction immediately or durably queues the same mutation. */
export async function createTransaction(
  data: TransactionInsert,
  options: boolean | CreateOptions = true,
): Promise<Transaction> {
  const normalized =
    typeof options === "boolean" ? { isOnline: options } : options;
  const isOnline = normalized.isOnline ?? true;
  const source = normalized.source ?? "mobile_app";
  const generated = operationIdentity("create");
  const identity = {
    ...generated,
    idempotencyKey: normalized.idempotencyKey ?? generated.idempotencyKey,
  };

  if (!isOnline) return createQueuedTransaction(data, identity, source);

  try {
    const saved = await mutateTransaction({
      data,
      idempotencyKey: identity.idempotencyKey,
      operation: "create",
      source,
    });
    const [year, month] = parseDateParts(saved.transaction_date);
    await patchCachedMonth(
      saved.user_id,
      saved.workspace_id,
      year,
      month,
      (transactions) => [
        ...transactions.filter((transaction) => transaction.id !== saved.id),
        saved,
      ],
    );
    return saved;
  } catch (error) {
    const backendError = toBackendError(error, "TRANSACTION_WRITE_FAILED");
    if (
      backendError.code === "NETWORK_UNAVAILABLE" &&
      normalized.queueOnNetworkFailure !== false
    ) {
      return createQueuedTransaction(data, identity, source);
    }
    throw backendError;
  }
}

export async function deleteTransaction(
  id: string,
  options: WriteOptions = {},
): Promise<void> {
  const isOnline = options.isOnline ?? true;
  const generated = operationIdentity("delete");
  const identity = {
    ...generated,
    idempotencyKey: options.idempotencyKey ?? generated.idempotencyKey,
  };
  const userId = options.userId ?? options.current?.user_id;
  const workspaceId = options.workspaceId ?? options.current?.workspace_id;
  const transactionDate =
    options.transactionDate ?? options.current?.transaction_date;
  const expectedRevision =
    options.expectedRevision ?? options.current?.revision ?? null;

  const queueDelete = async () => {
    if (!userId || !workspaceId || !transactionDate) {
      throw new BackendError({
        code: "VALIDATION_FAILED",
        message: "Offline deletion needs the transaction owner and date.",
      });
    }
    const operation: PendingDelete = {
      ...pendingBase("delete", userId, identity),
      opType: "delete",
      payload: {
        expectedRevision,
        transactionDate,
        transactionId: id,
        workspaceId,
      },
    };
    const queue = await addPendingOp(userId, operation);
    const [year, month] = parseDateParts(transactionDate);
    await patchCachedMonth(userId, workspaceId, year, month, (transactions) =>
      id.startsWith("local_") && !queue.some((item) => item.id === operation.id)
        ? transactions.filter((transaction) => transaction.id !== id)
        : transactions.map((transaction) =>
            transaction.id === id
              ? {
                  ...transaction,
                  deleted_at: new Date().toISOString(),
                  lifecycle: "deleted",
                  sync_state: "queued",
                }
              : transaction,
          ),
    );
  };

  if (!isOnline) return queueDelete();

  try {
    const saved = await mutateTransaction({
      expectedRevision,
      idempotencyKey: identity.idempotencyKey,
      operation: "delete",
      transactionId: id,
    });
    if (userId && workspaceId && transactionDate) {
      const [year, month] = parseDateParts(transactionDate);
      await patchCachedMonth(userId, workspaceId, year, month, (transactions) =>
        transactions.filter((transaction) => transaction.id !== saved.id),
      );
    }
  } catch (error) {
    const backendError = toBackendError(error, "TRANSACTION_WRITE_FAILED");
    if (
      backendError.code === "NETWORK_UNAVAILABLE" &&
      options.queueOnNetworkFailure !== false
    ) {
      await queueDelete();
      return;
    }
    throw backendError;
  }
}

export async function updateTransaction(
  id: string,
  data: TransactionUpdate,
  options: boolean | WriteOptions = true,
): Promise<Transaction> {
  const normalized =
    typeof options === "boolean" ? { isOnline: options } : options;
  const isOnline = normalized.isOnline ?? true;
  const generated = operationIdentity("update");
  const identity = {
    ...generated,
    idempotencyKey: normalized.idempotencyKey ?? generated.idempotencyKey,
  };
  const userId = normalized.userId ?? normalized.current?.user_id;
  const workspaceId =
    normalized.workspaceId ?? normalized.current?.workspace_id;
  const transactionDate =
    normalized.transactionDate ?? normalized.current?.transaction_date;
  const expectedRevision =
    normalized.expectedRevision ?? normalized.current?.revision ?? null;

  const queueUpdate = async () => {
    if (!userId || !workspaceId || !transactionDate || !normalized.current) {
      throw new BackendError({
        code: "VALIDATION_FAILED",
        message: "Offline editing needs the current transaction snapshot.",
      });
    }
    const operation: PendingUpdate = {
      ...pendingBase("update", userId, identity),
      opType: "update",
      payload: {
        data,
        expectedRevision,
        transactionDate,
        transactionId: id,
        workspaceId,
      },
    };
    await addPendingOp(userId, operation);
    const updated: Transaction = {
      ...normalized.current,
      ...data,
      sync_error_code: undefined,
      sync_state: "queued",
      updated_at: new Date().toISOString(),
    };
    await replaceCachedTransaction(
      userId,
      workspaceId,
      id,
      transactionDate,
      updated,
    );
    return updated;
  };

  if (!isOnline) return queueUpdate();

  try {
    const saved = await mutateTransaction({
      data,
      expectedRevision,
      idempotencyKey: identity.idempotencyKey,
      operation: "update",
      transactionId: id,
    });
    if (userId && workspaceId && transactionDate) {
      await replaceCachedTransaction(
        userId,
        workspaceId,
        id,
        transactionDate,
        saved,
      );
    }
    return saved;
  } catch (error) {
    const backendError = toBackendError(error, "TRANSACTION_WRITE_FAILED");
    if (
      backendError.code === "NETWORK_UNAVAILABLE" &&
      normalized.queueOnNetworkFailure !== false
    ) {
      return queueUpdate();
    }
    throw backendError;
  }
}

/** Reads a month or year while preserving local work over server snapshots. */
export async function getTransactionsByMonth(
  userId: string,
  workspaceId: string,
  year: number,
  month?: number,
  isOnline = true,
): Promise<Transaction[]> {
  if (!isOnline) {
    return month
      ? ((await getCachedTransactions(userId, workspaceId, year, month)) ?? [])
      : getCachedTransactionsByYear(userId, workspaceId, year);
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
    .eq("workspace_id", workspaceId)
    .neq("lifecycle", "deleted")
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false });

  if (error) {
    const backendError = toBackendError(error, "TRANSACTION_READ_FAILED");
    if (backendError.code === "NETWORK_UNAVAILABLE") {
      const cached = month
        ? await getCachedTransactions(userId, workspaceId, year, month)
        : await getCachedTransactionsByYear(userId, workspaceId, year);
      if (cached !== null) return cached;
    }
    throw backendError;
  }

  const transactions = (data ?? []).map(toSyncedTransaction);
  if (month) {
    await setCachedTransactions(
      userId,
      workspaceId,
      year,
      month,
      transactions,
    );
    return (
      (await getCachedTransactions(userId, workspaceId, year, month)) ??
      transactions
    );
  }

  const months = new Set<number>();
  for (const transaction of transactions) {
    months.add(parseDateParts(transaction.transaction_date)[1]);
  }
  const pending = await getCachedTransactionsByYear(
    userId,
    workspaceId,
    year,
  );
  for (const transaction of pending) {
    if (transaction.sync_state !== "synced") {
      months.add(parseDateParts(transaction.transaction_date)[1]);
    }
  }
  for (const targetMonth of months) {
    await setCachedTransactions(
      userId,
      workspaceId,
      year,
      targetMonth,
      transactions.filter(
        (transaction) =>
          parseDateParts(transaction.transaction_date)[1] === targetMonth,
      ),
    );
  }
  return getCachedTransactionsByYear(userId, workspaceId, year);
}
