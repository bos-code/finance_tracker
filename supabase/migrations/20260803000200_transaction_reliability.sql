-- Finance Tracker Backend Stage 2
-- Purpose: make transaction create/update/delete idempotent and revision-aware.
-- Prerequisite: 20260803000100_current_schema_baseline.sql.
-- Compatibility: existing rows receive confirmed/mobile defaults; owner-only
-- legacy write policies remain during the installed-client cutover window.
-- Lock profile: short table locks for additive columns and constraints. The
-- current table is expected to be small; validate duration on a production-like
-- copy before release.
-- Recovery: before client cutover, rollback the transaction. After cutover,
-- keep additive columns and issue a forward repair to preserve mutation logs.

begin;

alter table public.transactions
  add column if not exists idempotency_key text,
  add column if not exists lifecycle text not null default 'confirmed',
  add column if not exists source text not null default 'mobile_app',
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.transactions
  drop constraint if exists transactions_idempotency_key_check,
  add constraint transactions_idempotency_key_check
    check (
      idempotency_key is null
      or char_length(idempotency_key) between 16 and 128
    ),
  drop constraint if exists transactions_lifecycle_check,
  add constraint transactions_lifecycle_check
    check (
      lifecycle in (
        'draft',
        'pending_confirmation',
        'confirmed',
        'needs_review',
        'reversed',
        'deleted'
      )
    ),
  drop constraint if exists transactions_source_check,
  add constraint transactions_source_check
    check (
      source in (
        'mobile_app',
        'telegram',
        'whatsapp',
        'web_dashboard',
        'import',
        'system'
      )
    ),
  drop constraint if exists transactions_revision_check,
  add constraint transactions_revision_check check (revision > 0),
  drop constraint if exists transactions_deleted_state_check,
  add constraint transactions_deleted_state_check
    check (
      (lifecycle = 'deleted' and deleted_at is not null)
      or (lifecycle <> 'deleted' and deleted_at is null)
    );

alter table public.transactions
  drop constraint if exists transactions_user_id_idempotency_key_key;
alter table public.transactions
  add constraint transactions_user_id_idempotency_key_key
  unique (user_id, idempotency_key);

create index if not exists transactions_user_active_date_idx
  on public.transactions (user_id, transaction_date desc)
  where lifecycle <> 'deleted';

create table if not exists public.transaction_mutations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  request_payload jsonb not null,
  transaction_id uuid,
  result_snapshot jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint transaction_mutations_idempotency_key_check
    check (char_length(idempotency_key) between 16 and 128),
  constraint transaction_mutations_user_key_unique
    unique (user_id, idempotency_key)
);

create index if not exists transaction_mutations_user_created_idx
  on public.transaction_mutations (user_id, created_at desc);

alter table public.transaction_mutations enable row level security;

-- No direct table policies are created. Authenticated clients mutate through
-- the audited function below; its explicit auth.uid() checks are the boundary.

create or replace function public.handle_transaction_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  new.revision = old.revision + 1;

  if new.lifecycle = 'deleted' and new.deleted_at is null then
    new.deleted_at = timezone('utc', now());
  elsif new.lifecycle <> 'deleted' then
    new.deleted_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
drop trigger if exists transactions_handle_write on public.transactions;
create trigger transactions_handle_write
before update on public.transactions
for each row execute function public.handle_transaction_write();

