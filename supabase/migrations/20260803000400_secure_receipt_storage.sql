-- Finance Tracker Backend Stage 4
-- Purpose: add private, transaction-owned receipt storage and retryable
-- attachment metadata for PDF, JPEG, PNG, and WebP documents.
-- Prerequisite: 20260803000300_workspace_currency_foundation.sql.
-- Compatibility: additive; Stage 1–3 clients do not read this table or bucket.
-- Lock profile: short DDL locks on transactions plus Storage policy changes.
-- Recovery: before app cutover, roll back the transaction. After uploads begin,
-- disable attachment UI/policies first and retain private objects and metadata
-- until a verified export or forward repair is complete.

begin;

alter table public.transactions
  add constraint transactions_workspace_owner_id_unique
  unique (workspace_id, user_id, id);

create table public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  workspace_id uuid not null references public.workspaces (id)
    on delete restrict,
  transaction_id uuid not null,
  storage_bucket text not null default 'transaction-receipts'
    check (storage_bucket = 'transaction-receipts'),
  storage_path text not null unique
    check (
      storage_path like
        owner_user_id::text || '/' || workspace_id::text || '/' ||
        id::text || '/%'
      and position('..' in storage_path) = 0
    ),
  original_filename text not null
    check (char_length(trim(original_filename)) between 1 and 255),
  mime_type text not null
    check (
      mime_type in (
        'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
      )
    ),
  file_size_bytes bigint not null
    check (file_size_bytes between 1 and 10485760),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  page_count smallint,
  upload_source text not null default 'mobile_app'
    check (
      upload_source in (
        'mobile_app', 'telegram', 'whatsapp', 'web_dashboard',
        'import', 'system'
      )
    ),
  provider_media_id text check (
    provider_media_id is null or char_length(provider_media_id) <= 255
  ),
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  upload_attempts smallint not null default 0
    check (upload_attempts between 0 and 100),
  last_upload_error text check (
    last_upload_error is null or char_length(last_upload_error) <= 500
  ),
  processing_status text
    check (
      processing_status is null or processing_status in (
        'uploaded', 'extracting_text', 'processed', 'failed', 'needs_review'
      )
    ),
  uploaded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transaction_attachments_transaction_fk
    foreign key (workspace_id, owner_user_id, transaction_id)
    references public.transactions (workspace_id, user_id, id)
    on delete restrict,
  constraint transaction_attachments_pdf_pages_check check (
    (mime_type = 'application/pdf' and page_count between 1 and 25)
    or (mime_type <> 'application/pdf' and page_count is null)
  ),
  constraint transaction_attachments_upload_state_check check (
    (upload_status = 'uploaded' and uploaded_at is not null
      and processing_status is not null)
    or (upload_status <> 'uploaded' and uploaded_at is null)
  ),
  constraint transaction_attachments_failed_error_check check (
    upload_status <> 'failed' or last_upload_error is not null
  ),
  constraint transaction_attachments_transaction_hash_unique
    unique (owner_user_id, transaction_id, file_hash)
);

create index transaction_attachments_transaction_created_idx
  on public.transaction_attachments (
    workspace_id, transaction_id, created_at desc
  );
create index transaction_attachments_stale_upload_idx
  on public.transaction_attachments (upload_status, updated_at)
  where upload_status in ('pending', 'uploading', 'failed');

