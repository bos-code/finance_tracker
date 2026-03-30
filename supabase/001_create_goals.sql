create extension if not exists pgcrypto;

create or replace function public.set_goals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  goal_type text not null default 'saving' check (goal_type in ('saving', 'item')),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  currency_code text not null default 'USD',
  target_date date,
  notes text,
  icon_name text not null default 'target',
  color text not null default '#2563eb',
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists goals_user_id_idx
  on public.goals (user_id);

create index if not exists goals_user_status_target_date_idx
  on public.goals (user_id, status, target_date);

alter table public.goals enable row level security;

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row
execute function public.set_goals_updated_at();

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
