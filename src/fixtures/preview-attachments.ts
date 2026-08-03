import type { TransactionAttachmentContract } from "@/contracts/backend";
import { PREVIEW_USER, PREVIEW_WORKSPACE_ID } from "@/fixtures/preview-data";
import type { ReceiptUploadInput } from "@/services/supabase/attachment-service";

const timestamp = new Date().toISOString();

let previewAttachments: TransactionAttachmentContract[] = [
  {
    created_at: timestamp,
    file_hash: "a".repeat(64),
    file_size_bytes: 184_320,
    id: "preview-attachment-studio",
    last_upload_error: null,
    mime_type: "application/pdf",
    original_filename: "studio-rent-invoice.pdf",
    owner_user_id: PREVIEW_USER.uid,
    page_count: 2,
    processing_status: "uploaded",
    provider_media_id: null,
    storage_bucket: "transaction-receipts",
    storage_path:
      `${PREVIEW_USER.uid}/${PREVIEW_WORKSPACE_ID}/` +
      "preview-attachment-studio/studio-rent-invoice.pdf",
    transaction_id: "preview-studio",
    updated_at: timestamp,
    upload_attempts: 1,
    uploaded_at: timestamp,
    upload_source: "mobile_app",
    upload_status: "uploaded",
    workspace_id: PREVIEW_WORKSPACE_ID,
  },
];

export async function listPreviewAttachments(transactionId: string) {
  return previewAttachments.filter(
    (attachment) => attachment.transaction_id === transactionId,
  );
}

export async function uploadPreviewAttachment(input: ReceiptUploadInput) {
  input.onProgress?.({
    fraction: 0.25,
    label: "Registering the private file path",
    stage: "registering",
  });
  input.onProgress?.({
    fraction: 0.7,
    label: "Uploading to the private vault",
    stage: "uploading",
  });
  const now = new Date().toISOString();
  const id = `preview-attachment-${Date.now()}`;
  const attachment: TransactionAttachmentContract = {
    created_at: now,
    file_hash: input.file.fileHash,
    file_size_bytes: input.file.size,
    id,
    last_upload_error: null,
    mime_type: input.file.mimeType,
    original_filename: input.file.originalFilename,
    owner_user_id: input.ownerUserId,
    page_count: input.file.pageCount,
    processing_status: "uploaded",
    provider_media_id: null,
    storage_bucket: "transaction-receipts",
    storage_path:
      `${input.ownerUserId}/${input.workspaceId}/${id}/` +
      input.file.safeFilename,
    transaction_id: input.transaction.id,
    updated_at: now,
    upload_attempts: 1,
    uploaded_at: now,
    upload_source: "mobile_app",
    upload_status: "uploaded",
    workspace_id: input.workspaceId,
  };
  previewAttachments = [attachment, ...previewAttachments];
  input.onProgress?.({
    fraction: 1,
    label: "Stored privately",
    stage: "complete",
  });
  return attachment;
}

export async function retryPreviewAttachment(
  attachment: TransactionAttachmentContract,
) {
  const updated = {
    ...attachment,
    last_upload_error: null,
    processing_status: "uploaded" as const,
    updated_at: new Date().toISOString(),
    upload_attempts: attachment.upload_attempts + 1,
    uploaded_at: new Date().toISOString(),
    upload_status: "uploaded" as const,
  };
  previewAttachments = previewAttachments.map((candidate) =>
    candidate.id === attachment.id ? updated : candidate,
  );
  return updated;
}

export async function deletePreviewAttachment(attachmentId: string) {
  previewAttachments = previewAttachments.filter(
    (attachment) => attachment.id !== attachmentId,
  );
}
