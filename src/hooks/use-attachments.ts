import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TransactionAttachmentContract } from "@/contracts/backend";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  deletePreviewAttachment,
  listPreviewAttachments,
  retryPreviewAttachment,
  uploadPreviewAttachment,
} from "@/fixtures/preview-attachments";
import {
  deleteTransactionAttachment,
  listTransactionAttachments,
  retryTransactionAttachment,
  uploadTransactionAttachment,
  type ReceiptUploadInput,
} from "@/services/supabase/attachment-service";

export const attachmentKeys = {
  all: ["transaction-attachments"] as const,
  list: (workspaceId: string, transactionId: string) =>
    [...attachmentKeys.all, workspaceId, transactionId] as const,
};

export function useTransactionAttachments(
  workspaceId: string,
  transactionId: string,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && !!workspaceId && !!transactionId,
    queryFn: () =>
      UI_PREVIEW_ENABLED
        ? listPreviewAttachments(transactionId)
        : listTransactionAttachments(workspaceId, transactionId),
    queryKey: attachmentKeys.list(workspaceId, transactionId),
    staleTime: 60_000,
  });
}

export function useUploadTransactionAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptUploadInput) =>
      UI_PREVIEW_ENABLED
        ? uploadPreviewAttachment(input)
        : uploadTransactionAttachment(input),
    onSettled: (_data, _error, input) =>
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list(
          input.workspaceId,
          input.transaction.id,
        ),
      }),
  });
}

export function useRetryTransactionAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attachment,
      input,
    }: {
      attachment: TransactionAttachmentContract;
      input: ReceiptUploadInput;
    }) =>
      UI_PREVIEW_ENABLED
        ? retryPreviewAttachment(attachment)
        : retryTransactionAttachment(attachment, input),
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list(
          variables.attachment.workspace_id,
          variables.attachment.transaction_id,
        ),
      }),
  });
}

export function useDeleteTransactionAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachment: TransactionAttachmentContract) =>
      UI_PREVIEW_ENABLED
        ? deletePreviewAttachment(attachment.id)
        : deleteTransactionAttachment(attachment),
    onSuccess: (_data, attachment) =>
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list(
          attachment.workspace_id,
          attachment.transaction_id,
        ),
      }),
  });
}
