import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260805000500_transaction_review_drafts.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");

test("transaction drafts are review-first and protect duplicate source messages", () => {
  assert.match(migration, /create table public\.transaction_drafts/);
  assert.match(
    migration,
    /lifecycle in \(\s*'draft', 'pending_confirmation', 'needs_review', 'confirmed'/,
  );
  assert.match(migration, /extracted_fields jsonb not null/);
  assert.match(migration, /missing_fields text\[\] not null/);
  assert.match(migration, /overall_confidence numeric\(4, 3\)/);
  assert.match(migration, /transaction_drafts_source_message_unique_idx/);
  assert.match(
    migration,
    /on public\.transaction_drafts \(owner_user_id, source, source_message_id\)/,
  );
});

test("transaction drafts expire and preserve confirmed transaction linkage", () => {
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /confirmed_transaction_id uuid references public\.transactions/);
  assert.match(migration, /on delete restrict/);
  assert.match(
    migration,
    /lifecycle = 'confirmed' and confirmed_transaction_id is not null/,
  );
  assert.match(
    migration,
    /confirmed_transaction_id is null\s*\)\s*;\s*\n\s*grant select, insert, update, delete/s,
  );
});

test("transaction draft RLS is owner and workspace scoped", () => {
  assert.match(migration, /alter table public\.transaction_drafts enable row level security/);
  assert.match(migration, /auth\.uid\(\) = owner_user_id/g);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/g);
  assert.match(migration, /Draft owner is not a workspace member/);
  assert.match(
    migration,
    /Confirmed transaction does not belong to the draft owner and workspace/,
  );
});

test("draft source identity is immutable while correction fields remain editable", () => {
  assert.match(migration, /Draft source identity is immutable/);
  assert.match(migration, /new\.original_text <> old\.original_text/);
  assert.match(migration, /new\.parser_version <> old\.parser_version/);
  assert.doesNotMatch(
    migration,
    /new\.extracted_fields <> old\.extracted_fields/,
  );
  assert.doesNotMatch(
    migration,
    /new\.missing_fields <> old\.missing_fields/,
  );
});

test("confirmation is one-way, ready-only, and immutable", () => {
  assert.match(migration, /Confirmed draft history is immutable/);
  assert.match(
    migration,
    /old\.lifecycle <> 'pending_confirmation'/,
  );
  assert.match(migration, /cardinality\(new\.missing_fields\) > 0/);
  assert.match(migration, /new\.expires_at <= timezone\('utc', now\(\)\)/);
  assert.match(migration, /Draft is not ready for confirmation/);
});
