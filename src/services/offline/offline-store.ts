import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  BackendErrorCode,
  TransactionRecord,
  TransactionView,
} from "@/contracts/backend";
import {
  enqueuePendingOperation,
  remapPendingTransactionId,
  type PendingOp,
} from "@/features/transactions/offline-queue";

const STORAGE_VERSION = "v2";
const CACHE_PREFIX = `@finance-tracker/offline/${STORAGE_VERSION}/transactions`;
const QUEUE_PREFIX = `@finance-tracker/offline/${STORAGE_VERSION}/pending`;
const LEGACY_PENDING_OPS_KEY = "@offline_pending_ops";
const LEGACY_MIGRATION_PREFIX =
  `@finance-tracker/offline/${STORAGE_VERSION}/legacy-migrated`;

const locks = new Map<string, Promise<void>>();

function txCacheKey(userId: string, year: number, month: number) {
  return `${CACHE_PREFIX}/${userId}/${year}/${month}`;
}

function pendingOpsKey(userId: string) {
  return `${QUEUE_PREFIX}/${userId}`;
}

async function withKeyLock<T>(key: string, task: () => Promise<T>) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  locks.set(key, tail);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function objectValue(value: unknown): Record<string, any> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, any>)
    : null;
}

function normalizeTransaction(value: unknown): TransactionView | null {
  const row = objectValue(value);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    (row.type !== "Expenditure" && row.type !== "Revenue") ||
    typeof row.amount !== "number" ||
    typeof row.transaction_date !== "string"
  ) {
    return null;
  }

  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : new Date(0).toISOString();
  const isLocal = row.id.startsWith("local_") || row.id.startsWith("opt_");
  const syncState = [
    "local_only",
    "queued",
    "syncing",
    "synced",
    "failed",
    "conflict",
  ].includes(row.sync_state)
    ? row.sync_state
    : isLocal
      ? "queued"
      : "synced";

  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    amount: row.amount,
    note: typeof row.note === "string" ? row.note : "",
    category_id:
      typeof row.category_id === "string" ? row.category_id : "other",
    transaction_date: row.transaction_date,
    idempotency_key:
      typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    lifecycle: [
      "draft",
      "pending_confirmation",
      "confirmed",
      "needs_review",
      "reversed",
      "deleted",
    ].includes(row.lifecycle)
      ? row.lifecycle
      : "confirmed",
    source: [
      "mobile_app",
      "telegram",
      "whatsapp",
      "web_dashboard",
      "import",
      "system",
    ].includes(row.source)
      ? row.source
      : "mobile_app",
    revision:
      typeof row.revision === "number" && row.revision > 0
        ? row.revision
        : 1,
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    created_at: createdAt,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : createdAt,
    sync_state: syncState,
    ...(typeof row.sync_error_code === "string"
      ? { sync_error_code: row.sync_error_code as BackendErrorCode }
      : {}),
  };
}

function dedupeTransactions(values: unknown[]): TransactionView[] {
  const byId = new Map<string, TransactionView>();
  for (const value of values) {
    const transaction = normalizeTransaction(value);
    if (transaction) byId.set(transaction.id, transaction);
  }
  return [...byId.values()].sort((left, right) =>
    `${right.transaction_date}-${right.created_at}`.localeCompare(
      `${left.transaction_date}-${left.created_at}`,
    ),
  );
}

async function readCachedMonthRaw(
  userId: string,
  year: number,
  month: number,
) {
  const raw = await AsyncStorage.getItem(txCacheKey(userId, year, month));
  return dedupeTransactions(parseJsonArray(raw));
}

async function writeCachedMonthRaw(
  userId: string,
  year: number,
  month: number,
  transactions: TransactionView[],
) {
  await AsyncStorage.setItem(
    txCacheKey(userId, year, month),
    JSON.stringify(dedupeTransactions(transactions)),
  );
}

function visibleTransactions(transactions: TransactionView[]) {
  return transactions.filter(
    (transaction) =>
      transaction.lifecycle !== "deleted" ||
      transaction.sync_state === "failed" ||
      transaction.sync_state === "conflict",
  );
}

/** Stores a server snapshot without overwriting queued local changes. */
export async function setCachedTransactions(
  userId: string,
  year: number,
  month: number,
  transactions: TransactionView[],
): Promise<void> {
  const key = txCacheKey(userId, year, month);
  await withKeyLock(key, async () => {
    const current = await readCachedMonthRaw(userId, year, month);
    const pending = current.filter(
      (transaction) => transaction.sync_state !== "synced",
    );
    const merged = new Map<string, TransactionView>(
      transactions.map((transaction) => [
        transaction.id,
        { ...transaction, sync_state: "synced" as const },
      ]),
    );
    for (const transaction of pending) merged.set(transaction.id, transaction);
    await writeCachedMonthRaw(userId, year, month, [...merged.values()]);
  });
}

