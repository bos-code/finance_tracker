-- Finance Tracker Backend Stage 8 (receipt photos sent to the Telegram bot)
-- Purpose: hold a receipt photo that arrives before its transaction exists, and
-- attach it to the transaction the moment the draft is confirmed.
-- Prerequisite: 20260803000400_secure_receipt_storage.sql and
-- 20260805000500_transaction_review_drafts.sql.
-- Why a table: transaction_attachments needs an existing transaction, but a
-- photo arrives while the transaction is still only a draft.
-- Trust model: draft_receipts is service_role only (RLS on, no policies, no
-- grants). The bot writes it; clients never read it. The photo itself lives in
-- the same private transaction-receipts bucket, under the owner's own folder.
-- Attach on confirm: a trigger on transaction_drafts, so it happens whichever
-- client confirms the draft (the bot, or the app's review screen) and the app
-- needs no change. The attachment then shows up in the app like any receipt.
-- Cleanup: a photo for a discarded or expired draft is removed by the bot or by
-- the receipt-orphan-cleanup function; draft_id is set null (not cascaded) so
-- the record outlives a deleted draft long enough to remove its file.
-- Recovery: additive. To turn the feature off, stop the bot from writing here.

begin;

create table public.draft_receipts (
  -- Doubles as the attachment id, so the storage path and the later
  -- transaction_attachments row agree with its path check.
  id uuid primary key default gen_random_uuid(),
  draft_id uuid unique references public.transaction_drafts (id)
    on delete set null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id)
    on delete cascade,
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
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null
    check (file_size_bytes between 1 and 10485760),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  provider_media_id text check (
    provider_media_id is null or char_length(provider_media_id) <= 255
  ),
  -- A plain pointer: once attached, transaction_attachments (whose own foreign
  -- key protects the transaction) is the record that matters.
  attached_transaction_id uuid,
  attached_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint draft_receipts_attached_check check (
    (attached_at is null) = (attached_transaction_id is null)
  )
);

create index draft_receipts_unattached_idx
  on public.draft_receipts (created_at)
  where attached_at is null;

alter table public.draft_receipts enable row level security;
revoke all on public.draft_receipts from anon, authenticated;

create or replace function public.attach_draft_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.draft_receipts%rowtype;
begin
  select r.* into v_receipt
  from public.draft_receipts r
  where r.draft_id = new.id
    and r.attached_at is null
  for update;
  if not found then
    return null;
  end if;

  insert into public.transaction_attachments (
    id, owner_user_id, workspace_id, transaction_id, storage_path,
    original_filename, mime_type, file_size_bytes, file_hash,
    upload_source, provider_media_id,
    upload_status, uploaded_at, processing_status
  ) values (
    v_receipt.id, v_receipt.owner_user_id, v_receipt.workspace_id,
    new.confirmed_transaction_id, v_receipt.storage_path,
    v_receipt.original_filename, v_receipt.mime_type,
    v_receipt.file_size_bytes, v_receipt.file_hash,
    'telegram', v_receipt.provider_media_id,
    'uploaded', timezone('utc', now()), 'processed'
  )
  on conflict do nothing;

  update public.draft_receipts
  set attached_transaction_id = new.confirmed_transaction_id,
      attached_at = timezone('utc', now())
  where id = v_receipt.id;

  return null;
end;
$$;

create trigger transaction_drafts_attach_receipt
after update of lifecycle on public.transaction_drafts
for each row
when (new.lifecycle = 'confirmed' and old.lifecycle is distinct from 'confirmed')
execute function public.attach_draft_receipt();

-- Supabase grants EXECUTE to anon/authenticated by default; a trigger function
-- must never be callable by clients.
revoke all on function public.attach_draft_receipt()
  from public, anon, authenticated, service_role;

comment on table public.draft_receipts is
  'Service role only. Receipt photos held privately for a Telegram draft until it is confirmed (then attached) or discarded.';

commit;