create or replace function public.handle_transaction_attachment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.transactions
      where id = new.transaction_id
        and workspace_id = new.workspace_id
        and user_id = new.owner_user_id
        and lifecycle <> 'deleted'
    ) then
      raise exception using
        errcode = '23503',
        message = 'Active transaction not found';
    end if;
  else
    if new.owner_user_id <> old.owner_user_id
       or new.workspace_id <> old.workspace_id
       or new.transaction_id <> old.transaction_id
       or new.storage_bucket <> old.storage_bucket
       or new.storage_path <> old.storage_path
       or new.original_filename <> old.original_filename
       or new.file_hash <> old.file_hash
       or new.mime_type <> old.mime_type
       or new.file_size_bytes <> old.file_size_bytes
       or new.page_count is distinct from old.page_count
       or new.upload_source <> old.upload_source
       or new.provider_media_id is distinct from old.provider_media_id then
      raise exception using
        errcode = '22023',
        message = 'Attachment identity is immutable';
    end if;
  end if;

  new.updated_at := timezone('utc', now());

  if new.upload_status = 'uploaded' then
    new.uploaded_at := coalesce(new.uploaded_at, timezone('utc', now()));
    new.processing_status := coalesce(new.processing_status, 'uploaded');
    new.last_upload_error := null;
  else
    new.uploaded_at := null;
    new.processing_status := null;
    if new.upload_status in ('pending', 'uploading') then
      new.last_upload_error := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger transaction_attachments_handle_write
before insert or update on public.transaction_attachments
for each row execute function public.handle_transaction_attachment_write();

revoke all on function public.handle_transaction_attachment_write()
  from public;

alter table public.transaction_attachments enable row level security;

create policy "Owners can view transaction attachments"
on public.transaction_attachments for select to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

create policy "Owners can create transaction attachments"
on public.transaction_attachments for insert to authenticated
with check (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

create policy "Owners can update transaction attachments"
on public.transaction_attachments for update to authenticated
using (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
)
with check (
  auth.uid() = owner_user_id
  and public.is_workspace_member(workspace_id)
);

grant select, insert, update on public.transaction_attachments
  to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'transaction-receipts',
  'transaction-receipts',
  false,
  10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can upload private transaction receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'transaction-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.transaction_attachments as attachment
    where attachment.owner_user_id = auth.uid()
      and attachment.storage_bucket = 'transaction-receipts'
      and attachment.storage_path = name
      and attachment.upload_status in ('pending', 'uploading', 'failed')
  )
);

create policy "Owners can view private transaction receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'transaction-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.transaction_attachments as attachment
    where attachment.owner_user_id = auth.uid()
      and attachment.storage_bucket = 'transaction-receipts'
      and attachment.storage_path = name
  )
);

create policy "Owners can retry private transaction receipts"
on storage.objects for update to authenticated
using (
  bucket_id = 'transaction-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'transaction-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.transaction_attachments as attachment
    where attachment.owner_user_id = auth.uid()
      and attachment.storage_bucket = 'transaction-receipts'
      and attachment.storage_path = name
      and attachment.upload_status in ('pending', 'uploading', 'failed')
  )
);

create policy "Owners can remove private transaction receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'transaction-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.transaction_attachments as attachment
    where attachment.owner_user_id = auth.uid()
      and attachment.storage_bucket = 'transaction-receipts'
      and attachment.storage_path = name
  )
);

create or replace function public.delete_transaction_attachment_record(
  p_attachment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.transaction_attachments%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_attachment
  from public.transaction_attachments
  where id = p_attachment_id and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Attachment not found';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id = v_attachment.storage_bucket
      and name = v_attachment.storage_path
  ) then
    raise exception using
      errcode = '55000',
      message = 'Private object must be removed before attachment metadata';
  end if;

  delete from public.transaction_attachments
  where id = p_attachment_id and owner_user_id = auth.uid();
end;
$$;

revoke all on function public.delete_transaction_attachment_record(uuid)
  from public;
grant execute on function public.delete_transaction_attachment_record(uuid)
  to authenticated;

comment on table public.transaction_attachments is
  'Owner-only receipt metadata backed by the private transaction-receipts bucket.';
comment on column public.transaction_attachments.file_hash is
  'Lowercase SHA-256 of the original bytes for duplicate detection.';
comment on column public.transaction_attachments.page_count is
  'Required for PDFs and capped at 25 pages; null for supported image files.';

commit;
