import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessDraftForChat,
  fieldLabel,
  transactionSummary,
} from "../../src/features/drafts/chat-confirmation.ts";
import { buildTransactionDraftInsert } from "../../src/features/drafts/draft-capture.ts";
import {
  draftTransactionIdempotencyKey,
  transactionInsertFromDraft,
} from "../../src/features/drafts/draft-finalization.ts";

const NOW = new Date("2026-10-22T10:00:00.000Z");
const CONTEXT = { accountId: "account-1", baseCurrencyCode: "NGN", now: NOW };

function draftFor(text, overrides = {}) {
  return {
    ...buildTransactionDraftInsert({
      defaultCurrency: "NGN",
      now: NOW,
      ownerUserId: "user-1",
      source: "telegram",
      sourceMessageId: "1:1",
      text,
      workspaceId: "workspace-1",
    }),
    id: "draft-1",
    ...overrides,
  };
}

test("a complete draft is saveable and builds the same transaction the app would", () => {
  const draft = draftFor("spent 2500 on lunch");
  const result = assessDraftForChat(draft, CONTEXT);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.check, []);
  assert.deepEqual(result.transaction.amount, 2500);
  assert.equal(result.transaction.category_id, "eat");
  assert.equal(result.transaction.account_id, "account-1");
  assert.equal(result.transaction.user_id, "user-1");
  assert.equal(result.transaction.workspace_id, "workspace-1");

  // Identical to what the in-app review would produce for the same draft.
  const viaApp = transactionInsertFromDraft(draft, {
    accountId: "account-1",
    baseCurrencyCode: "NGN",
    now: NOW,
    ownerUserId: "user-1",
    workspaceId: "workspace-1",
  });
  assert.deepEqual(result.transaction, viaApp);
});

test("income and a relative date are carried through", () => {
  const income = assessDraftForChat(draftFor("received 150k salary"), CONTEXT);
  assert.equal(income.status, "ready");
  assert.equal(income.transaction.type, "Revenue");
  assert.equal(income.transaction.amount, 150000);

  const yesterday = assessDraftForChat(draftFor("paid 3000 for electricity yesterday"), CONTEXT);
  assert.equal(yesterday.transaction.transaction_date, "2026-10-21");
});

test("values the parser was unsure about are listed for a second look but do not block saving", () => {
  const draft = draftFor("spent 2500 on lunch");
  draft.missing_fields = ["category_key"];
  draft.lifecycle = "needs_review";
  const result = assessDraftForChat(draft, CONTEXT);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.check, ["category_key"]);
});

test("a value that is actually missing blocks saving and is named in plain words", () => {
  const noAmount = assessDraftForChat(draftFor("bought lunch"), CONTEXT);
  assert.equal(noAmount.status, "blocked");
  assert.match(noAmount.reason, /Still needed: amount\./);

  const noCategory = assessDraftForChat(draftFor("spent 2500 at the market"), CONTEXT);
  assert.equal(noCategory.status, "blocked");
  assert.match(noCategory.reason, /Still needed: category\./);
  assert.doesNotMatch(noCategory.reason, /category_key/);
});

test("a foreign-currency draft is blocked until the app supplies an exchange rate", () => {
  const result = assessDraftForChat(draftFor("spent $20 on lunch"), CONTEXT);
  assert.equal(result.status, "blocked");
  assert.match(result.reason, /exchange rate/);
});

test("expired, confirmed, and account-less drafts are never saveable", () => {
  const expired = assessDraftForChat(
    draftFor("spent 2500 on lunch", { expires_at: "2026-10-01T00:00:00.000Z" }),
    CONTEXT,
  );
  assert.equal(expired.status, "blocked");
  assert.match(expired.reason, /expired/);

  const confirmed = assessDraftForChat(
    draftFor("spent 2500 on lunch", { lifecycle: "confirmed" }),
    CONTEXT,
  );
  assert.equal(confirmed.status, "blocked");
  assert.match(confirmed.reason, /already saved/);

  const noAccount = assessDraftForChat(draftFor("spent 2500 on lunch"), {
    ...CONTEXT,
    accountId: null,
  });
  assert.equal(noAccount.status, "blocked");
  assert.match(noAccount.reason, /default account/);
});

