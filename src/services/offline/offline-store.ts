import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Transaction } from "@/services/supabase/transaction-service";
import type { PendingOp } from "./pending-op";

// ─── Key factories ────────────────────────────────────────────────────────────

const txCacheKey = (userId: string, year: number, month: number) =>
  `@offline_txcache_${userId}_${year}_${month}`;

const PENDING_OPS_KEY = "@offline_pending_ops";

// ─── Transaction cache ────────────────────────────────────────────────────────

/**
 * Saves a fresh list of transactions to the local cache.
 * Called after every successful network fetch to keep the cache warm.
 */
export async function setCachedTransactions(
  userId: string,
  year: number,
  month: number,
  transactions: Transaction[]
): Promise<void> {
  await AsyncStorage.setItem(
    txCacheKey(userId, year, month),
    JSON.stringify(transactions)
  );
}

/**
 * Returns the locally cached transactions for a month, or null if the
 * cache is empty / expired. Never throws — returns null on error.
 */
export async function getCachedTransactions(
  userId: string,
  year: number,
  month: number
): Promise<Transaction[] | null> {
  try {
    const raw = await AsyncStorage.getItem(txCacheKey(userId, year, month));
    if (!raw) return null;
    return JSON.parse(raw) as Transaction[];
  } catch {
    return null;
  }
}

/**
 * After a pending "create" is synced and Supabase returns the real record,
 * or after a "delete" is confirmed, we patch the cached month so reads
 * reflect the true server state without needing a full re-fetch.
 */
export async function patchCachedMonth(
  userId: string,
  year: number,
  month: number,
  patchFn: (txs: Transaction[]) => Transaction[]
): Promise<void> {
  const current = await getCachedTransactions(userId, year, month) ?? [];
  await setCachedTransactions(userId, year, month, patchFn(current));
}

// ─── Pending operations queue ─────────────────────────────────────────────────

export async function getPendingOps(): Promise<PendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingOp[];
  } catch {
    return [];
  }
}

export async function addPendingOp(op: PendingOp): Promise<void> {
  const ops = await getPendingOps();
  ops.push(op);
  await AsyncStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
}

export async function removePendingOp(opId: string): Promise<void> {
  const ops = await getPendingOps();
  const filtered = ops.filter((o) => o.id !== opId);
  await AsyncStorage.setItem(PENDING_OPS_KEY, JSON.stringify(filtered));
}

export async function clearAllPendingOps(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_OPS_KEY);
}
