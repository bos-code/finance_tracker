-- Finance Tracker Backend Stage 6b (confirm drafts from Telegram)
-- Purpose: let a linked Telegram chat save or discard one of its own drafts
-- with a button tap, without weakening any rule the in-app flow enforces.
-- Prerequisite: 20261022000600_telegram_channel_connections.sql and
-- 20260805000500_transaction_review_drafts.sql.
-- Trust model: both functions are service_role only. The webhook has already
-- authenticated the request with Telegram's secret header; these functions
-- re-check that the Telegram user has an active connection and that the draft
-- belongs to that connection's account and workspace, so a tampered button can
-- never reach someone else's data.
-- Reuse: the transaction is created by the existing mutate_transaction RPC, with
-- the same idempotency key the app uses for a draft, so the journal, revision
-- and currency rules are identical and a draft can only ever become one
-- transaction, whichever client confirms it.
-- Recovery: additive. To turn the feature off, stop sending buttons (or revoke
-- execute on these functions); no data shape changes.

begin;

create or replace function public.telegram_confirm_draft(
  p_provider_user_id text,
  p_draft_id uuid,
  p_type text,
  p_amount numeric,
  p_note text,
  p_category_id text,
  p_transaction_date date,
  p_currency_code text,
  p_base_currency_code text,
  p_exchange_rate numeric,
  p_account_id uuid
)
returns table (outcome text, result_transaction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_workspace uuid;
  v_draft public.transaction_drafts%rowtype;
  v_key text := 'transaction:draft:' || p_draft_id::text;
  v_transaction_id uuid;
  v_created public.transactions%rowtype;
begin
  select c.owner_user_id, c.workspace_id
  into v_owner, v_workspace
  from public.channel_connections c
  where c.provider = 'telegram'
    and c.provider_user_id = p_provider_user_id
    and c.status = 'active';
  if not found then
    return query select 'not_linked'::text, null::uuid;
    return;
  end if;

  -- Lock the draft so two quick taps (or a tap and an in-app save) queue up
  -- instead of racing.
  select * into v_draft
  from public.transaction_drafts d
  where d.id = p_draft_id
    and d.owner_user_id = v_owner
    and d.workspace_id = v_workspace
  for update;
  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_draft.lifecycle = 'confirmed' then
    return query
      select 'already_confirmed'::text, v_draft.confirmed_transaction_id;
    return;
  end if;

  if v_draft.expires_at <= timezone('utc', now()) then
    return query select 'expired'::text, null::uuid;
    return;
  end if;

  -- The app may already have created this draft's transaction without getting
  -- to mark the draft confirmed. Link to it rather than risk a second one.
  select m.transaction_id into v_transaction_id
  from public.transaction_mutations m
  where m.user_id = v_owner
    and m.idempotency_key = v_key
    and m.transaction_id is not null;

  if v_transaction_id is null then
    -- mutate_transaction authorises on auth.uid(), so act as the draft's owner
    -- for this one transaction (the setting is transaction-local).
    perform set_config('request.jwt.claim.sub', v_owner::text, true);

    select * into v_created
    from public.mutate_transaction(
      'create', v_key, null, null,
      p_type, p_amount, p_note, p_category_id, p_transaction_date,
      'telegram', v_workspace, p_account_id,
      p_currency_code, p_base_currency_code, p_exchange_rate
    );
    v_transaction_id := v_created.id;

    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  -- The draft trigger only allows pending_confirmation -> confirmed with no
  -- missing fields. Tapping Save is the review, so record that here. Both
  -- updates and the transaction above commit or roll back together.
  update public.transaction_drafts
  set lifecycle = 'pending_confirmation',
      missing_fields = '{}'::text[]
  where id = p_draft_id;

  update public.transaction_drafts
  set lifecycle = 'confirmed',
      confirmed_transaction_id = v_transaction_id
  where id = p_draft_id;

  return query select 'confirmed'::text, v_transaction_id;
end;
$$;

create or replace function public.telegram_discard_draft(
  p_provider_user_id text,
  p_draft_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_workspace uuid;
  v_lifecycle text;
begin
  select c.owner_user_id, c.workspace_id
  into v_owner, v_workspace
  from public.channel_connections c
  where c.provider = 'telegram'
    and c.provider_user_id = p_provider_user_id
    and c.status = 'active';
  if not found then
    return 'not_linked';
  end if;

  select d.lifecycle into v_lifecycle
  from public.transaction_drafts d
  where d.id = p_draft_id
    and d.owner_user_id = v_owner
    and d.workspace_id = v_workspace
  for update;
  if not found then
    return 'not_found';
  end if;

  -- Confirmed drafts are history, exactly as in the app.
  if v_lifecycle = 'confirmed' then
    return 'already_confirmed';
  end if;

  delete from public.transaction_drafts where id = p_draft_id;
  return 'discarded';
end;
$$;

-- Supabase grants EXECUTE to anon/authenticated by default; narrow it
-- explicitly instead of relying on "revoke from public".
revoke all on function public.telegram_confirm_draft(
  text, uuid, text, numeric, text, text, date, text, text, numeric, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.telegram_discard_draft(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.telegram_confirm_draft(
  text, uuid, text, numeric, text, text, date, text, text, numeric, uuid
) to service_role;
grant execute on function public.telegram_discard_draft(text, uuid)
  to service_role;

comment on function public.telegram_confirm_draft(
  text, uuid, text, numeric, text, text, date, text, text, numeric, uuid
) is
  'Service role only. Creates the draft''s transaction through mutate_transaction and confirms the draft, for an active Telegram connection that owns it.';
comment on function public.telegram_discard_draft(text, uuid) is
  'Service role only. Deletes an unconfirmed draft owned by an active Telegram connection.';

commit;
