import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTransactionQueueScope,
  enqueuePendingOperation,
  isOperationDue,
  nextRetryTime,
  remapPendingTransactionId,
} from "../../src/features/transactions/offline-queue.ts";

function base(operation, id, createdAt = 1) {
  return {
    createdAt,
    id,
    idempotencyKey: `transaction:${operation}:${id}`.padEnd(16, "0"),
    lastAttemptAt: null,
    lastError: null,
    nextRetryAt: 0,
    retryCount: 0,
    status: "queued",
    updatedAt: createdAt,
    userId: "user-1",
  };
}

function create(id = "create-1", tempId = "local-1") {
  return {
    ...base("create", id),
    opType: "create",
    payload: {
      data: {
        account_id: "account-1",
        amount: 25,
        base_currency_code: "USD",
        category_id: "food",
        currency_code: "USD",
        exchange_rate: 1,
        note: "Lunch",
        transaction_date: "2026-08-03",
        type: "Expenditure",
        user_id: "user-1",
        workspace_id: "workspace-1",
      },
      source: "mobile_app",
      tempId,
    },
  };
}

function update(id = "update-1", transactionId = "local-1", data = {}) {
  return {
    ...base("update", id, 2),
    opType: "update",
    payload: {
      data,
      expectedRevision: 1,
      transactionDate: "2026-08-03",
      transactionId,
      workspaceId: "workspace-1",
    },
  };
}

function remove(id = "delete-1", transactionId = "local-1") {
  return {
    ...base("delete", id, 3),
    opType: "delete",
    payload: {
      expectedRevision: 1,
      transactionDate: "2026-08-03",
      transactionId,
      workspaceId: "workspace-1",
    },
  };
}

test("an edit to a local create is compacted into the create payload", () => {
  const queue = enqueuePendingOperation(
    [create()],
    update("update-1", "local-1", { amount: 30, note: "Lunch with Sam" }),
  );

  assert.equal(queue.length, 1);
  assert.equal(queue[0].opType, "create");
  assert.equal(queue[0].payload.data.amount, 30);
  assert.equal(queue[0].payload.data.note, "Lunch with Sam");
});

test("deleting an unsynced create removes its entire local mutation chain", () => {
  const edited = enqueuePendingOperation(
    [create()],
    update("update-1", "local-1", { amount: 30 }),
  );
  assert.deepEqual(enqueuePendingOperation(edited, remove()), []);
});

test("repeated updates merge fields and keep the newest idempotency key", () => {
  const first = update("update-1", "server-1", { amount: 30 });
  const second = update("update-2", "server-1", { note: "Corrected" });
  const queue = enqueuePendingOperation([first], second);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].idempotencyKey, second.idempotencyKey);
  assert.deepEqual(queue[0].payload.data, {
    amount: 30,
    note: "Corrected",
  });
});

test("delete supersedes queued updates for the same server transaction", () => {
  const queue = enqueuePendingOperation(
    [update("update-1", "server-1", { note: "Draft" })],
    remove("delete-1", "server-1"),
  );
  assert.deepEqual(queue.map((operation) => operation.opType), ["delete"]);
});

test("server IDs remap dependent operations without touching the create", () => {
  const queue = remapPendingTransactionId(
    [
      create(),
      { ...update(), status: "syncing" },
      remove(),
    ],
    "local-1",
    "server-1",
  );

  assert.equal(queue[0].payload.tempId, "local-1");
  assert.equal(queue[1].payload.transactionId, "server-1");
  assert.equal(queue[2].payload.transactionId, "server-1");
});

test("Stage 2 operations receive Stage 3 scope without changing identity", () => {
  const legacyCreate = create();
  delete legacyCreate.payload.data.account_id;
  delete legacyCreate.payload.data.base_currency_code;
  delete legacyCreate.payload.data.currency_code;
  delete legacyCreate.payload.data.exchange_rate;
  delete legacyCreate.payload.data.workspace_id;

  const scopedCreate = applyTransactionQueueScope(legacyCreate, {
    accountId: "account-3",
    currencyCode: "NGN",
    workspaceId: "workspace-3",
  });
  assert.equal(scopedCreate.idempotencyKey, legacyCreate.idempotencyKey);
  assert.equal(scopedCreate.payload.data.account_id, "account-3");
  assert.equal(scopedCreate.payload.data.workspace_id, "workspace-3");
  assert.equal(scopedCreate.payload.data.currency_code, "NGN");
  assert.equal(scopedCreate.payload.data.base_currency_code, "NGN");
  assert.equal(scopedCreate.payload.data.exchange_rate, 1);

  const legacyUpdate = update("update-legacy", "server-1", { amount: 50 });
  legacyUpdate.payload.workspaceId = "";
  const scopedUpdate = applyTransactionQueueScope(legacyUpdate, {
    accountId: "account-3",
    currencyCode: "NGN",
    workspaceId: "workspace-3",
  });
  assert.equal(scopedUpdate.payload.workspaceId, "workspace-3");
});

test("retry delay grows exponentially and caps at five minutes", () => {
  assert.equal(nextRetryTime(1, 1_000), 3_000);
  assert.equal(nextRetryTime(2, 1_000), 5_000);
  assert.equal(nextRetryTime(30, 1_000), 301_000);
});

test("conflicts never auto-retry while due failures can be forced", () => {
  const failed = { ...update(), nextRetryAt: 5_000, status: "failed" };
  const conflict = { ...failed, status: "conflict" };
  assert.equal(isOperationDue(failed, 1_000), false);
  assert.equal(isOperationDue(failed, 1_000, true), true);
  assert.equal(isOperationDue(conflict, 10_000, true), false);
});
