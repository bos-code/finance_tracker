-- Finance Tracker Backend Stage 3
-- Purpose: add profiles, personal workspaces, membership, accounts, and
-- explicit ISO currency fields to existing financial rows.
-- Prerequisite: 20260803000200_transaction_reliability.sql.
-- Compatibility: existing rows retain IDs and amounts. Legacy Stage 2 clients
-- may omit new scope fields; the insert trigger resolves the owner's personal
-- workspace, default account, and rate-1 base currency during the cutover.
-- Lock profile: table rewrites/scans occur while backfilling and setting NOT
-- NULL. Validate duration on a production-like copy before release.
-- Recovery: before app cutover, roll back the transaction. After cutover, keep
-- additive scope/currency data and use a forward repair rather than dropping it.

begin;

create table if not exists public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  numeric_code text not null unique check (numeric_code ~ '^[0-9]{3}$'),
  name text not null check (char_length(trim(name)) > 0),
  minor_unit smallint not null check (minor_unit between 0 and 4),
  symbol text not null check (char_length(symbol) between 1 and 8)
);

insert into public.currencies (code, numeric_code, name, minor_unit, symbol)
values
  ('EUR', '978', 'Euro', 2, '€'),
  ('GBP', '826', 'Pound sterling', 2, '£'),
  ('JPY', '392', 'Japanese yen', 0, '¥'),
  ('KRW', '410', 'South Korean won', 0, '₩'),
  ('NGN', '566', 'Nigerian naira', 2, '₦'),
  ('USD', '840', 'United States dollar', 2, '$'),
  ('VND', '704', 'Vietnamese đồng', 0, '₫')
on conflict (code) do update set
  numeric_code = excluded.numeric_code,
  name = excluded.name,
  minor_unit = excluded.minor_unit,
  symbol = excluded.symbol;

create table if not exists public.country_currency_defaults (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null references public.currencies (code)
    on update cascade on delete restrict
);

insert into public.country_currency_defaults (country_code, currency_code)
values
  ('AD', 'EUR'), ('AT', 'EUR'), ('BE', 'EUR'), ('BG', 'EUR'),
  ('CY', 'EUR'), ('DE', 'EUR'),
  ('EE', 'EUR'), ('ES', 'EUR'), ('FI', 'EUR'), ('FR', 'EUR'),
  ('GR', 'EUR'), ('HR', 'EUR'), ('IE', 'EUR'), ('IT', 'EUR'),
  ('LT', 'EUR'), ('LU', 'EUR'), ('LV', 'EUR'), ('MC', 'EUR'),
  ('MT', 'EUR'), ('NL', 'EUR'), ('PT', 'EUR'), ('SI', 'EUR'),
  ('SK', 'EUR'), ('SM', 'EUR'), ('VA', 'EUR'),
  ('GB', 'GBP'), ('JP', 'JPY'), ('KR', 'KRW'), ('NG', 'NGN'),
  ('US', 'USD'), ('VN', 'VND')
on conflict (country_code) do update
set currency_code = excluded.currency_code;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  country_code text check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  locale text,
  timezone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  workspace_type text not null default 'personal'
    check (workspace_type in ('personal', 'business')),
  default_currency text not null references public.currencies (code)
    on update cascade on delete restrict,
  currency_detection_source text not null
    check (
      currency_detection_source in (
        'device_region', 'manual', 'migration', 'system_default'
      )
    ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists workspaces_one_personal_owner_idx
  on public.workspaces (owner_user_id)
  where workspace_type = 'personal';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  account_type text not null
    check (
      account_type in (
        'cash', 'bank', 'savings', 'mobile_money', 'card', 'custom'
      )
    ),
  currency_code text not null references public.currencies (code)
    on update cascade on delete restrict,
  opening_balance numeric(14, 2) not null default 0,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint financial_accounts_workspace_id_unique unique (workspace_id, id)
);

create unique index if not exists financial_accounts_one_default_idx
  on public.financial_accounts (workspace_id)
  where is_default and not is_archived;
