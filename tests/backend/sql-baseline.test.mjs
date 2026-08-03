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
