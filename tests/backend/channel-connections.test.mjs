import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL(
    "../../supabase/migrations/20261022000600_telegram_channel_connections.sql",
    import.meta.url,
  ),
  "utf8",
);

test("every channel table enforces row-level security", () => {
  for (const table of [
    "channel_connections",
    "channel_link_codes",
    "channel_link_failures",
    "channel_webhook_events",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`));
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      sql,
      new RegExp(`revoke all on public\\.${table} from anon, authenticated`),
    );
  }
});

test("only connections are readable by users, and only their own", () => {
  assert.match(sql, /grant select on public\.channel_connections to authenticated/);
  assert.match(
    sql,
    /create policy "Owners can view channel connections"[\s\S]*auth\.uid\(\) = owner_user_id/,
  );
  assert.doesNotMatch(sql, /on public\.channel_connections for (insert|update|delete)/);
  assert.doesNotMatch(sql, /grant [^;]*public\.channel_link_codes[^;]*authenticated/);
});

test("link codes are hashed, short-lived, single-use, and unbiased", () => {
  assert.match(sql, /code_hash text not null unique check \(code_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /encode\(sha256\(convert_to\(v_raw, 'UTF8'\)\), 'hex'\)/);
  assert.match(sql, /interval '10 minutes'/);
  assert.match(sql, /and used_at is null/);
  assert.match(sql, /and expires_at > timezone\('utc', now\(\)\)/);
  assert.match(sql, /set used_at = timezone\('utc', now\(\)\)/);
  // 32 symbols divide 256 evenly, so there is no modulo bias.
  assert.match(sql, /v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'/);
  assert.match(sql, /get_byte\(v_bytes, v_index\) % 32/);
  // The plaintext code must never be written to a table.
  assert.doesNotMatch(sql, /insert into public\.channel_link_codes[\s\S]{0,200}v_raw,\s*\n/);
});

test("a new code invalidates older ones and requests are rate limited", () => {
  assert.match(sql, /set invalidated_at = timezone\('utc', now\(\)\)/);
  assert.match(sql, /interval '1 hour'\s*\) >= 5/);
  assert.match(sql, /errcode = '54000'/);
});

test("guessing is throttled per Telegram identity", () => {
  assert.match(sql, /insert into public\.channel_link_failures/);
  assert.match(sql, /interval '15 minutes'\s*\) >= 5/);
  assert.match(sql, /return 'rate_limited'/);
});

test("one active identity per account and per Telegram user", () => {
  assert.match(sql, /channel_connections_active_identity_idx[\s\S]*\(provider, provider_user_id\)[\s\S]*where status = 'active'/);
  assert.match(sql, /channel_connections_active_owner_idx[\s\S]*\(owner_user_id, provider\)[\s\S]*where status = 'active'/);
  assert.match(sql, /exception when unique_violation then\s+return 'conflict'/);
});

test("webhook updates are idempotent", () => {
  assert.match(sql, /constraint channel_webhook_events_unique unique \(provider, external_event_id\)/);
  assert.match(sql, /on conflict \(provider, external_event_id\) do nothing/);
});

test("webhook functions are service_role only; user RPCs are authenticated only", () => {
  for (const fn of [
    "claim_channel_webhook_event\\(text, text, text\\)",
    "consume_channel_link_code\\(text, text, text, text\\)",
    "revoke_channel_connection_for_actor\\(text, text\\)",
  ]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\s+to service_role`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${fn}\\s+to [^;]*authenticated`));
  }
  for (const fn of ["create_channel_link_code\\(text\\)", "revoke_channel_connection\\(uuid\\)"]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\s+to authenticated`));
  }
  // Supabase grants EXECUTE to anon by default, so it must be revoked by name.
  assert.match(sql, /from public, anon, authenticated, service_role/);
});

test("security definer functions pin an empty search_path", () => {
  const definers = sql.match(/security definer/g) ?? [];
  const pinned = sql.match(/security definer\s+set search_path = ''/g) ?? [];
  assert.equal(definers.length, 5);
  assert.equal(pinned.length, definers.length);
});

test("revocation is a state change, never a row removal", () => {
  assert.match(sql, /set status = 'revoked', revoked_at = timezone\('utc', now\(\)\)/);
  assert.match(sql, /channel_connections_revocation_check/);
});