export async function getCachedTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<TransactionView[] | null> {
  try {
    const key = txCacheKey(userId, year, month);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return visibleTransactions(dedupeTransactions(parseJsonArray(raw)));
  } catch {
    return null;
  }
}

export async function getCachedTransactionsByYear(
  userId: string,
  year: number,
) {
  try {
    const prefix = `${CACHE_PREFIX}/${userId}/${year}/`;
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(prefix),
    );
    const rows = await AsyncStorage.multiGet(keys);
    return visibleTransactions(
      dedupeTransactions(
        rows.flatMap(([, raw]) => parseJsonArray(raw)),
      ),
    );
  } catch {
    return [];
  }
}

export async function patchCachedMonth(
  userId: string,
  year: number,
  month: number,
  patch: (transactions: TransactionView[]) => TransactionView[],
): Promise<void> {
  const key = txCacheKey(userId, year, month);
  await withKeyLock(key, async () => {
    const current = await readCachedMonthRaw(userId, year, month);
    await writeCachedMonthRaw(userId, year, month, patch(current));
  });
}

export async function replaceCachedTransaction(
  userId: string,
  temporaryId: string,
  temporaryDate: string,
  saved: TransactionView,
) {
  const [oldYear, oldMonth] = temporaryDate.split("-").map(Number);
  const [newYear, newMonth] = saved.transaction_date.split("-").map(Number);
  const replacement = { ...saved, sync_error_code: undefined };

  if (oldYear === newYear && oldMonth === newMonth) {
    await patchCachedMonth(userId, oldYear, oldMonth, (transactions) => [
      ...transactions.filter(
        (transaction) =>
          transaction.id !== temporaryId && transaction.id !== saved.id,
      ),
      replacement,
    ]);
    return;
  }

  await patchCachedMonth(userId, oldYear, oldMonth, (transactions) =>
    transactions.filter(
      (transaction) =>
        transaction.id !== temporaryId && transaction.id !== saved.id,
    ),
  );
  await patchCachedMonth(userId, newYear, newMonth, (transactions) => [
    ...transactions.filter((transaction) => transaction.id !== saved.id),
    replacement,
  ]);
}

export async function setCachedTransactionSyncState(
  userId: string,
  transactionDate: string,
  transactionId: string,
  syncState: TransactionView["sync_state"],
  errorCode?: BackendErrorCode,
) {
  const [year, month] = transactionDate.split("-").map(Number);
  await patchCachedMonth(userId, year, month, (transactions) =>
    transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            sync_state: syncState,
            ...(errorCode == null
              ? { sync_error_code: undefined }
              : { sync_error_code: errorCode }),
          }
        : transaction,
    ),
  );
}

function stableLegacyKey(opType: string, id: string, createdAt: number) {
  return `legacy:${opType}:${id}:${createdAt}`.slice(0, 128).padEnd(16, "0");
}

function normalizePendingOperation(
  value: unknown,
  expectedUserId: string,
): PendingOp | null {
  const row = objectValue(value);
  const payload = objectValue(row?.payload);
  if (!row || !payload || typeof row.id !== "string") return null;

  const opType = row.opType;
  if (!["create", "update", "delete"].includes(opType)) return null;

  const legacyCreateData = opType === "create" ? payload : null;
  const nestedCreateData = objectValue(payload.data);
  const createData = nestedCreateData ?? legacyCreateData;
  const recordedUserId =
    typeof row.userId === "string"
      ? row.userId
      : typeof createData?.user_id === "string"
        ? createData.user_id
        : null;

  // Legacy update/delete entries had no user ownership. Never attribute them
  // to whichever account happens to sign in next.
  if (recordedUserId !== expectedUserId) return null;

  const now = Date.now();
  const createdAt = typeof row.createdAt === "number" ? row.createdAt : now;
  const base = {
    id: row.id,
    userId: expectedUserId,
    idempotencyKey:
      typeof row.idempotencyKey === "string" &&
      row.idempotencyKey.length >= 16
        ? row.idempotencyKey.slice(0, 128)
        : stableLegacyKey(opType, row.id, createdAt),
    status:
      row.status === "failed" || row.status === "conflict"
        ? row.status
        : "queued" as const,
    retryCount:
      typeof row.retryCount === "number" && row.retryCount >= 0
        ? row.retryCount
        : 0,
    nextRetryAt:
      typeof row.nextRetryAt === "number" ? row.nextRetryAt : 0,
    lastAttemptAt:
      typeof row.lastAttemptAt === "number" ? row.lastAttemptAt : null,
    lastError: objectValue(row.lastError) as PendingOp["lastError"],
    createdAt,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : createdAt,
  };

  if (opType === "create") {
    if (
      !createData ||
      typeof createData.type !== "string" ||
      typeof createData.amount !== "number" ||
      typeof createData.category_id !== "string" ||
      typeof createData.transaction_date !== "string"
    ) {
      return null;
    }
    return {
      ...base,
      opType: "create",
      payload: {
        data: {
          user_id: expectedUserId,
          type: createData.type,
          amount: createData.amount,
          note: typeof createData.note === "string" ? createData.note : "",
          category_id: createData.category_id,
          transaction_date: createData.transaction_date,
        },
        source: payload.source ?? "mobile_app",
        tempId:
          typeof payload.tempId === "string" ? payload.tempId : row.id,
      },
    } as PendingOp;
  }

  if (typeof payload.transactionId !== "string") return null;
  const sharedPayload = {
    expectedRevision:
      typeof payload.expectedRevision === "number"
        ? payload.expectedRevision
        : null,
    transactionDate:
      typeof payload.transactionDate === "string"
        ? payload.transactionDate
        : "",
    transactionId: payload.transactionId,
  };

  if (opType === "update") {
    return {
      ...base,
      opType: "update",
      payload: {
        ...sharedPayload,
        data: objectValue(payload.data) ?? {},
      },
    } as PendingOp;
  }

  return { ...base, opType: "delete", payload: sharedPayload } as PendingOp;
}

