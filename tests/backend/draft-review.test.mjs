import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDraftCorrections,
  draftFieldsFromParser,
  evaluateDraftFields,
  isDraftExpired,
} from "../../src/features/drafts/draft-review.ts";
import { parseTransactionText } from "../../src/features/drafts/transaction-parser.ts";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function parsedFields(text) {
  return draftFieldsFromParser(
    parseTransactionText(text, {
      defaultCurrency: "NGN",
      now: NOW,
    }),
  );
}

test("moves complete deterministic fields to pending confirmation", () => {
  const review = evaluateDraftFields(
    parsedFields("spent 5k on food today at Mama Put"),
  );

  assert.equal(review.lifecycle, "pending_confirmation");
  assert.deepEqual(review.missing_fields, []);
  assert.equal(review.extracted_fields.amount.value, 5000);
  assert.equal(review.extracted_fields.type.value, "Expenditure");
  assert.equal(review.extracted_fields.currency_code.value, "NGN");
  assert.equal(review.extracted_fields.category_key.value, "food");
});

test("keeps incomplete parser output in review", () => {
  const review = evaluateDraftFields(parsedFields("5k food today"));

  assert.equal(review.lifecycle, "needs_review");
  assert.deepEqual(review.missing_fields, ["type"]);
});

test("user corrections receive full confidence and can complete a draft", () => {
  const review = evaluateDraftFields(parsedFields("5k food today"));
  const corrected = applyDraftCorrections(
    { extracted_fields: review.extracted_fields },
    { type: "Expenditure" },
  );

  assert.equal(corrected.lifecycle, "pending_confirmation");
  assert.deepEqual(corrected.missing_fields, []);
  assert.equal(corrected.extracted_fields.type.confidence, 1);
  assert.equal(corrected.extracted_fields.type.reason, "Confirmed by user.");
});

test("clearing a required field returns the draft to review", () => {
  const review = evaluateDraftFields(
    parsedFields("spent 5k on food today at Mama Put"),
  );
  const corrected = applyDraftCorrections(
    { extracted_fields: review.extracted_fields },
    { category_key: "" },
  );

  assert.equal(corrected.lifecycle, "needs_review");
  assert.deepEqual(corrected.missing_fields, ["category_key"]);
  assert.equal(corrected.extracted_fields.category_key.value, null);
});

test("detects valid, expired, and malformed expiry timestamps", () => {
  assert.equal(
    isDraftExpired({ expires_at: "2026-08-06T12:00:00.000Z" }, NOW),
    false,
  );
  assert.equal(
    isDraftExpired({ expires_at: "2026-08-04T12:00:00.000Z" }, NOW),
    true,
  );
  assert.equal(isDraftExpired({ expires_at: "not-a-date" }, NOW), true);
});
