-- Finance Tracker Backend Stage 5
-- Purpose: persist deterministic parser output as review-first transaction
-- drafts with duplicate-source protection, expiry, and workspace-scoped RLS.
-- Prerequisite: 20260803000400_secure_receipt_storage.sql.
-- Compatibility: additive; existing mobile clients do not read this table.
-- Recovery: before draft-enabled clients ship, roll back the transaction. After
-- cutover, disable draft creation and use a forward repair rather than dropping
-- user review data.

begin;

create table public.transaction_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
  source text not null default 'mobile_app'
    check (
      source in (
        'mobile_app', 'telegram', 'whatsapp', 'web_dashboard',
        'import', 'system'
      )
    ),
  source_message_id text,
  original_text text not null
    check (char_length(trim(original_text)) between 1 and 4000),
  lifecycle text not null default 'needs_review'
    check (
      lifecycle in (
        'draft', 'pending_confirmation', 'needs_review', 'confirmed'
      )
    ),
  extracted_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extracted_fields) = 'object'),
  missing_fields text[] not null default '{}'::text[],
  parser_version text not null
    check (char_length(trim(parser_version)) between 1 and 64),
  overall_confidence numeric(4, 3) not null default 0
    check (overall_confidence between 0 and 1),
  expires_at timestamptz not null
    default (timezone('utc', now()) + interval '30 days'),
  confirmed_transaction_id uuid references public.transactions (id)
    on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transaction_drafts_source_message_check check (
    source_message_id is null
    or char_length(trim(source_message_id)) between 1 and 255
  ),
  constraint transaction_drafts_expiry_check check (expires_at > created_at),
  constraint transaction_drafts_confirmation_check check (
    (lifecycle = 'confirmed' and confirmed_transaction_id is not null)
    or (lifecycle <> 'confirmed' and confirmed_transaction_id is null)
  )
);

create unique index transaction_drafts_source_message_unique_idx
  on public.transaction_drafts (owner_user_id, source, source_message_id)
  where source_message_id is not null;

create index transaction_drafts_workspace_lifecycle_created_idx
  on public.transaction_drafts (
    workspace_id, lifecycle, created_at desc
  );

create index transaction_drafts_owner_expiry_idx
  on public.transaction_drafts (owner_user_id, expires_at)
  where confirmed_transaction_id is null;

create or replace function public.handle_transaction_draft_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = new.workspace_id
      and user_id = new.owner_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Draft owner is not a workspace member';
  end if;

  if tg_op = 'UPDATE' then
    if old.lifecycle = 'confirmed' then
      raise exception using
        errcode = '22023',
        message = 'Confirmed draft history is immutable';
    end if;

    if new.owner_user_id <> old.owner_user_id
       or new.workspace_id <> old.workspace_id
       or new.source <> old.source
       or new.source_message_id is distinct from old.source_message_id
       or new.original_text <> old.original_text
       or new.parser_version <> old.parser_version then
      raise exception using
        errcode = '22023',
        message = 'Draft source identity is immutable';
    end if;
  end if;

  new.missing_fields := array(
    select distinct trim(raw_field_name) as field_name
    from unnest(new.missing_fields) as raw_field_name
    where char_length(trim(raw_field_name)) > 0
    order by field_name
  );

  if new.lifecycle = 'confirmed' then
    if tg_op <> 'UPDATE' then
      raise exception using
        errcode = '22023',
        message = 'Draft confirmation requires an existing reviewed draft';
    end if;

    if old.lifecycle <> 'pending_confirmation'
       or cardinality(new.missing_fields) > 0
       or new.expires_at <= timezone('utc', now()) then
      raise exception using
        errcode = '22023',
        message = 'Draft is not ready for confirmation';
    end if;
  end if;

  if new.confirmed_transaction_id is not null and not exists (
    select 1
    from public.transactions
    where id = new.confirmed_transaction_id
      and workspace_id = new.workspace_id
      and user_id = new.owner_user_id
      and lifecycle <> 'deleted'
  ) then
    raise exception using
      errcode = '23503',
      message = 'Confirmed transaction does not belong to the draft owner and workspace';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger transaction_drafts_handle_write
before insert or update on public.transaction_drafts
for each row execute function public.handle_transaction_draft_write();

revoke all on function public.handle_transaction_draft_write() from public;

alter table public.transaction_drafts enable row level security;

create policy "Owners can view transaction drafts"
on public.transaction_drafts for select to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

create policy "Owners can create transaction drafts"
on public.transaction_drafts for insert to authenticated
with check (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

create policy "Owners can update transaction drafts"
on public.transaction_drafts for update to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

create policy "Owners can delete unconfirmed transaction drafts"
on public.transaction_drafts for delete to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
  and confirmed_transaction_id is null
);

grant select, insert, update, delete on public.transaction_drafts
  to authenticated;

comment on table public.transaction_drafts is
  'Review-first transaction candidates produced by deterministic or controlled AI parsing.';
comment on column public.transaction_drafts.extracted_fields is
  'Field values, confidence scores, and parser reasons; never automatically treated as confirmed finance data.';

commit;
