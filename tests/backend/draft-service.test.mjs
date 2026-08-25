import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceUrl = new URL(
  "../../src/services/supabase/draft-service.ts",
  import.meta.url,
);
const service = await readFile(serviceUrl, "utf8");

test("draft confirmation is retry-safe after a lost response", () => {
  assert.match(
    service,
    /draft\.lifecycle === "confirmed" &&\s*draft\.confirmed_transaction_id === normalizedTransactionId/s,
  );
  assert.match(service, /getTransactionDraft\(/);
  assert.match(
    service,
    /current\.lifecycle === "confirmed" &&\s*current\.confirmed_transaction_id === normalizedTransactionId/s,
  );
});

test("draft confirmation rejects a conflicting transaction link", () => {
  assert.match(service, /already linked to a different transaction/);
  assert.match(service, /code: "CONFLICT"/);
});
