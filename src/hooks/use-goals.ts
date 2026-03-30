import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/services/supabase/goal-service";
import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";

export const goalKeys = {
  all: ["goals"] as const,
  list: (userId: string) => [...goalKeys.all, userId] as const,
};

export function useGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: goalKeys.list(user?.uid || ""),
    queryFn: () => listGoals(user?.uid || ""),
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload: GoalInsert) => createGoal(payload),
    onSuccess: () => {
      if (!user?.uid) return;
      queryClient.invalidateQueries({ queryKey: goalKeys.list(user.uid) });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GoalUpdate }) => updateGoal(id, payload),
    onMutate: async ({ id, payload }) => {
      if (!user?.uid) return undefined;

      const queryKey = goalKeys.list(user.uid);
      await queryClient.cancelQueries({ queryKey });
      const previousGoals = queryClient.getQueryData<Goal[]>(queryKey);

      queryClient.setQueryData<Goal[]>(queryKey, (current) =>
        (current ?? []).map((goal) => (goal.id === id ? { ...goal, ...payload } : goal)),
      );

      return { previousGoals, queryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousGoals);
      }
    },
    onSettled: () => {
      if (!user?.uid) return;
      queryClient.invalidateQueries({ queryKey: goalKeys.list(user.uid) });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      if (!user?.uid) return;
      queryClient.invalidateQueries({ queryKey: goalKeys.list(user.uid) });
    },
  });
}
