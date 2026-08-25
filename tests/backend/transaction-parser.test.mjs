import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCompactAmountToken,
  parseTransactionText,
} from "../../src/features/drafts/transaction-parser.ts";

const NOW = new Date(2026, 7, 5, 12, 0, 0);

test("parses Nigerian compact amount shorthand", () => {
  assert.equal(parseCompactAmountToken("5k"), 5_000);
  assert.equal(parseCompactAmountToken("2.5k"), 2_500);
  assert.equal(parseCompactAmountToken("350k"), 350_000);
  assert.equal(parseCompactAmountToken("1m"), 1_000_000);
  assert.equal(parseCompactAmountToken("₦250,000"), 250_000);
  assert.equal(parseCompactAmountToken("0"), null);
  assert.equal(parseCompactAmountToken("five thousand"), null);
});

test("parses a simple Nigerian expense without requiring review", () => {
  const result = parseTransactionText("Spent 5k on food yesterday", {
    now: NOW,
    defaultCurrency: "NGN",
  });

  assert.equal(result.fields.amount.value, 5_000);
  assert.equal(result.fields.type.value, "Expenditure");
  assert.equal(result.fields.currency_code.value, "NGN");
  assert.equal(result.fields.transaction_date.value, "2026-08-04");
  assert.equal(result.fields.category_key.value, "food");
  assert.equal(result.requires_review, false);
  assert.deepEqual(result.missing_fields, []);
});

test("parses explicit currency income and salary category", () => {
  const result = parseTransactionText("Received ₦250,000 salary today", {
    now: NOW,
    defaultCurrency: "USD",
  });

  assert.equal(result.fields.amount.value, 250_000);
  assert.equal(result.fields.type.value, "Revenue");
  assert.equal(result.fields.currency_code.value, "NGN");
  assert.equal(result.fields.transaction_date.value, "2026-08-05");
  assert.equal(result.fields.category_key.value, "salary");
  assert.equal(result.requires_review, false);
});

test("resolves last weekday deterministically", () => {
  const result = parseTransactionText("Paid 2.5k transport last Friday", {
    now: NOW,
    defaultCurrency: "NGN",
  });

  assert.equal(result.fields.amount.value, 2_500);
  assert.equal(result.fields.transaction_date.value, "2026-07-31");
  assert.equal(result.fields.category_key.value, "transport");
  assert.equal(result.requires_review, false);
});

test("extracts merchant names while preserving review-first behavior", () => {
  const result = parseTransactionText("Paid $42 for dinner at KFC yesterday", {
    now: NOW,
    defaultCurrency: "NGN",
  });

  assert.equal(result.fields.currency_code.value, "USD");
  assert.equal(result.fields.merchant_name.value, "kfc");
  assert.equal(result.fields.category_key.value, "food");
  assert.equal(result.requires_review, false);
});

test("keeps ambiguous or incomplete messages as reviewable drafts", () => {
  const missingAmount = parseTransactionText("Paid for transport yesterday", {
    now: NOW,
    defaultCurrency: "NGN",
  });
  assert.equal(missingAmount.requires_review, true);
  assert.ok(missingAmount.missing_fields.includes("amount"));

  const missingType = parseTransactionText("5k food yesterday", {
    now: NOW,
    defaultCurrency: "NGN",
  });
  assert.equal(missingType.requires_review, true);
  assert.ok(missingType.missing_fields.includes("type"));

  const noCurrency = parseTransactionText("Spent 5k on food", { now: NOW });
  assert.equal(noCurrency.requires_review, true);
  assert.ok(noCurrency.missing_fields.includes("currency_code"));
});

test("accepts explicit ISO and day-month-year dates", () => {
  const iso = parseTransactionText("Spent NGN 900 on data 2026-08-01", {
    now: NOW,
  });
  assert.equal(iso.fields.transaction_date.value, "2026-08-01");

  const slash = parseTransactionText("Spent NGN 900 on data 01/08/2026", {
    now: NOW,
  });
  assert.equal(slash.fields.transaction_date.value, "2026-08-01");
});