async function ensureLegacyMigration(userId: string) {
  const markerKey = `${LEGACY_MIGRATION_PREFIX}/${userId}`;
  const key = pendingOpsKey(userId);
  await withKeyLock(key, async () => {
    if ((await AsyncStorage.getItem(markerKey)) === "1") return;

    const current = parseJsonArray(await AsyncStorage.getItem(key))
      .map((value) => normalizePendingOperation(value, userId))
      .filter((value): value is PendingOp => value != null);
    const legacy = parseJsonArray(
      await AsyncStorage.getItem(LEGACY_PENDING_OPS_KEY),
    )
      .map((value) => normalizePendingOperation(value, userId))
      .filter((value): value is PendingOp => value != null);
    const migrated = legacy.reduce(enqueuePendingOperation, current);

    await AsyncStorage.multiSet([
      [key, JSON.stringify(migrated)],
      [markerKey, "1"],
    ]);
  });
}

async function mutatePendingOps(
  userId: string,
  mutate: (operations: PendingOp[]) => PendingOp[],
) {
  await ensureLegacyMigration(userId);
  const key = pendingOpsKey(userId);
  return withKeyLock(key, async () => {
    const current = parseJsonArray(await AsyncStorage.getItem(key))
      .map((value) => normalizePendingOperation(value, userId))
      .filter((value): value is PendingOp => value != null);
    const next = mutate(current);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
}

export async function getPendingOps(userId: string): Promise<PendingOp[]> {
  await ensureLegacyMigration(userId);
  const values = parseJsonArray(
    await AsyncStorage.getItem(pendingOpsKey(userId)),
  );
  return values
    .map((value) => normalizePendingOperation(value, userId))
    .filter((value): value is PendingOp => value != null)
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function addPendingOp(userId: string, operation: PendingOp) {
  if (operation.userId !== userId) {
    throw new Error("Pending operation user does not match its queue owner.");
  }
  return mutatePendingOps(userId, (current) =>
    enqueuePendingOperation(current, operation),
  );
}

export async function updatePendingOp(
  userId: string,
  operationId: string,
  update: (operation: PendingOp) => PendingOp,
) {
  return mutatePendingOps(userId, (current) =>
    current.map((operation) =>
      operation.id === operationId ? update(operation) : operation,
    ),
  );
}

export async function removePendingOp(userId: string, operationId: string) {
  return mutatePendingOps(userId, (current) =>
    current.filter((operation) => operation.id !== operationId),
  );
}

export async function remapPendingTransaction(
  userId: string,
  temporaryId: string,
  serverId: string,
) {
  return mutatePendingOps(userId, (current) =>
    remapPendingTransactionId(current, temporaryId, serverId),
  );
}

export async function clearAllPendingOps(userId: string) {
  await withKeyLock(pendingOpsKey(userId), () =>
    AsyncStorage.removeItem(pendingOpsKey(userId)),
  );
}

export async function getPendingSummary(userId: string) {
  const operations = await getPendingOps(userId);
  return {
    conflict: operations.filter((operation) => operation.status === "conflict")
      .length,
    failed: operations.filter((operation) => operation.status === "failed")
      .length,
    queued: operations.filter((operation) => operation.status === "queued")
      .length,
    syncing: operations.filter((operation) => operation.status === "syncing")
      .length,
    total: operations.length,
  };
}

export type CachedTransaction = TransactionRecord &
  Pick<TransactionView, "sync_state" | "sync_error_code">;
