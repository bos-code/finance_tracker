import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260803000100_current_schema_baseline.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const reliabilityUrl = new URL(
  "../../supabase/migrations/20260803000200_transaction_reliability.sql",
  import.meta.url,
);
const reliabilitySql = await readFile(reliabilityUrl, "utf8");
const workspaceUrl = new URL(
  "../../supabase/migrations/20260803000300_workspace_currency_foundation.sql",
  import.meta.url,
);
const workspaceSql = await readFile(workspaceUrl, "utf8");
const receiptStorageUrl = new URL(
  "../../supabase/migrations/20260803000400_secure_receipt_storage.sql",
  import.meta.url,
);
const receiptStorageSql = await readFile(receiptStorageUrl, "utf8");

test("baseline creates the current critical tables", () => {
  assert.match(sql, /create table if not exists public\.transactions/i);
  assert.match(sql, /create table if not exists public\.goals/i);
});

test("financial tables enforce row-level security", () => {
  for (const table of ["transactions", "goals"]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    for (const action of ["select", "insert", "update", "delete"]) {
      assert.match(
        sql,
        new RegExp(`on public\\.${table}\\s+for ${action}`, "i"),
      );
    }
  }
});

test("baseline protects core financial invariants", () => {
  assert.match(sql, /amount numeric\(12, 2\) not null check \(amount > 0\)/i);
  assert.match(sql, /type in \('Expenditure', 'Revenue'\)/i);
  assert.match(sql, /target_amount numeric\(12, 2\) not null check \(target_amount > 0\)/i);
  assert.match(sql, /goals_completion_state_check/i);
  assert.match(sql, /transactions_user_date_idx/i);
  assert.match(sql, /goals_user_status_target_date_idx/i);
});