create index if not exists financial_accounts_workspace_active_idx
  on public.financial_accounts (workspace_id, is_archived, created_at);

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces
    where id = p_workspace_id
      and owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

create or replace function public.bootstrap_finance_user(
  p_user_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_existing_user boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_code text;
  v_currency_code text;
  v_currency_source text;
  v_requested_currency text;
  v_workspace_id uuid;
begin
  v_country_code := upper(nullif(trim(p_metadata ->> 'country_code'), ''));
  if v_country_code !~ '^[A-Z]{2}$' then
    v_country_code := null;
  end if;

  v_requested_currency := upper(
    coalesce(
      nullif(trim(p_metadata ->> 'currency_code'), ''),
      nullif(trim(p_metadata ->> 'currency'), '')
    )
  );

  select code into v_currency_code
  from public.currencies
  where code = v_requested_currency;

  if v_currency_code is not null then
    v_currency_source := case
      when p_metadata ->> 'currency_detection_source' = 'device_region'
        then 'device_region'
      when p_metadata ->> 'currency_detection_source' = 'system_default'
        then 'system_default'
      else 'manual'
    end;
  elsif v_country_code is not null then
    select currency_code into v_currency_code
    from public.country_currency_defaults
    where country_code = v_country_code;
    v_currency_source := case
      when v_currency_code is null then 'system_default'
      else 'device_region'
    end;
  end if;

  if v_currency_code is null then
    v_currency_code := 'USD';
    v_currency_source := case
      when p_existing_user then 'migration'
      else 'system_default'
    end;
  end if;

  insert into public.profiles (
    id,
    full_name,
    country_code,
    locale,
    timezone
  ) values (
    p_user_id,
    nullif(trim(p_metadata ->> 'full_name'), ''),
    v_country_code,
    nullif(trim(p_metadata ->> 'locale'), ''),
    nullif(trim(p_metadata ->> 'timezone'), '')
  )
  on conflict (id) do nothing;

  select id into v_workspace_id
  from public.workspaces
  where owner_user_id = p_user_id
    and workspace_type = 'personal';

  if v_workspace_id is null then
    insert into public.workspaces (
      owner_user_id,
      name,
      workspace_type,
      default_currency,
      currency_detection_source
    ) values (
      p_user_id,
      'Personal Finance',
      'personal',
      v_currency_code,
      v_currency_source
    )
    returning id into v_workspace_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  insert into public.financial_accounts (
    workspace_id,
    owner_user_id,
    name,
    account_type,
    currency_code,
    opening_balance,
    is_default
  )
  select
    v_workspace_id,
    p_user_id,
    'Cash',
    'cash',
    default_currency,
    0,
    true
  from public.workspaces
  where id = v_workspace_id
    and not exists (
      select 1
      from public.financial_accounts
      where workspace_id = v_workspace_id and is_default and not is_archived
    );

  return v_workspace_id;
end;
$$;

revoke all on function public.bootstrap_finance_user(uuid, jsonb, boolean)
  from public;

create or replace function public.handle_new_finance_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bootstrap_finance_user(new.id, new.raw_user_meta_data, false);
  return new;
end;
$$;

drop trigger if exists auth_user_finance_bootstrap on auth.users;
create trigger auth_user_finance_bootstrap
after insert on auth.users
for each row execute function public.handle_new_finance_user();

revoke all on function public.handle_new_finance_user() from public;

create or replace function public.handle_finance_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set full_name = coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    full_name
  )
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists auth_user_finance_metadata_sync on auth.users;
create trigger auth_user_finance_metadata_sync
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function public.handle_finance_user_metadata_update();

revoke all on function public.handle_finance_user_metadata_update()
  from public;

-- Provision all current users before financial rows receive NOT NULL scope.
select public.bootstrap_finance_user(id, raw_user_meta_data, true)
from auth.users;

