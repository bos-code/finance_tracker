import assert from "node:assert/strict";
import test from "node:test";

import {
  draftTransactionIdempotencyKey,
  transactionInsertFromDraft,
} from "../../src/features/drafts/draft-finalization.ts";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function field(value, confidence = 1) {
  return { value, confidence, reason: "Confirmed by user." };
}

function readyDraft(overrides = {}) {
  return {
    id: "draft-123",
    owner_user_id: "user-1",
    workspace_id: "workspace-1",
    source: "mobile_app",
    source_message_id: null,
    original_text: "Spent 5k on food yesterday at Mama Put",
    lifecycle: "pending_confirmation",
    extracted_fields: {
      amount: field(5000),
      type: field("Expenditure"),
      currency_code: field("NGN"),
      transaction_date: field("2026-08-04"),
      category_key: field("food"),
      description: field("food"),
      merchant_name: field("Mama Put"),
    },
    missing_fields: [],
    parser_version: "deterministic-v1",
    overall_confidence: 1,
    expires_at: "2026-09-04T12:00:00.000Z",
    confirmed_transaction_id: null,
    created_at: "2026-08-05T12:00:00.000Z",
    updated_at: "2026-08-05T12:00:00.000Z",
    ...overrides,
  };
}

const BASE_CONTEXT = {
  accountId: "account-1",
  baseCurrencyCode: "NGN",
  now: NOW,
  ownerUserId: "user-1",
  workspaceId: "workspace-1",
};

test("maps a reviewed same-currency draft into a ledger transaction", () => {
  const insert = transactionInsertFromDraft(readyDraft(), BASE_CONTEXT);

  assert.deepEqual(insert, {
    account_id: "account-1",
    amount: 5000,
    base_currency_code: "NGN",
    category_id: "eat",
    currency_code: "NGN",
    exchange_rate: 1,
    note: "food — Mama Put",
    transaction_date: "2026-08-04",
    type: "Expenditure",
    user_id: "user-1",
    workspace_id: "workspace-1",
  });
});

test("requires a manual exchange rate for cross-currency drafts", () => {
  const draft = readyDraft({
    extracted_fields: {
      ...readyDraft().extracted_fields,
      currency_code: field("USD"),
    },
  });

  assert.throws(
    () => transactionInsertFromDraft(draft, BASE_CONTEXT),
    (error) =>
      error.code === "VALIDATION_FAILED" &&
      error.fieldErrors?.[0]?.field === "exchange_rate",
  );

  const insert = transactionInsertFromDraft(draft, {
    ...BASE_CONTEXT,
    exchangeRate: 1550.25,
  });
  assert.equal(insert.exchange_rate, 1550.25);
  assert.equal(insert.currency_code, "USD");
  assert.equal(insert.base_currency_code, "NGN");
});

test("resolves utility wording without guessing phone versus power", () => {
  const phoneDraft = readyDraft({
    original_text: "Spent 2k on data today",
    extracted_fields: {
      ...readyDraft().extracted_fields,
      category_key: field("utilities"),
    },
  });
  assert.equal(
    transactionInsertFromDraft(phoneDraft, BASE_CONTEXT).category_id,
    "phone",
  );

  const waterDraft = readyDraft({
    original_text: "Paid 3k water bill today",
    extracted_fields: {
      ...readyDraft().extracted_fields,
      category_key: field("utilities"),
    },
  });
  assert.equal(
    transactionInsertFromDraft(waterDraft, BASE_CONTEXT).category_id,
    "utilities",
  );
});

test("blocks invalid lifecycle, ownership, expiry, and category", () => {
  assert.throws(
    () =>
      transactionInsertFromDraft(
        readyDraft({ lifecycle: "needs_review" }),
        BASE_CONTEXT,
      ),
    (error) => error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () =>
      transactionInsertFromDraft(readyDraft(), {
        ...BASE_CONTEXT,
        ownerUserId: "user-2",
      }),
    (error) => error.code === "PERMISSION_DENIED",
  );
  assert.throws(
    () =>
      transactionInsertFromDraft(
        readyDraft({ expires_at: "2026-08-04T12:00:00.000Z" }),
        BASE_CONTEXT,
      ),
    (error) => error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () =>
      transactionInsertFromDraft(
        readyDraft({
          extracted_fields: {
            ...readyDraft().extracted_fields,
            category_key: field("savings"),
          },
        }),
        BASE_CONTEXT,
      ),
    (error) =>
      error.code === "VALIDATION_FAILED" &&
      error.fieldErrors?.[0]?.field === "category_key",
  );
});

test("uses a stable per-draft idempotency key", () => {
  assert.equal(
    draftTransactionIdempotencyKey("draft-123"),
    "transaction:draft:draft-123",
  );
});
