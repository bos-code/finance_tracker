import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_ERROR_CODES,
  CURRENCY_DETECTION_SOURCES,
  SYNC_STATES,
  TRANSACTION_LIFECYCLE_STATES,
  TRANSACTION_SOURCES,
  apiFailure,
  apiSuccess,
} from "../../src/contracts/backend.ts";

test("transaction lifecycle and source contracts stay explicit", () => {
  assert.deepEqual(TRANSACTION_LIFECYCLE_STATES, [
    "draft",
    "pending_confirmation",
    "confirmed",
    "needs_review",
    "reversed",
    "deleted",
  ]);
  assert.deepEqual(TRANSACTION_SOURCES, [
    "mobile_app",
    "telegram",
    "whatsapp",
    "web_dashboard",
    "import",
    "system",
  ]);
  assert.deepEqual(SYNC_STATES, [
    "local_only",
    "queued",
    "syncing",
    "synced",
    "failed",
    "conflict",
  ]);
  assert.deepEqual(CURRENCY_DETECTION_SOURCES, [
    "device_region",
    "manual",
    "migration",
    "system_default",
  ]);
});

test("API results keep success and failure mutually exclusive", () => {
  const timestamp = "2026-08-03T12:00:00.000Z";
  assert.deepEqual(apiSuccess({ id: "tx-1" }, "req-1", timestamp), {
    data: { id: "tx-1" },
    meta: { request_id: "req-1", timestamp },
    ok: true,
  });
  assert.deepEqual(
    apiFailure(
      {
        code: "VALIDATION_FAILED",
        message: "Check the amount.",
        retryable: false,
      },
      "req-2",
      timestamp,
    ),
    {
      error: {
        code: "VALIDATION_FAILED",
        message: "Check the amount.",
        retryable: false,
      },
      meta: { request_id: "req-2", timestamp },
      ok: false,
    },
  );
});

test("error catalogue has no duplicate codes", () => {
  assert.equal(new Set(BACKEND_ERROR_CODES).size, BACKEND_ERROR_CODES.length);
});
