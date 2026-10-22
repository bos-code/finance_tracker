-- Finance Tracker Backend Stage 7
-- Purpose: secure Telegram account linking for one shared bot — one-time link
-- codes, channel connections, webhook idempotency, and abuse limits.
-- Prerequisite: 20260805000500_transaction_review_drafts.sql.
-- Compatibility: additive; existing clients do not read these objects.
-- Trust model: authenticated users may only create a link code, read their own
-- connections, and revoke them through the RPCs below. Everything the webhook
-- does (consume a code, claim an update, disconnect from the bot) is executable
-- by service_role only. Link codes are stored as SHA-256 hashes.
-- Recovery: before the bot is enabled, roll back the transaction. After users
-- link, revoke connections and disable the webhook rather than removing rows.

begin;

create table public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
  provider text not null check (provider in ('telegram', 'whatsapp')),
  provider_user_id text not null
    check (char_length(trim(provider_user_id)) between 1 and 64),
  provider_chat_id text not null
    check (char_length(trim(provider_chat_id)) between 1 and 64),
  status text not null default 'active' check (status in ('active', 'revoked')),
  linked_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  constraint channel_connections_revocation_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

-- One active Telegram identity per account, and one account per identity.
create unique index channel_connections_active_identity_idx
  on public.channel_connections (provider, provider_user_id)
  where status = 'active';
create unique index channel_connections_active_owner_idx
  on public.channel_connections (owner_user_id, provider)
  where status = 'active';
create index channel_connections_owner_idx
  on public.channel_connections (owner_user_id, linked_at desc);

create table public.channel_link_codes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
  provider text not null check (provider in ('telegram', 'whatsapp')),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint channel_link_codes_expiry_check check (expires_at > created_at)
);

create index channel_link_codes_owner_created_idx
  on public.channel_link_codes (owner_user_id, provider, created_at desc);

create table public.channel_link_failures (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('telegram', 'whatsapp')),
  provider_user_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index channel_link_failures_actor_idx
  on public.channel_link_failures (provider, provider_user_id, created_at desc);

create table public.channel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('telegram', 'whatsapp')),
  external_event_id text not null
    check (char_length(external_event_id) between 1 and 128),
  external_actor_id text not null
    check (char_length(external_actor_id) between 1 and 64),
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 64),
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  constraint channel_webhook_events_unique unique (provider, external_event_id)
);

create index channel_webhook_events_actor_idx
  on public.channel_webhook_events (provider, external_actor_id, received_at desc);

alter table public.channel_connections enable row level security;
alter table public.channel_link_codes enable row level security;
alter table public.channel_link_failures enable row level security;
alter table public.channel_webhook_events enable row level security;

-- Users read their own connections only. All writes cross the RPCs below.
create policy "Owners can view channel connections"
on public.channel_connections for select to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

