-- Finance Tracker Backend Stage 6 (controlled AI assistance)
-- Purpose: usage ledger, daily quotas, and a circuit breaker for the Gemini
-- assistant, plus a per-connection switch so each user controls whether their
-- Telegram messages may be sent to the AI provider.
-- Prerequisite: 20261022000600_telegram_channel_connections.sql.
-- Trust model: everything here is service_role only. Clients never read or write
-- the usage ledger, and the AI key never leaves the Edge Function environment.
-- Recovery: additive. To disable AI, unset GEMINI_API_KEY; rows may be kept.

begin;

alter table public.channel_connections
  add column ai_assist_enabled boolean not null default true;

comment on column public.channel_connections.ai_assist_enabled is
  'When false the bot never sends this user''s messages to the AI provider (/ai off).';

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('transaction_parser', 'assistant_help')),
  provider text not null default 'gemini' check (provider = 'gemini'),
  model text not null check (char_length(model) between 1 and 128),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  outcome text not null default 'pending'
    check (outcome in ('pending', 'success', 'failure', 'fallback')),
  created_at timestamptz not null default timezone('utc', now())
);

create index ai_usage_owner_day_idx on public.ai_usage (owner_user_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

comment on table public.ai_usage is
  'One row per AI call attempt: tokens, outcome, and quota accounting. service_role only.';

-- Reserves one AI call if the user and project are under their daily limits and
-- the provider looks healthy. A pending row counts immediately, so concurrent
-- messages cannot overshoot a limit.
create or replace function public.claim_ai_quota(
  p_owner_user_id uuid,
  p_feature text,
  p_model text,
  p_user_daily_limit integer,
  p_global_daily_limit integer
)
returns table (quota_outcome text, quota_usage_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', timezone('utc', now()));
  v_recent_window timestamptz := timezone('utc', now()) - interval '5 minutes';
  v_id uuid;
begin
  perform pg_advisory_xact_lock(727001);

  -- Circuit breaker: five failures and no success in the last five minutes.
  if (
    select count(*) from public.ai_usage
    where outcome = 'failure' and created_at > v_recent_window
  ) >= 5 and not exists (
    select 1 from public.ai_usage
    where outcome = 'success' and created_at > v_recent_window
  ) then
    return query select 'circuit_open'::text, null::uuid;
    return;
  end if;

  if (
    select count(*) from public.ai_usage
    where owner_user_id = p_owner_user_id and created_at >= v_day_start
  ) >= p_user_daily_limit then
    return query select 'user_limited'::text, null::uuid;
    return;
  end if;

  if (
    select count(*) from public.ai_usage where created_at >= v_day_start
  ) >= p_global_daily_limit then
    return query select 'global_limited'::text, null::uuid;
    return;
  end if;

  insert into public.ai_usage (owner_user_id, feature, model)
  values (p_owner_user_id, p_feature, p_model)
  returning id into v_id;

  return query select 'ok'::text, v_id;
end;
$$;

create or replace function public.finish_ai_usage(
  p_usage_id uuid,
  p_outcome text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage
  set outcome = p_outcome,
      input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
      output_tokens = greatest(coalesce(p_output_tokens, 0), 0)
  where id = p_usage_id and outcome = 'pending';
end;
$$;

revoke all on function public.claim_ai_quota(uuid, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_ai_usage(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_ai_quota(uuid, text, text, integer, integer)
  to service_role;
grant execute on function public.finish_ai_usage(uuid, text, integer, integer)
  to service_role;

commit;
