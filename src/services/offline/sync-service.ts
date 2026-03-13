import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/services/supabase/transaction-service";
import {
  getPendingOps,
  removePendingOp,
  patchCachedMonth,
} from "./offline-store";
import type { PendingOp } from "./pending-op";

/**
 * Processes the pending operation queue in order (FIFO).
 * Each op is attempted once; on success it is dequeued and the local cache
 * is updated. On failure the op stays for the next sync attempt.
 *
 * Returns { synced, failed } counts.
 */
export async function syncPendingOps(): Promise<{ synced: number; failed: number }> {
  const ops = await getPendingOps();
  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      await executeOp(op);
      await removePendingOp(op.id);
      synced++;
    } catch (err) {
      console.warn(`[sync] op ${op.id} (${op.opType}) failed:`, err);
      failed++;
      // Continue — do not block other ops because one failed
    }
  }

  return { synced, failed };
}

async function executeOp(op: PendingOp): Promise<void> {
  if (op.opType === "create") {
    const { tempId, ...insertData } = op.payload;

    // Create on server — returns the real transaction with Supabase id
    const saved = await createTransaction(insertData);

    // Parse year/month from the stored local date string
    const [year, month] = saved.transaction_date.split("-").map(Number);

    // Swap the temp record out for the real one in the local cache
    await patchCachedMonth(saved.user_id, year, month, (txs) => {
      const without = txs.filter((t) => t.id !== tempId);
      return [...without, saved];
    });
    return;
  }

  if (op.opType === "delete") {
    await deleteTransaction(op.payload.transactionId);
    return;
  }

  if (op.opType === "update") {
    await updateTransaction(op.payload.transactionId, op.payload.data);
    return;
  }
}
