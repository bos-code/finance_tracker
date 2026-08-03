import * as Crypto from "expo-crypto";

import type {
  TransactionAttachmentContract,
  TransactionRecord,
} from "@/contracts/backend";
import {
  RECEIPT_BUCKET,
  receiptStoragePath,
} from "@/features/attachments/file-validation";
import type { PreparedReceiptFile } from "@/services/attachments/receipt-file-service";
import { BackendError, toBackendError } from "@/services/backend/errors";

import { supabaseClient } from "./supabase-client";

export type ReceiptUploadStage =
  | "registering"
  | "uploading"
  | "securing"
  | "complete";

export type ReceiptUploadProgress = {
  fraction: number;
  label: string;
  stage: ReceiptUploadStage;
};

export type ReceiptUploadInput = {
  file: PreparedReceiptFile;
  ownerUserId: string;
  transaction: TransactionRecord;
  workspaceId: string;
  onProgress?: (progress: ReceiptUploadProgress) => void;
};

function attachmentsTable() {
  return supabaseClient.from("transaction_attachments");
}

function progress(
  input: ReceiptUploadInput,
  stage: ReceiptUploadStage,
  fraction: number,
  label: string,
) {
  input.onProgress?.({ fraction, label, stage });
}

function safeUploadError(error: unknown) {
  return toBackendError(error, "ATTACHMENT_UPLOAD_FAILED").message.slice(0, 500);
}

async function markUploadFailed(attachmentId: string, error: unknown) {
  await attachmentsTable()
    .update({
      last_upload_error: safeUploadError(error),
      upload_status: "failed",
    })
    .eq("id", attachmentId);
}

async function uploadRegisteredAttachment({
  attachment,
  file,
  input,
  upsert,
}: {
  attachment: TransactionAttachmentContract;
  file: PreparedReceiptFile;
  input: ReceiptUploadInput;
  upsert: boolean;
}) {
  const attempts = attachment.upload_attempts + 1;
  const { data: uploading, error: updateError } = await attachmentsTable()
    .update({
      last_upload_error: null,
      upload_attempts: attempts,
      upload_status: "uploading",
    })
    .eq("id", attachment.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  progress(input, "uploading", 0.58, "Uploading to the private vault");
  const { error: uploadError } = await supabaseClient.storage
    .from(RECEIPT_BUCKET)
    .upload(uploading.storage_path, file.bytes, {
      cacheControl: "3600",
      contentType: file.mimeType,
      upsert,
    });
  if (uploadError) throw uploadError;

  progress(input, "securing", 0.88, "Sealing the attachment record");
  const { data: saved, error: finalizeError } = await attachmentsTable()
    .update({
      last_upload_error: null,
      processing_status: "uploaded",
      upload_status: "uploaded",
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", attachment.id)
    .select("*")
    .single();
  if (finalizeError) throw finalizeError;

  progress(input, "complete", 1, "Stored privately");
  return saved;
}

export async function listTransactionAttachments(
  workspaceId: string,
  transactionId: string,
) {
  const { data, error } = await attachmentsTable()
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
  if (error) throw toBackendError(error, "ATTACHMENT_READ_FAILED");
  return data ?? [];
}

export async function uploadTransactionAttachment(
  input: ReceiptUploadInput,
) {
  if (
    input.transaction.id.startsWith("local_") ||
    input.transaction.id.startsWith("opt_")
  ) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Sync this transaction before attaching a private receipt.",
    });
  }
  if (
    input.transaction.user_id !== input.ownerUserId ||
    input.transaction.workspace_id !== input.workspaceId
  ) {
    throw new BackendError({ code: "PERMISSION_DENIED" });
  }

  progress(input, "registering", 0.12, "Checking for a duplicate receipt");
  const { data: duplicate, error: duplicateError } = await attachmentsTable()
    .select("id")
    .eq("owner_user_id", input.ownerUserId)
    .eq("transaction_id", input.transaction.id)
    .eq("file_hash", input.file.fileHash)
    .maybeSingle();
  if (duplicateError) {
    throw toBackendError(duplicateError, "ATTACHMENT_UPLOAD_FAILED");
  }
  if (duplicate) {
    throw new BackendError({
      code: "CONFLICT",
      message: "This exact receipt is already attached to the transaction.",
    });
  }

  const attachmentId = Crypto.randomUUID();
  const storagePath = receiptStoragePath({
    attachmentId,
    filename: input.file.safeFilename,
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId,
  });

  progress(input, "registering", 0.25, "Registering the private file path");
  const { data: attachment, error: insertError } = await attachmentsTable()
    .insert({
      file_hash: input.file.fileHash,
      file_size_bytes: input.file.size,
      id: attachmentId,
      last_upload_error: null,
      mime_type: input.file.mimeType,
      original_filename: input.file.originalFilename,
      owner_user_id: input.ownerUserId,
      page_count: input.file.pageCount,
      provider_media_id: null,
      storage_bucket: RECEIPT_BUCKET,
      storage_path: storagePath,
      transaction_id: input.transaction.id,
      upload_attempts: 0,
      upload_source: "mobile_app",
      upload_status: "pending",
      workspace_id: input.workspaceId,
    })
    .select("*")
    .single();
  if (insertError) {
    throw toBackendError(insertError, "ATTACHMENT_UPLOAD_FAILED");
  }

  try {
    return await uploadRegisteredAttachment({
      attachment,
      file: input.file,
      input,
      upsert: false,
    });
  } catch (error) {
    await markUploadFailed(attachment.id, error).catch(() => undefined);
    throw toBackendError(error, "ATTACHMENT_UPLOAD_FAILED");
  }
}

export async function retryTransactionAttachment(
  attachment: TransactionAttachmentContract,
  input: ReceiptUploadInput,
) {
  if (
    input.file.fileHash !== attachment.file_hash ||
    input.file.mimeType !== attachment.mime_type ||
    input.file.size !== attachment.file_size_bytes ||
    input.file.pageCount !== attachment.page_count
  ) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Choose the same original file to retry this receipt.",
    });
  }
  try {
    return await uploadRegisteredAttachment({
      attachment,
      file: input.file,
      input,
      upsert: true,
    });
  } catch (error) {
    await markUploadFailed(attachment.id, error).catch(() => undefined);
    throw toBackendError(error, "ATTACHMENT_UPLOAD_FAILED");
  }
}

export async function createAttachmentSignedUrl(
  attachment: TransactionAttachmentContract,
) {
  if (attachment.upload_status !== "uploaded") {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Finish uploading this receipt before opening it.",
    });
  }
  const { data, error } = await supabaseClient.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(attachment.storage_path, 60);
  if (error) throw toBackendError(error, "ATTACHMENT_READ_FAILED");
  return data.signedUrl;
}

export async function deleteTransactionAttachment(
  attachment: TransactionAttachmentContract,
) {
  const { error: storageError } = await supabaseClient.storage
    .from(RECEIPT_BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) {
    throw toBackendError(storageError, "ATTACHMENT_DELETE_FAILED");
  }

  const { error: recordError } = await supabaseClient.rpc(
    "delete_transaction_attachment_record",
    { p_attachment_id: attachment.id },
  );
  if (recordError) {
    throw toBackendError(recordError, "ATTACHMENT_DELETE_FAILED");
  }
}