alter table public.transactions
  add column if not exists workspace_id uuid,
  add column if not exists account_id uuid,
  add column if not exists currency_code text,
  add column if not exists base_currency_code text,
  add column if not exists base_amount numeric(14, 2),
  add column if not exists exchange_rate numeric(20, 10);

alter table public.goals
  add column if not exists workspace_id uuid;

update public.transactions as transaction
set
  workspace_id = workspace.id,
  account_id = account.id,
  currency_code = workspace.default_currency,
  base_currency_code = workspace.default_currency,
  base_amount = transaction.amount,
  exchange_rate = 1
from public.workspaces as workspace
join public.financial_accounts as account
  on account.workspace_id = workspace.id
  and account.is_default
  and not account.is_archived
where workspace.owner_user_id = transaction.user_id
  and workspace.workspace_type = 'personal'
  and transaction.workspace_id is null;

update public.goals as goal
set workspace_id = workspace.id
from public.workspaces as workspace
where workspace.owner_user_id = goal.user_id
  and workspace.workspace_type = 'personal'
  and goal.workspace_id is null;

alter table public.transactions
  alter column workspace_id set not null,
  alter column account_id set not null,
  alter column currency_code set not null,
  alter column base_currency_code set not null,
  alter column base_amount set not null,
  alter column exchange_rate set not null,
  add constraint transactions_workspace_fk
    foreign key (workspace_id) references public.workspaces (id)
    on delete restrict not valid,
  add constraint transactions_workspace_account_fk
    foreign key (workspace_id, account_id)
    references public.financial_accounts (workspace_id, id)
    on delete restrict not valid,
  add constraint transactions_currency_fk
    foreign key (currency_code) references public.currencies (code)
    on update cascade on delete restrict not valid,
  add constraint transactions_base_currency_fk
    foreign key (base_currency_code) references public.currencies (code)
    on update cascade on delete restrict not valid,
  add constraint transactions_base_amount_check check (base_amount > 0),
  add constraint transactions_exchange_rate_check check (exchange_rate > 0);

alter table public.transactions validate constraint transactions_workspace_fk;
alter table public.transactions
  validate constraint transactions_workspace_account_fk;
alter table public.transactions validate constraint transactions_currency_fk;
alter table public.transactions
  validate constraint transactions_base_currency_fk;

alter table public.goals
  alter column workspace_id set not null,
  add constraint goals_workspace_fk
    foreign key (workspace_id) references public.workspaces (id)
    on delete restrict not valid,
  add constraint goals_currency_fk
    foreign key (currency_code) references public.currencies (code)
    on update cascade on delete restrict not valid;
alter table public.goals validate constraint goals_workspace_fk;
alter table public.goals validate constraint goals_currency_fk;

create index if not exists transactions_workspace_date_idx
  on public.transactions (workspace_id, transaction_date desc)
  where lifecycle <> 'deleted';
create index if not exists transactions_account_date_idx
  on public.transactions (account_id, transaction_date desc)
  where lifecycle <> 'deleted';
create index if not exists goals_workspace_status_target_idx
  on public.goals (workspace_id, status, target_date);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.handle_row_updated_at();
drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.handle_row_updated_at();
drop trigger if exists financial_accounts_set_updated_at
  on public.financial_accounts;
create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row execute function public.handle_row_updated_at();