test("transaction mutations are idempotent and revision-aware", () => {
  assert.match(
    reliabilitySql,
    /unique \(user_id, idempotency_key\)/i,
  );
  assert.match(reliabilitySql, /create table if not exists public\.transaction_mutations/i);
  assert.match(reliabilitySql, /security definer/i);
  assert.match(reliabilitySql, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(reliabilitySql, /request_payload jsonb not null/i);
  assert.match(reliabilitySql, /request_payload <> v_request_payload/i);
  assert.match(reliabilitySql, /revision = p_expected_revision/i);
  assert.match(reliabilitySql, /errcode = '40001'/i);
});

test("reliability migration uses soft deletion without stranding older clients", () => {
  assert.match(reliabilitySql, /add column if not exists deleted_at timestamptz/i);
  assert.match(reliabilitySql, /set lifecycle = 'deleted'/i);
  assert.match(reliabilitySql, /compatibility window/i);
  assert.doesNotMatch(
    reliabilitySql,
    /drop policy if exists "Users can insert their own transactions"/i,
  );
  assert.match(reliabilitySql, /grant execute on function public\.mutate_transaction/i);
});

test("workspace migration provisions the complete personal-finance boundary", () => {
  for (const table of [
    "currencies",
    "country_currency_defaults",
    "profiles",
    "workspaces",
    "workspace_members",
    "financial_accounts",
  ]) {
    assert.match(
      workspaceSql,
      new RegExp(`create table if not exists public\\.${table}`, "i"),
    );
    assert.match(
      workspaceSql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  }
  assert.match(workspaceSql, /workspaces_one_personal_owner_idx/i);
  assert.match(workspaceSql, /financial_accounts_one_default_idx/i);
  assert.match(workspaceSql, /auth_user_finance_bootstrap/i);
  assert.match(workspaceSql, /auth_user_finance_metadata_sync/i);
  assert.match(workspaceSql, /from auth\.users/i);
});

test("existing financial records receive explicit scope and ISO currency", () => {
  for (const column of [
    "workspace_id",
    "account_id",
    "currency_code",
    "base_currency_code",
    "base_amount",
    "exchange_rate",
  ]) {
    assert.match(
      workspaceSql,
      new RegExp(`add column if not exists ${column}`, "i"),
    );
    assert.match(
      workspaceSql,
      new RegExp(`alter column ${column} set not null`, "i"),
    );
  }
  assert.match(workspaceSql, /set workspace_id = workspace\.id/i);
  assert.match(workspaceSql, /base_amount = transaction\.amount/i);
  assert.match(workspaceSql, /exchange_rate = 1/i);
  assert.match(workspaceSql, /goals_currency_fk/i);
  assert.match(workspaceSql, /add column if not exists workspace_id uuid[\s\S]*alter table public\.goals/i);
});

test("workspace currency changes are atomic and historical amounts stay untouched", () => {
  assert.match(workspaceSql, /set_personal_workspace_currency/i);
  assert.match(workspaceSql, /currency_detection_source = 'manual'/i);
  assert.match(
    workspaceSql,
    /update public\.financial_accounts[\s\S]*is_default and not is_archived/i,
  );
  assert.doesNotMatch(
    workspaceSql,
    /update public\.transactions\s+set\s+currency_code\s*=\s*v_currency_code/i,
  );
  assert.doesNotMatch(
    workspaceSql,
    /create policy "Owners can update workspaces"/i,
  );
});

test("Stage 3 RPC remains callable by older clients while accepting scope", () => {
  assert.match(workspaceSql, /p_workspace_id uuid default null/i);
  assert.match(workspaceSql, /p_account_id uuid default null/i);
  assert.match(workspaceSql, /p_base_currency_code text default null/i);
  assert.match(workspaceSql, /transactions_scope_write/i);
  assert.match(workspaceSql, /public\.is_workspace_member\(v_workspace_id\)/i);
  assert.match(workspaceSql, /v_legacy_request_payload/i);
  assert.match(workspaceSql, /not \(v_existing\.request_payload \? 'workspace_id'\)/i);
  assert.match(
    workspaceSql,
    /tg_op = 'INSERT' and new\.base_currency_code <> v_workspace_currency/i,
  );
  assert.doesNotMatch(workspaceSql, /drop table/i);
});

test("2026 regional defaults include Bulgaria and official euro microstates", () => {
  for (const country of ["AD", "BG", "MC", "SM", "VA"]) {
    assert.match(
      workspaceSql,
      new RegExp(`\\('${country}', 'EUR'\\)`, "i"),
    );
  }
});

test("receipt storage is private, bounded, and transaction-owned", () => {
  assert.match(receiptStorageSql, /create table public\.transaction_attachments/i);
  assert.match(receiptStorageSql, /file_size_bytes between 1 and 10485760/i);
  assert.match(receiptStorageSql, /file_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(receiptStorageSql, /page_count between 1 and 25/i);
  assert.match(receiptStorageSql, /transactions_workspace_owner_id_unique/i);
  assert.match(
    receiptStorageSql,
    /foreign key \(workspace_id, owner_user_id, transaction_id\)[\s\S]*references public\.transactions \(workspace_id, user_id, id\)/i,
  );
  assert.match(
    receiptStorageSql,
    /'transaction-receipts',[\s\S]*'transaction-receipts',[\s\S]*false,[\s\S]*10485760/i,
  );
});

test("receipt metadata and Storage policies stay owner-only", () => {
  assert.match(
    receiptStorageSql,
    /alter table public\.transaction_attachments enable row level security/i,
  );
  for (const action of ["select", "insert", "update"]) {
    assert.match(
      receiptStorageSql,
      new RegExp(
        `on public\\.transaction_attachments for ${action} to authenticated`,
        "i",
      ),
    );
  }
  assert.doesNotMatch(
    receiptStorageSql,
    /on public\.transaction_attachments for delete to authenticated/i,
  );
  assert.match(
    receiptStorageSql,
    /grant select, insert, update on public\.transaction_attachments[\s\S]*to authenticated/i,
  );
  assert.doesNotMatch(
    receiptStorageSql,
    /grant\s+delete\s+on\s+public\.transaction_attachments/i,
  );
  for (const action of ["insert", "select", "update", "delete"]) {
    assert.match(
      receiptStorageSql,
      new RegExp(`on storage\\.objects for ${action} to authenticated`, "i"),
    );
  }
  assert.match(
    receiptStorageSql,
    /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
  );
  assert.match(
    receiptStorageSql,
    /attachment\.storage_path = name/i,
  );
});

test("receipt deletion removes the private object before metadata", () => {
  assert.match(
    receiptStorageSql,
    /delete_transaction_attachment_record/i,
  );
  assert.match(
    receiptStorageSql,
    /select 1 from storage\.objects[\s\S]*Private object must be removed before attachment metadata/i,
  );
  assert.match(
    receiptStorageSql,
    /delete from public\.transaction_attachments[\s\S]*owner_user_id = auth\.uid\(\)/i,
  );
});
