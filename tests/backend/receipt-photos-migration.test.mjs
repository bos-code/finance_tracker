import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL("../../supabase/migrations/20261102000900_telegram_receipt_photos.sql", import.meta.url),
  "utf8",
);
const cleanup = await readFile(
  new URL("../../supabase/functions/receipt-orphan-cleanup/index.ts", import.meta.url),
  "utf8",
);

test("held photos are service-role only: RLS on, no policies, no client grants", () => {
  assert.match(sql, /alter table public\.draft_receipts enable row level security;/);
  assert.match(sql, /revoke all on public\.draft_receipts from anon, authenticated;/);
  assert.doesNotMatch(sql, /create policy/);
  assert.doesNotMatch(sql, /^grant /m);
});

test("the stored path must sit in the owner's own folder, with the record's id", () => {
  assert.match(
    sql,
    /owner_user_id::text \|\| '\/' \|\| workspace_id::text \|\| '\/' \|\|\s+id::text \|\| '\/%'/,
  );
  assert.match(sql, /position\('\.\.' in storage_path\) = 0/);
  assert.match(sql, /storage_path text not null unique/);
});

test("only images up to the bucket's size limit, with a real SHA-256, can be held", () => {
  assert.match(sql, /mime_type in \('image\/jpeg', 'image\/png', 'image\/webp'\)/);
  assert.doesNotMatch(sql, /application\/pdf/);
  assert.match(sql, /file_size_bytes between 1 and 10485760/);
  assert.match(sql, /file_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
});

test("deleting a draft keeps the record long enough to remove its file", () => {
  assert.match(sql, /draft_id uuid unique references public\.transaction_drafts \(id\)\s+on delete set null/);
});

test("confirming a draft attaches its photo once, for any client", () => {
  assert.match(sql, /after update of lifecycle on public\.transaction_drafts/);
  assert.match(sql, /when \(new\.lifecycle = 'confirmed' and old\.lifecycle is distinct from 'confirmed'\)/);
  assert.match(sql, /insert into public\.transaction_attachments/);
  assert.match(sql, /'telegram', v_receipt\.provider_media_id,\s+'uploaded', timezone\('utc', now\(\)\), 'processed'/);
  assert.match(sql, /on conflict do nothing/);
  // Already-attached photos are skipped, and the row is locked against races.
  assert.match(sql, /r\.attached_at is null\s+for update;/);
  assert.match(sql, /set attached_transaction_id = new\.confirmed_transaction_id/);
});

test("the trigger function runs as the owner with an empty search path and no client access", () => {
  assert.match(sql, /create or replace function public\.attach_draft_receipt\(\)[\s\S]*?security definer\s+set search_path = ''/);
  assert.match(
    sql,
    /revoke all on function public\.attach_draft_receipt\(\)\s+from public, anon, authenticated, service_role;/,
  );
});

test("the migration needs no destructive statement", () => {
  const code = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(code, /\bdelete\s+from\b/i);
  assert.doesNotMatch(code, /\bdrop\s+(table|function|trigger|column|constraint|policy)\b/i);
  assert.doesNotMatch(code, /\btruncate\b/i);
});

test("cleanup removes abandoned photos' files before their records, and never attached ones", () => {
  assert.match(cleanup, /\.is\("attached_at", null\)\s+\.is\("draft_id", null\)/);
  assert.match(cleanup, /transaction_drafts!inner\(expires_at\)/);
  assert.match(cleanup, /\.lt\("transaction_drafts\.expires_at", nowIso\)/);
  const loop = cleanup.slice(cleanup.indexOf("for (const photo of"));
  assert.ok(loop.indexOf(".remove([photo.storage_path])") < loop.indexOf('.from("draft_receipts")'));
  // A file that could not be removed keeps its record, so it is retried.
  assert.match(loop, /if \(storageError\) \{\s+photosFailed \+= 1;\s+continue;/);
  // Every query that picks photos to remove is limited to unattached ones.
  const picks = cleanup.slice(cleanup.indexOf("Receipt photos sent to the Telegram bot"), cleanup.indexOf("for (const photo of"));
  assert.equal((picks.match(/\.is\("attached_at", null\)/g) ?? []).length, 2);
});