create or replace function public.handle_transaction_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_workspace_currency text;
begin
  if new.workspace_id is null then
    select id into new.workspace_id
    from public.workspaces
    where owner_user_id = new.user_id and workspace_type = 'personal';
  end if;

  select default_currency into v_workspace_currency
  from public.workspaces
  where id = new.workspace_id;

  if v_workspace_currency is null then
    raise exception using errcode = '23503', message = 'Workspace not found';
  end if;

  if new.account_id is null then
    select id into new.account_id
    from public.financial_accounts
    where workspace_id = new.workspace_id and is_default and not is_archived;
  end if;

  if not exists (
    select 1 from public.financial_accounts
    where id = new.account_id
      and workspace_id = new.workspace_id
      and not is_archived
  ) then
    raise exception using errcode = '23503', message = 'Account not found';
  end if;

  new.currency_code := coalesce(new.currency_code, v_workspace_currency);
  new.base_currency_code := coalesce(
    new.base_currency_code,
    v_workspace_currency
  );

  -- New rows always capture the workspace reporting currency at write time.
  -- Updates retain their historical base currency after a manual workspace
  -- currency change, so prior reporting values are never silently relabelled.
  if tg_op = 'INSERT' and new.base_currency_code <> v_workspace_currency then
    raise exception using
      errcode = '22023',
      message = 'Base currency must match the current workspace currency';
  end if;

  new.exchange_rate := coalesce(
    new.exchange_rate,
    case
      when new.currency_code = new.base_currency_code then 1
      else null
    end
  );

  if new.exchange_rate is null or new.exchange_rate <= 0 then
    raise exception using
      errcode = '22023',
      message = 'A positive exchange rate is required for mixed currencies';
  end if;

  new.base_amount := round(new.amount * new.exchange_rate, 2);
  return new;
end;
$$;

drop trigger if exists transactions_scope_write on public.transactions;
create trigger transactions_scope_write
before insert or update on public.transactions
for each row execute function public.handle_transaction_scope();

-- Replace the Stage 2 RPC with a backward-compatible signature. Old callers
-- omit the new defaulted arguments; Stage 3 callers send explicit scope.
drop function if exists public.mutate_transaction(
  text, text, uuid, bigint, text, numeric, text, text, date, text
);

