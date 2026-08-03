import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getTransactionsByMonth, 
  createTransaction, 
  Transaction, 
  TransactionInsert 
} from "@/services/supabase/transaction-service";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useOffline } from "@/context/offline-context";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  createPreviewTransaction,
  getPreviewTransactions,
} from "@/fixtures/preview-data";

export const transactionKeys = {
  all: ["transactions"] as const,
  month: (
    userId: string,
    workspaceId: string,
    year: number,
    month?: number,
  ) =>
    [...transactionKeys.all, userId, workspaceId, year, month].filter(
      Boolean,
    ) as string[],
};

export function useTransactions(year: number, month?: number) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { isOnline } = useOffline();

  return useQuery({
    queryKey: transactionKeys.month(
      user?.uid || "",
      workspace?.id || "",
      year,
      month,
    ),
    queryFn: () =>
      UI_PREVIEW_ENABLED
        ? Promise.resolve(getPreviewTransactions(year, month))
        : getTransactionsByMonth(
            user?.uid || "",
            workspace?.id || "",
            year,
            month,
            isOnline,
          ),
    enabled: UI_PREVIEW_ENABLED || (!!user?.uid && !!workspace?.id),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { isOnline, refreshPendingCount } = useOffline();

  return useMutation({
    mutationFn: (data: TransactionInsert) =>
      UI_PREVIEW_ENABLED
        ? createPreviewTransaction(data)
        : createTransaction(data, isOnline),
    onMutate: async (newTx) => {
      // Parse date for query key
      const [year, month] = newTx.transaction_date.split("-").map(Number);
      const queryKey = transactionKeys.month(
        newTx.user_id,
        newTx.workspace_id,
        year,
        month,
      );

      // Cancel refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey);

      const timestamp = new Date().toISOString();
      const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const optimisticTx: Transaction = {
        ...newTx,
        base_amount: Number((newTx.amount * newTx.exchange_rate).toFixed(2)),
        created_at: timestamp,
        deleted_at: null,
        id: optimisticId,
        idempotency_key: null,
        lifecycle: "confirmed",
        revision: 1,
        source: "mobile_app",
        sync_state: isOnline ? "syncing" : "queued",
        updated_at: timestamp,
      };
      queryClient.setQueryData<Transaction[]>(queryKey, (old) => [
        optimisticTx,
        ...(old || []),
      ]);

      return { optimisticId, previousTransactions, queryKey };
    },
    onError: (err, newTx, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousTransactions);
      }
    },
    onSuccess: (saved, variables, context) => {
      if (!context?.queryKey) return;
      queryClient.setQueryData<Transaction[]>(context.queryKey, (current) => [
        saved,
        ...(current ?? []).filter(
          (transaction) =>
            transaction.id !== context.optimisticId &&
            transaction.id !== saved.id,
        ),
      ]);
    },
    onSettled: (data, error, variables, context) => {
      void refreshPendingCount();
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });
}