test("assessing a draft never changes it", () => {
  const draft = draftFor("spent 2500 on lunch");
  const before = JSON.stringify(draft);
  assessDraftForChat(draft, CONTEXT);
  assert.equal(JSON.stringify(draft), before);
});

test("the one-line summary is readable and uses the category's name", () => {
  assert.equal(
    transactionSummary({
      amount: 2500,
      category_id: "eat",
      currency_code: "NGN",
      transaction_date: "2026-10-22",
      type: "Expenditure",
    }),
    "2,500 NGN · expense · Eat & drink · 2026-10-22",
  );
  assert.equal(
    transactionSummary({
      amount: 12.5,
      category_id: "salary",
      currency_code: "USD",
      transaction_date: "2026-10-22",
      type: "Revenue",
    }),
    "12.50 USD · income · Salary · 2026-10-22",
  );
  assert.equal(fieldLabel("category_key"), "category");
  assert.equal(fieldLabel("something_new"), "something new");
});

// --- the database functions ----------------------------------------------------

const migration = await readFile(
  new URL("../../supabase/migrations/20261101000800_telegram_draft_confirmation.sql", import.meta.url),
  "utf8",
);

test("both functions run as the owner with an empty search path", () => {
  const definitions = migration.match(/create or replace function public\.telegram_\w+/g) ?? [];
  assert.equal(definitions.length, 2);
  assert.equal((migration.match(/security definer/g) ?? []).length, 2);
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 2);
});

test("only the service role may call them", () => {
  for (const name of ["telegram_confirm_draft", "telegram_discard_draft"]) {
    const revoke = new RegExp(
      `revoke all on function public\\.${name}\\([^)]*\\)\\s+from public, anon, authenticated, service_role`,
    );
    assert.match(migration, revoke, `${name} revoke`);
    const grant = new RegExp(`grant execute on function public\\.${name}\\([^)]*\\)\\s+to service_role;`);
    assert.match(migration, grant, `${name} grant`);
  }
  // No grant statement (as opposed to prose) may name any other role.
  assert.doesNotMatch(migration, /^grant[^;]*\bto\s+(anon|authenticated|public)\b/m);
});

test("confirming reuses mutate_transaction and the app's own idempotency key", () => {
  assert.match(migration, /public\.mutate_transaction\(/);
  assert.match(migration, /'telegram'/);
  const key = draftTransactionIdempotencyKey("DRAFT");
  assert.equal(key, "transaction:draft:DRAFT");
  assert.match(migration, /'transaction:draft:' \|\| p_draft_id::text/);
});

test("every lookup is scoped to the connection's own owner and workspace", () => {
  assert.match(migration, /c\.status = 'active'/);
  assert.equal((migration.match(/d\.owner_user_id = v_owner/g) ?? []).length, 2);
  assert.equal((migration.match(/d\.workspace_id = v_workspace/g) ?? []).length, 2);
  // Rows are locked so a double tap, or a tap plus an in-app save, cannot race.
  assert.equal((migration.match(/for update;/g) ?? []).length, 2);
});

test("the impersonation of the owner is transaction-local and cleared", () => {
  assert.match(migration, /set_config\('request\.jwt\.claim\.sub', v_owner::text, true\)/);
  assert.match(migration, /set_config\('request\.jwt\.claim\.sub', '', true\)/);
});

test("confirmed drafts are never deleted or re-confirmed", () => {
  assert.match(migration, /v_lifecycle = 'confirmed'[\s\S]*?return 'already_confirmed'/);
  assert.match(migration, /v_draft\.lifecycle = 'confirmed'/);
});