create or replace function public.mutate_transaction(
  p_operation text,
  p_idempotency_key text,
  p_transaction_id uuid default null,
  p_expected_revision bigint default null,
  p_type text default null,
  p_amount numeric default null,
  p_note text default null,
  p_category_id text default null,
  p_transaction_date date default null,
  p_source text default 'mobile_app'
)
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_claim_id uuid;
  v_existing public.transaction_mutations%rowtype;
  v_request_payload jsonb;
  v_result public.transactions%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if p_operation not in ('create', 'update', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid operation';
  end if;

  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception using errcode = '22023', message = 'Invalid idempotency key';
  end if;

  v_request_payload := jsonb_build_object(
    'operation', p_operation,
    'transaction_id', p_transaction_id,
    'expected_revision', p_expected_revision,
    'type', p_type,
    'amount', p_amount,
    'note', p_note,
    'category_id', p_category_id,
    'transaction_date', p_transaction_date,
    'source', p_source
  );

  insert into public.transaction_mutations (
    user_id,
    idempotency_key,
    operation,
    request_payload
  )
  values (v_user_id, p_idempotency_key, p_operation, v_request_payload)
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select * into v_existing
    from public.transaction_mutations
    where user_id = v_user_id
      and idempotency_key = p_idempotency_key;

    if v_existing.operation <> p_operation
       or v_existing.request_payload <> v_request_payload then
      raise exception using
        errcode = '23505',
        message = 'Idempotency key was reused with another request';
    end if;

    if v_existing.result_snapshot is null then
      raise exception using
        errcode = '40001',
        message = 'Mutation is already in progress';
    end if;

    v_result := jsonb_populate_record(
      null::public.transactions,
      v_existing.result_snapshot
    );
    return next v_result;
    return;
  end if;

  if p_operation = 'create' then
    if p_type is null
       or p_amount is null
       or p_category_id is null
       or p_transaction_date is null then
      raise exception using errcode = '23502', message = 'Missing create fields';
    end if;

    insert into public.transactions (
      user_id,
      type,
      amount,
      note,
      category_id,
      transaction_date,
      idempotency_key,
      lifecycle,
      source
    ) values (
      v_user_id,
      p_type,
      p_amount,
      coalesce(p_note, ''),
      p_category_id,
      p_transaction_date,
      p_idempotency_key,
      'confirmed',
      p_source
    )
    returning * into v_result;

  elsif p_operation = 'update' then
    if p_transaction_id is null then
      raise exception using errcode = '23502', message = 'Missing transaction id';
    end if;

    update public.transactions
    set
      type = coalesce(p_type, type),
      amount = coalesce(p_amount, amount),
      note = coalesce(p_note, note),
      category_id = coalesce(p_category_id, category_id),
      transaction_date = coalesce(p_transaction_date, transaction_date)
    where id = p_transaction_id
      and user_id = v_user_id
      and lifecycle <> 'deleted'
      and (p_expected_revision is null or revision = p_expected_revision)
    returning * into v_result;

    if not found then
      if exists (
        select 1 from public.transactions
        where id = p_transaction_id
          and user_id = v_user_id
          and lifecycle <> 'deleted'
      ) then
        raise exception using
          errcode = '40001',
          message = 'Transaction revision conflict';
      end if;
      raise exception using errcode = 'P0002', message = 'Transaction not found';
    end if;

  else
    if p_transaction_id is null then
      raise exception using errcode = '23502', message = 'Missing transaction id';
    end if;

    update public.transactions
    set lifecycle = 'deleted'
    where id = p_transaction_id
      and user_id = v_user_id
      and lifecycle <> 'deleted'
      and (p_expected_revision is null or revision = p_expected_revision)
    returning * into v_result;

    if not found then
      if exists (
        select 1 from public.transactions
        where id = p_transaction_id and user_id = v_user_id
      ) then
        raise exception using
          errcode = '40001',
          message = 'Transaction revision conflict';
      end if;
      raise exception using errcode = 'P0002', message = 'Transaction not found';
    end if;
  end if;

  update public.transaction_mutations
  set
    transaction_id = v_result.id,
    result_snapshot = to_jsonb(v_result)
  where id = v_claim_id;

  return next v_result;
  return;
end;
$$;

revoke all on function public.mutate_transaction(
  text,
  text,
  uuid,
  bigint,
  text,
  numeric,
  text,
  text,
  date,
  text
) from public;
grant execute on function public.mutate_transaction(
  text,
  text,
  uuid,
  bigint,
  text,
  numeric,
  text,
  text,
  date,
  text
) to authenticated;

-- Keep the existing owner-scoped direct-write policies during the mobile
-- compatibility window. The Stage 2 client no longer uses them, but removing
-- them in the same release would strand older installed clients. Revoke them
-- in a later minimum-version cutover after adoption is verified.

comment on table public.transaction_mutations is
  'Server-owned idempotency journal for transaction mutations.';
comment on function public.mutate_transaction is
  'Authenticated idempotent create/update/soft-delete boundary with optimistic revision checks.';

commit;
