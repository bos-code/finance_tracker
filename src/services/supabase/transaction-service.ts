import { supabaseClient } from "./supabase-client";
import {
  getCachedTransactions,
  setCachedTransactions,
  addPendingOp,
  patchCachedMonth,
} from "@/services/offline/offline-store";
import type { PendingCreate, PendingDelete, PendingUpdate } from "@/services/offline/pending-op";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionType = "Expenditure" | "Revenue";

export type TransactionInsert = {
  user_id: string;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  /**
   * Local calendar date in "YYYY-MM-DD" format.
   * Do NOT pass `Date.toISOString()` here — that converts to UTC and will
   * shift the date by a day for users in negative UTC offsets.
   * Use `toLocalDateString(date)` from `@/utils/date` instead.
   */
  transaction_date: string;
};

export type Transaction = TransactionInsert & {
  id: string;
  created_at: string;
};

export type MonthSummary = {
  totalRevenue: number;
  totalExpenditure: number;
  remaining: number;
};

export type DailyTotal = {
  date: string; // "YYYY-MM-DD"
  revenue: number;
  expenditure: number;
};

export type CategoryBreakdown = {
  category_id: string;
  total: number;
  percentage: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a temporary local ID (not a valid Supabase UUID) */
function tempId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseDateParts(dateStr: string): [number, number] {
  const [y, m] = dateStr.split("-").map(Number);
  return [y, m];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Creates a new financial transaction.
 *
 * Online  → writes directly to Supabase, then patches the local cache.
 * Offline → generates a temp ID, inserts the record into the local cache
 *           immediately (so UI updates right away), and queues a "create"
 *           op for when connectivity is restored.
 */
export async function createTransaction(
  data: TransactionInsert,
  isOnline = true
): Promise<Transaction> {
  if (isOnline) {
    const { data: result, error } = await supabaseClient
      .from("transactions")
      .insert([{
        user_id: data.user_id,
        type: data.type,
        amount: data.amount,
        note: data.note,
        category_id: data.category_id,
        transaction_date: data.transaction_date,
      }])
      .select();

    if (error) throw new Error(error.message);

    const saved = result?.[0] as Transaction;
    // Warm the cache with the real record
    const [year, month] = parseDateParts(saved.transaction_date);
    await patchCachedMonth(saved.user_id, year, month, (txs) => [...txs, saved]);
    return saved;
  }

  // --- Offline path ---
  const tid = tempId();
  const localTx: Transaction = {
    ...data,
    id: tid,
    created_at: new Date().toISOString(),
  };
  const [year, month] = parseDateParts(data.transaction_date);
  // Insert into local cache immediately so screens see the new record
  await patchCachedMonth(data.user_id, year, month, (txs) => [...txs, localTx]);

  const op: PendingCreate = {
    id: tid,
    opType: "create",
    payload: { ...data, tempId: tid },
    createdAt: Date.now(),
  };
  await addPendingOp(op);
  return localTx;
}

/**
 * Deletes a transaction by ID.
 * Offline → queues a "delete" op + removes from local cache immediately.
 */
export async function deleteTransaction(
  id: string,
  opts?: { userId?: string; date?: string; isOnline?: boolean }
): Promise<void> {
  const isOnline = opts?.isOnline ?? true;

  if (isOnline) {
    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const op: PendingDelete = {
      id: `del_${id}`,
      opType: "delete",
      payload: { transactionId: id },
      createdAt: Date.now(),
    };
    await addPendingOp(op);
  }

  // Always update local cache if we have enough info
  if (opts?.userId && opts?.date) {
    const [year, month] = parseDateParts(opts.date);
    await patchCachedMonth(opts.userId, year, month, (txs) =>
      txs.filter((t) => t.id !== id)
    );
  }
}

/**
 * Updates an existing transaction.
 * Offline → queues an "update" op.
 */
export async function updateTransaction(
  id: string,
  data: Partial<TransactionInsert>,
  isOnline = true
): Promise<Transaction> {
  if (isOnline) {
    const { data: result, error } = await supabaseClient
      .from("transactions")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw new Error(error.message);
    return result?.[0] as Transaction;
  }

  // Offline: queue and patch cache
  const op: PendingUpdate = {
    id: `upd_${id}`,
    opType: "update",
    payload: { transactionId: id, data },
    createdAt: Date.now(),
  };
  await addPendingOp(op);
  // Return a stub — the screen should refetch when online
  return { id, ...data } as Transaction;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Fetches all transactions for a user within a given month.
 *
 * Online  → fetches from Supabase and updates the local cache.
 * Offline → returns the local cache (may be stale from a previous fetch).
 *
 * Uses local "YYYY-MM-DD" date strings for range filtering — avoids UTC
 * shift errors that occur when comparing against toISOString() timestamps.
 */
export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number, // 1-12
  isOnline = true
): Promise<Transaction[]> {
  if (!isOnline) {
    const cached = await getCachedTransactions(userId, year, month);
    return cached ?? [];
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: true });

  if (error) {
    // Network error even though isOnline was true — fall back to cache
    const cached = await getCachedTransactions(userId, year, month);
    return cached ?? [];
  }

  const txs = (data ?? []) as Transaction[];
  await setCachedTransactions(userId, year, month, txs);
  return txs;
}

// ─── Pure analytics (unchanged) ───────────────────────────────────────────────

export function calcMonthSummary(transactions: Transaction[]): MonthSummary {
  let totalRevenue = 0;
  let totalExpenditure = 0;

  for (const tx of transactions) {
    if (tx.type === "Revenue") {
      totalRevenue += tx.amount;
    } else {
      totalExpenditure += tx.amount;
    }
  }

  return { totalRevenue, totalExpenditure, remaining: totalRevenue - totalExpenditure };
}

export function calcDailyTotals(transactions: Transaction[]): Record<string, DailyTotal> {
  const map: Record<string, DailyTotal> = {};

  for (const tx of transactions) {
    const dateKey = tx.transaction_date.slice(0, 10);
    if (!map[dateKey]) {
      map[dateKey] = { date: dateKey, revenue: 0, expenditure: 0 };
    }
    if (tx.type === "Revenue") {
      map[dateKey].revenue += tx.amount;
    } else {
      map[dateKey].expenditure += tx.amount;
    }
  }

  return map;
}

export function calcCategoryBreakdown(
  transactions: Transaction[],
  type: TransactionType = "Expenditure"
): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    map[tx.category_id] = (map[tx.category_id] || 0) + tx.amount;
    total += tx.amount;
  }

  return Object.entries(map)
    .map(([category_id, amount]) => ({
      category_id,
      total: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
