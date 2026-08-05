import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TransactionDraftContract } from "@/contracts/backend";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import type { TransactionDraftCorrections } from "@/features/drafts/draft-review";
import {
  confirmPreviewTransactionDraft,
  correctPreviewTransactionDraft,
  createPreviewTransactionDraft,
  deletePreviewTransactionDraft,
  listPreviewTransactionDrafts,
  markPreviewDraftPendingConfirmation,
} from "@/fixtures/preview-drafts";
import {
  confirmTransactionDraft,
  correctTransactionDraft,
  createTransactionDraft,
  deleteTransactionDraft,
  listTransactionDrafts,
  markTransactionDraftPendingConfirmation,
  type CreateTransactionDraftInput,
  type ListTransactionDraftOptions,
} from "@/services/supabase/draft-service";

export const transactionDraftKeys = {
  all: ["transaction-drafts"] as const,
  list: (workspaceId: string, options: ListTransactionDraftOptions) =>
    [...transactionDraftKeys.all, workspaceId, options] as const,
};

export function useTransactionDrafts(
  workspaceId: string,
  options: ListTransactionDraftOptions = {},
  enabled = true,
) {
  return useQuery({
    enabled: enabled && !!workspaceId,
    queryFn: () =>
      UI_PREVIEW_ENABLED
        ? listPreviewTransactionDrafts(workspaceId, options)
        : listTransactionDrafts(workspaceId, options),
    queryKey: transactionDraftKeys.list(workspaceId, options),
    staleTime: 30_000,
  });
}

export function useCreateTransactionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionDraftInput) =>
      UI_PREVIEW_ENABLED
        ? createPreviewTransactionDraft(input)
        : createTransactionDraft(input),
    onSettled: (_data, _error, input) =>
      queryClient.invalidateQueries({
        queryKey: [...transactionDraftKeys.all, input.workspaceId],
      }),
  });
}

export function useCorrectTransactionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      corrections,
      draft,
      reviewThreshold,
    }: {
      corrections: TransactionDraftCorrections;
      draft: TransactionDraftContract;
      reviewThreshold?: number;
    }) =>
      UI_PREVIEW_ENABLED
        ? correctPreviewTransactionDraft(draft, corrections, reviewThreshold)
        : correctTransactionDraft(draft, corrections, reviewThreshold),
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: [
          ...transactionDraftKeys.all,
          variables.draft.workspace_id,
        ],
      }),
  });
}

export function useMarkTransactionDraftPendingConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: TransactionDraftContract) =>
      UI_PREVIEW_ENABLED
        ? markPreviewDraftPendingConfirmation(draft)
        : markTransactionDraftPendingConfirmation(draft),
    onSettled: (_data, _error, draft) =>
      queryClient.invalidateQueries({
        queryKey: [...transactionDraftKeys.all, draft.workspace_id],
      }),
  });
}

export function useConfirmTransactionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      draft,
      transactionId,
    }: {
      draft: TransactionDraftContract;
      transactionId: string;
    }) =>
      UI_PREVIEW_ENABLED
        ? confirmPreviewTransactionDraft(draft, transactionId)
        : confirmTransactionDraft(draft, transactionId),
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: [
          ...transactionDraftKeys.all,
          variables.draft.workspace_id,
        ],
      }),
  });
}

export function useDeleteTransactionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: TransactionDraftContract) =>
      UI_PREVIEW_ENABLED
        ? deletePreviewTransactionDraft(draft)
        : deleteTransactionDraft(draft),
    onSuccess: (_data, draft) =>
      queryClient.invalidateQueries({
        queryKey: [...transactionDraftKeys.all, draft.workspace_id],
      }),
  });
}
