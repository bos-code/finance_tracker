import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/001_create_goals.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");

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