create function public.mutate_transaction(
  p_operation text,
  p_idempotency_key text,
  p_transaction_id uuid default null,
  p_expected_revision bigint default null,
  p_type text default null,
  p_amount numeric default null,
  p_note text default null,
  p_category_id text default null,
  p_transaction_date date default null,
  p_source text default 'mobile_app',
  p_workspace_id uuid default null,
  p_account_id uuid default null,
  p_currency_code text default null,
  p_base_currency_code text default null,
  p_exchange_rate numeric default null
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
  v_legacy_request_payload jsonb;
  v_result public.transactions%rowtype;
  v_current_result public.transactions%rowtype;
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_operation not in ('create', 'update', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid operation';
  end if;

  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception using errcode = '22023', message = 'Invalid idempotency key';
  end if;

  if p_operation = 'create' then
    v_workspace_id := p_workspace_id;
    if v_workspace_id is null then
      select id into v_workspace_id
      from public.workspaces
      where owner_user_id = v_user_id and workspace_type = 'personal';
    end if;
    if not public.is_workspace_member(v_workspace_id) then
      raise exception using errcode = '42501', message = 'Workspace access denied';
    end if;
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
    'source', p_source,
    'workspace_id', v_workspace_id,
    'account_id', p_account_id,
    'currency_code', p_currency_code,
    'base_currency_code', p_base_currency_code,
    'exchange_rate', p_exchange_rate
  );
  v_legacy_request_payload := jsonb_build_object(
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
    user_id, idempotency_key, operation, request_payload
  ) values (
    v_user_id, p_idempotency_key, p_operation, v_request_payload
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select * into v_existing
    from public.transaction_mutations
    where user_id = v_user_id and idempotency_key = p_idempotency_key;

    if v_existing.operation <> p_operation then
      raise exception using
        errcode = '23505',
        message = 'Idempotency key was reused with another request';
    end if;

    -- A Stage 2 request journal has no workspace/currency keys. Accept its
    -- exact legacy projection after the additive migration, but continue to
    -- reject every genuinely different request using the same key.
    if v_existing.request_payload <> v_request_payload
       and not (
         not (v_existing.request_payload ? 'workspace_id')
         and v_existing.request_payload = v_legacy_request_payload
       ) then
      raise exception using
        errcode = '23505',
        message = 'Idempotency key was reused with another request';
    end if;

    if v_existing.result_snapshot is null then
      raise exception using errcode = '40001', message = 'Mutation in progress';
    end if;

    if not (v_existing.result_snapshot ? 'workspace_id') then
      select * into v_current_result
      from public.transactions
      where id = v_existing.transaction_id and user_id = v_user_id;

      if not found then
        raise exception using
          errcode = 'P0002',
          message = 'Transaction replay target not found';
      end if;

      v_result := jsonb_populate_record(
        null::public.transactions,
        v_existing.result_snapshot || jsonb_build_object(
          'workspace_id', v_current_result.workspace_id,
          'account_id', v_current_result.account_id,
          'currency_code', v_current_result.currency_code,
          'base_currency_code', v_current_result.base_currency_code,
          'base_amount', v_current_result.base_amount,
          'exchange_rate', v_current_result.exchange_rate
        )
      );
    else
      v_result := jsonb_populate_record(
        null::public.transactions,
        v_existing.result_snapshot
      );
    end if;
    return next v_result;
    return;
  end if;

  if p_operation = 'create' then
    if p_type is null or p_amount is null or p_category_id is null
       or p_transaction_date is null then
      raise exception using errcode = '23502', message = 'Missing create fields';
    end if;

    insert into public.transactions (
      user_id, workspace_id, account_id, type, amount, note, category_id,
      transaction_date, currency_code, base_currency_code, exchange_rate,
      idempotency_key, lifecycle, source
    ) values (
      v_user_id, v_workspace_id, p_account_id, p_type, p_amount,
      coalesce(p_note, ''), p_category_id, p_transaction_date,
      p_currency_code, p_base_currency_code, p_exchange_rate,
      p_idempotency_key, 'confirmed', p_source
    )
    returning * into v_result;

  elsif p_operation = 'update' then
    if p_transaction_id is null then
      raise exception using errcode = '23502', message = 'Missing transaction id';
    end if;

    update public.transactions
    set
      account_id = coalesce(p_account_id, account_id),
      type = coalesce(p_type, type),
      amount = coalesce(p_amount, amount),
      note = coalesce(p_note, note),
      category_id = coalesce(p_category_id, category_id),
      transaction_date = coalesce(p_transaction_date, transaction_date),
      currency_code = coalesce(p_currency_code, currency_code),
      exchange_rate = case
        when p_currency_code is not null and p_currency_code <> currency_code
          then p_exchange_rate
        else coalesce(p_exchange_rate, exchange_rate)
      end
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
        raise exception using errcode = '40001', message = 'Revision conflict';
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
        raise exception using errcode = '40001', message = 'Revision conflict';
      end if;
      raise exception using errcode = 'P0002', message = 'Transaction not found';
    end if;
  end if;

  update public.transaction_mutations
  set transaction_id = v_result.id, result_snapshot = to_jsonb(v_result)
  where id = v_claim_id;

  return next v_result;
  return;
end;
$$;

revoke all on function public.mutate_transaction(
  text, text, uuid, bigint, text, numeric, text, text, date, text,
  uuid, uuid, text, text, numeric
) from public;
grant execute on function public.mutate_transaction(
  text, text, uuid, bigint, text, numeric, text, text, date, text,
  uuid, uuid, text, text, numeric
) to authenticated;

create or replace function public.set_personal_workspace_currency(
  p_workspace_id uuid,
  p_currency_code text
)
returns setof public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.workspaces%rowtype;
  v_currency_code text := upper(trim(p_currency_code));
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1 from public.currencies where code = v_currency_code
  ) then
    raise exception using errcode = '22023', message = 'Unsupported currency';
  end if;

  update public.workspaces
  set
    default_currency = v_currency_code,
    currency_detection_source = 'manual'
  where id = p_workspace_id
    and owner_user_id = auth.uid()
    and workspace_type = 'personal'
  returning * into v_result;

  if not found then
    raise exception using errcode = 'P0002', message = 'Workspace not found';
  end if;

  update public.financial_accounts
  set currency_code = v_currency_code
  where workspace_id = p_workspace_id and is_default and not is_archived;

  return next v_result;
  return;
end;
$$;

revoke all on function public.set_personal_workspace_currency(uuid, text)
  from public;
grant execute on function public.set_personal_workspace_currency(uuid, text)
  to authenticated;

alter table public.currencies enable row level security;
alter table public.country_currency_defaults enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.financial_accounts enable row level security;

drop policy if exists "Currencies are readable" on public.currencies;
create policy "Currencies are readable"
on public.currencies for select using (true);
drop policy if exists "Country currency defaults are readable"
  on public.country_currency_defaults;
create policy "Country currency defaults are readable"
on public.country_currency_defaults for select using (true);

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Members can view workspaces" on public.workspaces;
create policy "Members can view workspaces"
on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists "Owners can update workspaces" on public.workspaces;
-- Workspace preference changes cross guarded RPCs so related account updates
-- remain atomic; no direct workspace mutation policy is exposed to clients.

drop policy if exists "Users can view their memberships"
  on public.workspace_members;
create policy "Users can view their memberships"
on public.workspace_members for select using (auth.uid() = user_id);

drop policy if exists "Members can view accounts"
  on public.financial_accounts;
create policy "Members can view accounts"
on public.financial_accounts for select
using (public.is_workspace_member(workspace_id));
drop policy if exists "Owners can insert accounts"
  on public.financial_accounts;
create policy "Owners can insert accounts"
on public.financial_accounts for insert
with check (
  auth.uid() = owner_user_id and public.is_workspace_owner(workspace_id)
);
drop policy if exists "Owners can update accounts"
  on public.financial_accounts;
create policy "Owners can update accounts"
on public.financial_accounts for update
using (public.is_workspace_owner(workspace_id))
with check (
  auth.uid() = owner_user_id and public.is_workspace_owner(workspace_id)
);
drop policy if exists "Owners can delete accounts"
  on public.financial_accounts;
create policy "Owners can delete accounts"
on public.financial_accounts for delete
using (public.is_workspace_owner(workspace_id));

drop policy if exists "Users can view their own transactions"
  on public.transactions;
create policy "Workspace members can view transactions"
on public.transactions for select
using (public.is_workspace_member(workspace_id));
drop policy if exists "Users can insert their own transactions"
  on public.transactions;
create policy "Owners can insert transactions"
on public.transactions for insert
with check (
  auth.uid() = user_id and public.is_workspace_member(workspace_id)
);
drop policy if exists "Users can update their own transactions"
  on public.transactions;
create policy "Owners can update transactions"
on public.transactions for update
using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));
drop policy if exists "Users can delete their own transactions"
  on public.transactions;
create policy "Owners can delete transactions"
on public.transactions for delete
using (auth.uid() = user_id and public.is_workspace_member(workspace_id));

drop policy if exists "Users can view their own goals" on public.goals;
create policy "Workspace members can view goals"
on public.goals for select using (public.is_workspace_member(workspace_id));
drop policy if exists "Users can insert their own goals" on public.goals;
create policy "Owners can insert goals"
on public.goals for insert
with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));
drop policy if exists "Users can update their own goals" on public.goals;
create policy "Owners can update goals"
on public.goals for update
using (auth.uid() = user_id and public.is_workspace_member(workspace_id))
with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));
drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Owners can delete goals"
on public.goals for delete
using (auth.uid() = user_id and public.is_workspace_member(workspace_id));

grant select on public.currencies, public.country_currency_defaults
  to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.financial_accounts
  to authenticated;
grant select, insert, update, delete on public.transactions, public.goals
  to authenticated;

comment on table public.profiles is
  'User-owned regional profile data; authentication remains in auth.users.';
comment on table public.workspaces is
  'Personal or future business boundary for all financial records.';
comment on table public.financial_accounts is
  'Workspace-scoped cash, bank, savings, mobile-money, card, or custom account.';

commit;
