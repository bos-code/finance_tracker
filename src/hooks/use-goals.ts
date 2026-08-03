import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/services/supabase/goal-service";
import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  createPreviewGoal,
  deletePreviewGoal,
  listPreviewGoals,
  updatePreviewGoal,
} from "@/fixtures/preview-goals";

export const goalKeys = {
  all: ["goals"] as const,
  list: (userId: string) => [...goalKeys.all, userId] as const,
};

export function useGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: goalKeys.list(user?.uid || ""),
    queryFn: () =>
      UI_PREVIEW_ENABLED ? listPreviewGoals() : listGoals(user?.uid || ""),
    enabled: UI_PREVIEW_ENABLED || !!user?.uid,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload: GoalInsert) =>
      UI_PREVIEW_ENABLED ? createPreviewGoal(payload) : createGoal(payload),
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
    mutationFn: ({ id, payload }: { id: string; payload: GoalUpdate }) =>
      UI_PREVIEW_ENABLED
        ? updatePreviewGoal(id, payload)
        : updateGoal(id, payload),
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
    mutationFn: (id: string) =>
      UI_PREVIEW_ENABLED ? deletePreviewGoal(id) : deleteGoal(id),
    onSuccess: () => {
      if (!user?.uid) return;
      queryClient.invalidateQueries({ queryKey: goalKeys.list(user.uid) });
    },
  });
}
