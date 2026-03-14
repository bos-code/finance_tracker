import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getTransactionsByMonth, 
  createTransaction, 
  Transaction, 
  TransactionInsert 
} from "@/services/supabase/transaction-service";
import { useAuth } from "@/hooks/use-auth";
import { useOffline } from "@/context/offline-context";

export const transactionKeys = {
  all: ["transactions"] as const,
  month: (userId: string, year: number, month?: number) => 
    [...transactionKeys.all, userId, year, month].filter(Boolean) as string[],
};

export function useTransactions(year: number, month?: number) {
  const { user } = useAuth();
  const { isOnline } = useOffline();

  return useQuery({
    queryKey: transactionKeys.month(user?.uid || "", year, month),
    queryFn: () => getTransactionsByMonth(user?.uid || "", year, month, isOnline),
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: (data: TransactionInsert) => createTransaction(data, isOnline),
    onMutate: async (newTx) => {
      // Parse date for query key
      const [year, month] = newTx.transaction_date.split("-").map(Number);
      const queryKey = transactionKeys.month(newTx.user_id, year, month);

      // Cancel refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey);

      // Optimistically update
      if (previousTransactions) {
        // Create an optimistic record
        const optimisticTx: Transaction = {
          ...newTx,
          id: `opt_${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData<Transaction[]>(queryKey, (old) => [...(old || []), optimisticTx]);
      }

      return { previousTransactions, queryKey };
    },
    onError: (err, newTx, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousTransactions);
      }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });
}