-- Supabase grants new public tables to anon/authenticated by default; the
-- webhook tables and link codes must not be reachable through PostgREST at all.
revoke all on public.channel_connections from anon, authenticated;
revoke all on public.channel_link_codes from anon, authenticated;
revoke all on public.channel_link_failures from anon, authenticated;
revoke all on public.channel_webhook_events from anon, authenticated;
grant select on public.channel_connections to authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_channel_link_code(
  p_provider text default 'telegram'
)
returns table (link_code text, link_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_raw text := '';
  v_expires timestamptz := timezone('utc', now()) + interval '10 minutes';
  v_index integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_provider is distinct from 'telegram' then
    raise exception using errcode = '22023', message = 'Provider is not available';
  end if;

  select id into v_workspace_id
  from public.workspaces
  where owner_user_id = v_user_id and workspace_type = 'personal';

  if v_workspace_id is null then
    raise exception using errcode = 'P0002', message = 'Workspace not found';
  end if;

  if exists (
    select 1 from public.channel_connections
    where owner_user_id = v_user_id
      and provider = p_provider
      and status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'Telegram is already connected';
  end if;

  if (
    select count(*) from public.channel_link_codes
    where owner_user_id = v_user_id
      and provider = p_provider
      and created_at > timezone('utc', now()) - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'Too many link codes requested';
  end if;

  -- Only the newest code may be used.
  update public.channel_link_codes
  set invalidated_at = timezone('utc', now())
  where owner_user_id = v_user_id
    and provider = p_provider
    and used_at is null
    and invalidated_at is null;

  -- 32 symbols divide 256 evenly, so every character is unbiased.
  v_bytes := uuid_send(gen_random_uuid());
  for v_index in 0..7 loop
    v_raw := v_raw || substr(
      v_alphabet,
      (get_byte(v_bytes, v_index) % 32) + 1,
      1
    );
  end loop;

  insert into public.channel_link_codes (
    owner_user_id, workspace_id, provider, code_hash, expires_at
  ) values (
    v_user_id,
    v_workspace_id,
    p_provider,
    encode(sha256(convert_to(v_raw, 'UTF8')), 'hex'),
    v_expires
  );

  return query select substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4), v_expires;
end;
$$;

create or replace function public.revoke_channel_connection(
  p_connection_id uuid
)
returns setof public.channel_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.channel_connections%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  update public.channel_connections
  set status = 'revoked', revoked_at = timezone('utc', now())
  where id = p_connection_id
    and owner_user_id = auth.uid()
    and status = 'active'
  returning * into v_result;

  if not found then
    -- Revoking twice is a no-op so a lost response can safely be retried.
    select * into v_result
    from public.channel_connections
    where id = p_connection_id and owner_user_id = auth.uid();

    if not found then
      raise exception using errcode = 'P0002', message = 'Connection not found';
    end if;
  end if;

  return next v_result;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook (service_role) functions
-- ---------------------------------------------------------------------------

create or replace function public.claim_channel_webhook_event(
  p_provider text,
  p_event_id text,
  p_actor_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if (
    select count(*) from public.channel_webhook_events
    where provider = p_provider
      and external_actor_id = p_actor_id
      and received_at > timezone('utc', now()) - interval '1 minute'
  ) >= 30 then
    return 'rate_limited';
  end if;

  insert into public.channel_webhook_events (
    provider, external_event_id, external_actor_id
  ) values (p_provider, p_event_id, p_actor_id)
  on conflict (provider, external_event_id) do nothing;

  get diagnostics v_claimed = row_count;
  return case when v_claimed = 1 then 'new' else 'duplicate' end;
end;
$$;

create or replace function public.consume_channel_link_code(
  p_provider text,
  p_code text,
  p_provider_user_id text,
  p_provider_chat_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized text :=
    upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_code public.channel_link_codes%rowtype;
begin
  if (
    select count(*) from public.channel_link_failures
    where provider = p_provider
      and provider_user_id = p_provider_user_id
      and created_at > timezone('utc', now()) - interval '15 minutes'
  ) >= 5 then
    return 'rate_limited';
  end if;

  if char_length(v_normalized) <> 8 then
    insert into public.channel_link_failures (provider, provider_user_id)
    values (p_provider, p_provider_user_id);
    return 'invalid';
  end if;

  select * into v_code
  from public.channel_link_codes
  where code_hash = encode(sha256(convert_to(v_normalized, 'UTF8')), 'hex')
    and provider = p_provider
    and used_at is null
    and invalidated_at is null
    and expires_at > timezone('utc', now())
  for update;

  if not found then
    insert into public.channel_link_failures (provider, provider_user_id)
    values (p_provider, p_provider_user_id);
    return 'invalid';
  end if;

  begin
    insert into public.channel_connections (
      owner_user_id, workspace_id, provider, provider_user_id, provider_chat_id
    ) values (
      v_code.owner_user_id,
      v_code.workspace_id,
      p_provider,
      p_provider_user_id,
      p_provider_chat_id
    );
  exception when unique_violation then
    return 'conflict';
  end;

  update public.channel_link_codes
  set used_at = timezone('utc', now())
  where id = v_code.id;

  return 'linked';
end;
$$;

create or replace function public.revoke_channel_connection_for_actor(
  p_provider text,
  p_provider_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked integer;
begin
  update public.channel_connections
  set status = 'revoked', revoked_at = timezone('utc', now())
  where provider = p_provider
    and provider_user_id = p_provider_user_id
    and status = 'active';

  get diagnostics v_revoked = row_count;
  return v_revoked > 0;
end;
$$;

-- Supabase grants EXECUTE to anon/authenticated by default; narrow it
-- explicitly instead of relying on "revoke from public".
revoke all on function public.create_channel_link_code(text)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_channel_connection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_channel_webhook_event(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_channel_link_code(text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_channel_connection_for_actor(text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_channel_link_code(text)
  to authenticated;
grant execute on function public.revoke_channel_connection(uuid)
  to authenticated;
grant execute on function public.claim_channel_webhook_event(text, text, text)
  to service_role;
grant execute on function public.consume_channel_link_code(text, text, text, text)
  to service_role;
grant execute on function public.revoke_channel_connection_for_actor(text, text)
  to service_role;

comment on table public.channel_connections is
  'Links one Finance Tracker account to one external chat identity (Telegram first).';
comment on table public.channel_link_codes is
  'Single-use, short-lived account-link codes stored only as SHA-256 hashes.';
comment on table public.channel_link_failures is
  'Failed link attempts per chat identity, used to throttle guessing.';
comment on table public.channel_webhook_events is
  'Idempotency and debugging ledger for inbound channel updates; service_role only.';

commit;
