import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendError,
  backendErrorMessage,
  toBackendError,
} from "../../src/services/backend/errors.ts";

test("normalizes missing schema without leaking provider details", () => {
  const error = toBackendError({
    code: "PGRST205",
    message: "Could not find the table public.transactions in the schema cache",
  });
  assert.equal(error.code, "BACKEND_NOT_READY");
  assert.equal(error.retryable, false);
  assert.equal(
    error.message,
    "Finance data is not ready yet. Please try again shortly.",
  );
});

test("normalizes network failure as retryable", () => {
  const error = toBackendError(new TypeError("Network request failed"));
  assert.equal(error.code, "NETWORK_UNAVAILABLE");
  assert.equal(error.retryable, true);
});

test("preserves an existing typed backend error", () => {
  const original = new BackendError({
    code: "CONFLICT",
    message: "Refresh first.",
  });
  assert.equal(toBackendError(original), original);
  assert.equal(backendErrorMessage(original), "Refresh first.");
});
