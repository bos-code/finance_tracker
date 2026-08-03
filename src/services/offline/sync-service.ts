import { isOperationDue, nextRetryTime } from "@/features/transactions/offline-queue";
import { toBackendError } from "@/services/backend/errors";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/services/supabase/transaction-service";

import {
  getPendingOps,
  remapPendingTransaction,
  removePendingOp,
  replaceCachedTransaction,
  setCachedTransactionSyncState,
  updatePendingOp,
} from "./offline-store";
import type { PendingOp } from "./pending-op";

export type SyncResult = {
  conflicts: number;
  failed: number;
  remaining: number;
  synced: number;
};

const activeSyncs = new Map<string, Promise<SyncResult>>();

async function markCacheState(
  operation: PendingOp,
  state: "conflict" | "failed" | "syncing",
  errorCode?: ReturnType<typeof toBackendError>["code"],
) {
  const transactionId =
    operation.opType === "create"
      ? operation.payload.tempId
      : operation.payload.transactionId;
  const transactionDate =
    operation.opType === "create"
      ? operation.payload.data.transaction_date
      : operation.payload.transactionDate;
  const workspaceId =
    operation.opType === "create"
      ? operation.payload.data.workspace_id
      : operation.payload.workspaceId;
  if (!transactionDate || !workspaceId) return;
  await setCachedTransactionSyncState(
    operation.userId,
    workspaceId,
    transactionDate,
    transactionId,
    state,
    errorCode,
  );
}

async function executeOperation(operation: PendingOp) {
  if (operation.opType === "create") {
    const saved = await createTransaction(operation.payload.data, {
      idempotencyKey: operation.idempotencyKey,
      isOnline: true,
      queueOnNetworkFailure: false,
      source: operation.payload.source,
    });

    await remapPendingTransaction(
      operation.userId,
      operation.payload.tempId,
      saved.id,
    );
    await replaceCachedTransaction(
      operation.userId,
      saved.workspace_id,
      operation.payload.tempId,
      operation.payload.data.transaction_date,
      saved,
    );
    return;
  }

  if (operation.opType === "delete") {
    await deleteTransaction(operation.payload.transactionId, {
      expectedRevision: operation.payload.expectedRevision,
      idempotencyKey: operation.idempotencyKey,
      isOnline: true,
      queueOnNetworkFailure: false,
      transactionDate: operation.payload.transactionDate,
      userId: operation.userId,
      workspaceId: operation.payload.workspaceId,
    });
    return;
  }

  await updateTransaction(
    operation.payload.transactionId,
    operation.payload.data,
    {
      expectedRevision: operation.payload.expectedRevision,
      idempotencyKey: operation.idempotencyKey,
      isOnline: true,
      queueOnNetworkFailure: false,
      transactionDate: operation.payload.transactionDate,
      userId: operation.userId,
      workspaceId: operation.payload.workspaceId,
    },
  );
}

async function runSync(userId: string, force: boolean): Promise<SyncResult> {
  const initial = await getPendingOps(userId);
  const candidateIds = initial
    .filter((operation) => isOperationDue(operation, Date.now(), force))
    .map((operation) => operation.id);
  let conflicts = 0;
  let failed = 0;
  let synced = 0;

  for (const operationId of candidateIds) {
    const operation = (await getPendingOps(userId)).find(
      (candidate) => candidate.id === operationId,
    );
    if (!operation || !isOperationDue(operation, Date.now(), force)) continue;

    const attemptedAt = Date.now();
    await updatePendingOp(userId, operation.id, (current) => ({
      ...current,
      lastAttemptAt: attemptedAt,
      status: "syncing",
      updatedAt: attemptedAt,
    }));
    await markCacheState(operation, "syncing");

    try {
      await executeOperation(operation);
      await removePendingOp(userId, operation.id);
      synced += 1;
    } catch (error) {
      const backendError = toBackendError(error, "TRANSACTION_WRITE_FAILED");
      const retryCount = operation.retryCount + 1;
      const status = backendError.code === "CONFLICT" ? "conflict" : "failed";
      const failedAt = Date.now();
      const nextRetryAt = backendError.retryable
        ? nextRetryTime(retryCount, failedAt)
        : Number.MAX_SAFE_INTEGER;

      await updatePendingOp(userId, operation.id, (current) => ({
        ...current,
        lastError: {
          at: failedAt,
          code: backendError.code,
          message: backendError.message,
        },
        nextRetryAt,
        retryCount,
        status,
        updatedAt: failedAt,
      }));
      await markCacheState(operation, status, backendError.code);
      if (status === "conflict") conflicts += 1;
      else failed += 1;
    }
  }

  return {
    conflicts,
    failed,
    remaining: (await getPendingOps(userId)).length,
    synced,
  };
}

/** Drains due operations once. Calls for the same user share one sync flight. */
export function syncPendingOps(userId: string, force = false) {
  const active = activeSyncs.get(userId);
  if (active) return active;

  const sync = runSync(userId, force).finally(() => {
    if (activeSyncs.get(userId) === sync) activeSyncs.delete(userId);
  });
  activeSyncs.set(userId, sync);
  return sync;
}

export async function retryFailedOps(userId: string) {
  const operations = await getPendingOps(userId);
  for (const operation of operations) {
    if (operation.status !== "failed") continue;
    await updatePendingOp(userId, operation.id, (current) => ({
      ...current,
      lastError: null,
      nextRetryAt: 0,
      status: "queued",
      updatedAt: Date.now(),
    }));
  }
  return syncPendingOps(userId, true);
}
