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

const TRANSACTIONS_TABLE = process.env.EXPO_PUBLIC_TRANSACTIONS_TABLE || "transactions";

/**
 * Resolve and return the Supabase table reference for the configured transactions table.
 *
 * If the configured table name includes a schema in the form `schema.table`, the returned
 * reference is scoped to that schema; otherwise the raw table name is used.
 *
 * @returns The Supabase table reference for the configured transactions table.
 */
function transactionsTable() {
  // Allow `EXPO_PUBLIC_TRANSACTIONS_TABLE` to be either:
  // - "transactions" (default schema)
  // - "public.transactions" (explicit schema)
  const raw = TRANSACTIONS_TABLE.trim();
  const [maybeSchema, maybeTable] = raw.split(".");
  if (maybeSchema && maybeTable) {
    return supabaseClient.schema(maybeSchema).from(maybeTable);
  }
  return supabaseClient.from(raw);
}

/**
 * Detects whether an error indicates the transactions table or schema is missing.
 *
 * @param error - The thrown value or error object to inspect.
 * @returns `true` if the error represents a missing table/schema (for example a Postgres undefined_table or PostgREST schema-cache miss), `false` otherwise.
 */
function isMissingTransactionsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const anyError = error as any;
  const message = String(anyError?.message ?? "").toLowerCase();
  const code = String(anyError?.code ?? "").toLowerCase();
  return (
    code === "42p01" || // postgres: undefined_table
    code === "pgrst205" || // postgrest: schema cache miss / table not found
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

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
 * Create a new financial transaction, using Supabase when online or performing an optimistic local create and queuing a pending operation when offline.
 *
 * When `isOnline` is true the transaction is inserted into the configured Supabase transactions table and the local month cache is updated with the saved row. When `isOnline` is false an optimistic transaction with a temporary id is added to the local month cache and a "create" pending operation is queued for later synchronization.
 *
 * @param data - Fields for the new transaction (transaction_date must be a local "YYYY-MM-DD" string)
 * @param isOnline - If false, performs an offline optimistic create and enqueues the operation; defaults to true
 * @returns The created `Transaction`; when offline the returned object contains a client-generated `id`, `created_at`, and `tempId` for optimistic UI updates.
export async function createTransaction(
  data: TransactionInsert,
  isOnline = true
): Promise<Transaction> {
  if (isOnline) {
    const { data: result, error } = await transactionsTable()
      .insert([{
        user_id: data.user_id,
        type: data.type,
        amount: data.amount,
        note: data.note,
        category_id: data.category_id,
        transaction_date: data.transaction_date,
    }])
      .select();

    if (error) {
      // Degrade gracefully if Supabase schema isn't set up yet.
      if (isMissingTransactionsTableError(error)) {
        return createTransaction(data, false);
      }
      throw error;
    }

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
  return { ...localTx, tempId: tid } as any; // Cast for TS compatibility with optimistic updates
}

/**
 * Delete a transaction remotely when online or queue a pending delete and update the local cache immediately when offline.
 *
 * @param id - The transaction's identifier to delete
 * @param opts - Optional controls and cache hints
 * @param opts.userId - When provided with `date`, identifies the user whose cached month should be patched
 * @param opts.date - Local transaction date in `YYYY-MM-DD` format used to determine the cached month to update
 * @param opts.isOnline - If `false`, the delete is queued as a pending operation instead of sent to the remote table
 */
export async function deleteTransaction(
  id: string,
  opts?: { userId?: string; date?: string; isOnline?: boolean }
): Promise<void> {
  const isOnline = opts?.isOnline ?? true;

  if (isOnline) {
    const { error } = await transactionsTable()
      .delete()
      .eq("id", id);
    if (error) throw error;
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
 * Update an existing transaction record.
 *
 * When online, performs the update against the transactions table and returns the saved row.
 * When offline, queues a pending "update" operation and returns a stub transaction combining `id` with `data`.
 *
 * @param id - The transaction identifier to update
 * @param data - Partial transaction fields to apply
 * @param isOnline - If `true`, attempt an online update; if `false`, queue the change for later
 * @returns The updated `Transaction` from the database, or a stub `{ id, ...data }` when queued offline
 * @throws The Supabase/postgrest error object if the online update fails
 */
export async function updateTransaction(
  id: string,
  data: Partial<TransactionInsert>,
  isOnline = true
): Promise<Transaction> {
  if (isOnline) {
    const { data: result, error } = await transactionsTable()
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
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
 * Fetches transactions for a user for the specified month or for the whole year.
 *
 * When online, queries the transactions table and, if a month is specified, updates the local cache for that month.
 * When offline, returns cached month data if `month` is provided, otherwise returns an empty array.
 *
 * @param month - Month number (1-12). Omit to fetch the entire year.
 * @param isOnline - If `false`, returns cached data where available instead of querying the network.
 * @returns An array of transactions covering the requested month or year (may be empty).
 */
export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month?: number, // 1-12, optional for whole year
  isOnline: boolean = true
): Promise<Transaction[]> {
  if (!isOnline) {
    // If offline and month is specified, try to get cached data for that month
    if (month) {
      const cached = await getCachedTransactions(userId, year, month);
      return cached ?? [];
    }
    // If offline and no month specified (whole year), we don't have a direct cache key for the whole year
    // For now, we'll return an empty array or could implement a more complex cache retrieval for the year.
    // For simplicity, returning empty array if no month is specified and offline.
    return [];
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const start = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
  const lastDay = month ? new Date(year, month, 0).getDate() : 31;
  const end = month ? `${year}-${pad(month)}-${pad(lastDay)}` : `${year}-12-31`;

  const { data, error } = await transactionsTable()
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false });

  if (error) {
    // Network error even though isOnline was true — fall back to cache
    if (month) {
      const cached = await getCachedTransactions(userId, year, month);
      return cached ?? [];
    }
    return [];
  }

  const txs = (data ?? []) as Transaction[];
  if (month) {
    await setCachedTransactions(userId, year, month, txs);
  }
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
