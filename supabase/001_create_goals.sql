begin;

create extension if not exists pgcrypto;

create or replace function public.handle_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_goal_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at = timezone('utc', now());
  elsif new.status = 'active' then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('Expenditure', 'Revenue')),
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  category_id text not null check (char_length(trim(category_id)) > 0),
  transaction_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

create index if not exists transactions_user_type_date_idx
  on public.transactions (user_id, type, transaction_date desc);

create index if not exists transactions_user_category_date_idx
  on public.transactions (user_id, category_id, transaction_date desc);

alter table public.transactions enable row level security;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.handle_row_updated_at();

drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
on public.transactions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions"
on public.transactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
on public.transactions
for delete
using (auth.uid() = user_id);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  goal_type text not null default 'saving' check (goal_type in ('saving', 'item')),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  currency_code text not null default 'USD' check (char_length(trim(currency_code)) = 3),
  target_date date,
  notes text,
  icon_name text not null default 'target' check (char_length(trim(icon_name)) > 0),
  color text not null default '#2563eb' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_completion_state_check
    check (
      (status = 'active' and completed_at is null)
      or (status = 'completed' and completed_at is not null)
    )
);

create index if not exists goals_user_id_idx
  on public.goals (user_id);

create index if not exists goals_user_status_target_date_idx
  on public.goals (user_id, status, target_date);

create index if not exists goals_user_created_at_idx
  on public.goals (user_id, created_at desc);

alter table public.goals enable row level security;

drop trigger if exists goals_set_updated_at on public.goals;
drop trigger if exists goals_handle_write on public.goals;
create trigger goals_handle_write
before insert or update on public.goals
for each row
execute function public.handle_goal_write();

drop policy if exists "Users can view their own goals" on public.goals;
create policy "Users can view their own goals"
on public.goals
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own goals" on public.goals;
create policy "Users can insert their own goals"
on public.goals
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
on public.goals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
on public.goals
for delete
using (auth.uid() = user_id);

comment on table public.transactions is
'Transaction records used by the Home, Calendar, and Stats screens.';

comment on table public.goals is
'Savings and item goals used by the Goals screen.';

comment on column public.transactions.transaction_date is
'Local calendar date in YYYY-MM-DD form from the mobile app.';

comment on column public.goals.completed_at is
'Managed alongside goal status. Active goals keep this null.';

-- The rest of the current account state (full name, theme, currency) is stored
-- in Supabase Auth user metadata via auth.updateUser(),
-- while app lock remains device-local and is not synced through Supabase.
-- so no extra public profile/settings table is required for this version.

commit;
