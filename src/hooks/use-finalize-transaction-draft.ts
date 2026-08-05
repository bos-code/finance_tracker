import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TransactionDraftContract } from "@/contracts/backend";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { useOffline } from "@/context/offline-context";
import {
  draftTransactionIdempotencyKey,
  transactionInsertFromDraft,
} from "@/features/drafts/draft-finalization";
import { createPreviewTransaction } from "@/fixtures/preview-data";
import { confirmPreviewTransactionDraft } from "@/fixtures/preview-drafts";
import { transactionDraftKeys } from "@/hooks/use-transaction-drafts";
import { transactionKeys } from "@/hooks/use-transactions";
import { BackendError } from "@/services/backend/errors";
import { confirmTransactionDraft } from "@/services/supabase/draft-service";
import { createTransaction } from "@/services/supabase/transaction-service";

export type FinalizeTransactionDraftInput = {
  accountId: string;
  baseCurrencyCode: string;
  draft: TransactionDraftContract;
  exchangeRate?: number | null;
  ownerUserId: string;
  workspaceId: string;
};

export function useFinalizeTransactionDraft() {
  const queryClient = useQueryClient();
  const { isOnline, refreshPendingCount } = useOffline();

  return useMutation({
    mutationFn: async (input: FinalizeTransactionDraftInput) => {
      if (!UI_PREVIEW_ENABLED && !isOnline) {
        throw new BackendError({
          code: "NETWORK_UNAVAILABLE",
          message:
            "Connect before confirming a draft. Draft confirmation must receive a permanent transaction ID.",
          retryable: true,
        });
      }

      const transactionInsert = transactionInsertFromDraft(input.draft, {
        accountId: input.accountId,
        baseCurrencyCode: input.baseCurrencyCode,
        exchangeRate: input.exchangeRate,
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
      });

      const transaction = UI_PREVIEW_ENABLED
        ? await createPreviewTransaction(transactionInsert)
        : await createTransaction(transactionInsert, {
            idempotencyKey: draftTransactionIdempotencyKey(input.draft.id),
            isOnline: true,
            queueOnNetworkFailure: false,
            source: input.draft.source,
          });

      const draft = UI_PREVIEW_ENABLED
        ? await confirmPreviewTransactionDraft(input.draft, transaction.id)
        : await confirmTransactionDraft(input.draft, transaction.id);

      return { draft, transaction };
    },
    onSuccess: async ({ transaction }, input) => {
      const [year, month] = transaction.transaction_date.split("-").map(Number);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...transactionDraftKeys.all, input.workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: transactionKeys.month(
            input.ownerUserId,
            input.workspaceId,
            year,
            month,
          ),
        }),
        refreshPendingCount(),
      ]);
    },
  });
}
