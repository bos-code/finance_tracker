import type {
  BackendErrorCode,
  SyncState,
  TransactionInsert,
  TransactionSource,
  TransactionUpdate,
} from "@/contracts/backend";

export type PendingOperationStatus = Extract<
  SyncState,
  "queued" | "syncing" | "failed" | "conflict"
>;

export type PendingOperationError = {
  at: number;
  code: BackendErrorCode;
  message: string;
};

type PendingOperationBase = {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: PendingOperationStatus;
  retryCount: number;
  nextRetryAt: number;
  lastAttemptAt: number | null;
  lastError: PendingOperationError | null;
  createdAt: number;
  updatedAt: number;
};

export type PendingCreate = PendingOperationBase & {
  opType: "create";
  payload: {
    data: TransactionInsert;
    source: TransactionSource;
    tempId: string;
  };
};

export type PendingUpdate = PendingOperationBase & {
  opType: "update";
  payload: {
    data: TransactionUpdate;
    expectedRevision: number | null;
    transactionDate: string;
    transactionId: string;
    workspaceId: string;
  };
};

export type PendingDelete = PendingOperationBase & {
  opType: "delete";
  payload: {
    expectedRevision: number | null;
    transactionDate: string;
    transactionId: string;
    workspaceId: string;
  };
};

export type PendingOp = PendingCreate | PendingUpdate | PendingDelete;

export type TransactionQueueScope = {
  accountId: string;
  currencyCode: string;
  workspaceId: string;
};

/** Adds Stage 3 scope to durable Stage 2 operations without changing identity. */
export function applyTransactionQueueScope(
  operation: PendingOp,
  scope: TransactionQueueScope,
): PendingOp {
  if (operation.opType === "create") {
    const currencyCode =
      operation.payload.data.currency_code || scope.currencyCode;
    const baseCurrencyCode =
      operation.payload.data.base_currency_code || scope.currencyCode;
    return {
      ...operation,
      payload: {
        ...operation.payload,
        data: {
          ...operation.payload.data,
          account_id: operation.payload.data.account_id || scope.accountId,
          base_currency_code: baseCurrencyCode,
          currency_code: currencyCode,
          exchange_rate:
            operation.payload.data.exchange_rate ||
            (currencyCode === baseCurrencyCode ? 1 : 0),
          workspace_id:
            operation.payload.data.workspace_id || scope.workspaceId,
        },
      },
    };
  }

  if (operation.opType === "update") {
    return {
      ...operation,
      payload: {
        ...operation.payload,
        workspaceId: operation.payload.workspaceId || scope.workspaceId,
      },
    };
  }

  return {
    ...operation,
    payload: {
      ...operation.payload,
      workspaceId: operation.payload.workspaceId || scope.workspaceId,
    },
  };
}

function referencesTransaction(operation: PendingOp, transactionId: string) {
  if (operation.opType === "create") {
    return operation.payload.tempId === transactionId;
  }
  return operation.payload.transactionId === transactionId;
}

/**
 * Adds an operation while collapsing work that has not reached the server.
 * A local create followed by edits stays one create; a local create followed
 * by delete disappears completely.
 */
export function enqueuePendingOperation(
  current: PendingOp[],
  next: PendingOp,
): PendingOp[] {
  if (current.some((operation) => operation.id === next.id)) return current;

  if (next.opType === "update") {
    const createIndex = current.findIndex(
      (operation) =>
        operation.opType === "create" &&
        operation.payload.tempId === next.payload.transactionId &&
        operation.status !== "syncing",
    );
    if (createIndex >= 0) {
      return current.map((operation, index) =>
        index === createIndex && operation.opType === "create"
          ? {
              ...operation,
              payload: {
                ...operation.payload,
                data: { ...operation.payload.data, ...next.payload.data },
              },
              updatedAt: next.updatedAt,
            }
          : operation,
      );
    }

    const previousUpdateIndex = current.findIndex(
      (operation) =>
        operation.opType === "update" &&
        operation.payload.transactionId === next.payload.transactionId &&
        operation.status !== "syncing",
    );
    if (previousUpdateIndex >= 0) {
      return current.map((operation, index) =>
        index === previousUpdateIndex && operation.opType === "update"
          ? {
              ...operation,
              idempotencyKey: next.idempotencyKey,
              payload: {
                ...next.payload,
                data: { ...operation.payload.data, ...next.payload.data },
              },
              status: "queued",
              retryCount: 0,
              nextRetryAt: 0,
              lastAttemptAt: null,
              lastError: null,
              updatedAt: next.updatedAt,
            }
          : operation,
      );
    }
  }

  if (next.opType === "delete") {
    const pendingCreate = current.find(
      (operation) =>
        operation.opType === "create" &&
        operation.payload.tempId === next.payload.transactionId,
    );
    if (pendingCreate && pendingCreate.status !== "syncing") {
      return current.filter(
        (operation) =>
          !referencesTransaction(operation, next.payload.transactionId),
      );
    }

    const withoutSupersededWork = current.filter(
      (operation) =>
        !(
          operation.status !== "syncing" &&
          operation.opType === "update" &&
          operation.payload.transactionId === next.payload.transactionId
        ) &&
        !(
          operation.status !== "syncing" &&
          operation.opType === "delete" &&
          operation.payload.transactionId === next.payload.transactionId
        ),
    );
    return [...withoutSupersededWork, next];
  }

  return [...current, next].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

export function remapPendingTransactionId(
  operations: PendingOp[],
  temporaryId: string,
  serverId: string,
): PendingOp[] {
  return operations.map((operation) => {
    if (operation.opType === "create") {
      return operation;
    }
    if (operation.payload.transactionId !== temporaryId) return operation;

    if (operation.opType === "update") {
      return {
        ...operation,
        payload: { ...operation.payload, transactionId: serverId },
      };
    }

    return {
      ...operation,
      payload: { ...operation.payload, transactionId: serverId },
    };
  });
}

export function nextRetryTime(retryCount: number, now: number) {
  const baseDelay = 2_000;
  const maximumDelay = 5 * 60_000;
  return (
    now +
    Math.min(baseDelay * 2 ** Math.max(0, retryCount - 1), maximumDelay)
  );
}

export function isOperationDue(
  operation: PendingOp,
  now: number,
  force = false,
) {
  if (operation.status === "conflict") return false;
  return force || operation.nextRetryAt <= now;
}
