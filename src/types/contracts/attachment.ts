/**
 * Canonical transaction-attachment contract (PLAN_BACKEND.md Stage 4).
 * No Supabase Storage bucket or `transaction_attachments` table exists
 * today. This is the target shape for Stage 4.
 */

export const AttachmentProcessingStatus = {
  Uploaded: "uploaded",
  ExtractingText: "extracting_text",
  Processed: "processed",
  Failed: "failed",
  NeedsReview: "needs_review",
} as const;

export type AttachmentProcessingStatus =
  (typeof AttachmentProcessingStatus)[keyof typeof AttachmentProcessingStatus];

export const AttachmentUploadSource = {
  MobileApp: "mobile_app",
  Telegram: "telegram",
  WhatsApp: "whatsapp",
  WebDashboard: "web_dashboard",
} as const;

export type AttachmentUploadSource = (typeof AttachmentUploadSource)[keyof typeof AttachmentUploadSource];

export type TransactionAttachment = {
  id: string;
  workspace_id: string;
  user_id: string;
  /** Null while attached to a draft rather than a confirmed transaction. */
  transaction_id: string | null;
  draft_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  file_hash: string;
  upload_source: AttachmentUploadSource;
  /** Telegram file_id / WhatsApp media_id, keyed by provider. */
  provider_media_id: string | null;
  processing_status: AttachmentProcessingStatus;
  created_at: string;
  updated_at: string;
};

export type TransactionAttachmentInsert = Omit<
  TransactionAttachment,
  "id" | "created_at" | "updated_at" | "processing_status"
> & {
  processing_status?: AttachmentProcessingStatus;
};
