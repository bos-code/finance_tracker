import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/services/supabase/goal-service";
import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";

export const goalKeys = {
  all: ["goals"] as const,
  list: (userId: string) => [...goalKeys.all, userId] as const,
};

/**
 * Provides a React Query hook that fetches the authenticated user's goals.
 *
 * The query is keyed by the current user's UID and will not run when there is no authenticated user.
 *
 * @returns The React Query result object containing the authenticated user's goals array and associated query state.
 */
export function useGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: goalKeys.list(user?.uid || ""),
    queryFn: () => listGoals(user?.uid || ""),
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a goal and refresh the authenticated user's goals list after a successful creation.
 *
 * @returns The React Query mutation object for creating a goal. On success, if an authenticated user exists, invalidates the goals list query for that user's UID so the list is refetched.
 */
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

/**
 * Provides a React Query mutation for updating a goal with optimistic cache updates.
 *
 * The mutation performs an optimistic update of the cached goals list by merging the provided
 * payload into the matching goal, returns context containing the previous cache for rollback,
 * restores the previous cache on error, and invalidates the goals list query when settled.
 *
 * @returns The configured mutation object for updating a goal by `{ id, payload }`.
 */
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

/**
 * Provides a mutation hook to delete a goal and refresh the current user's goals list on success.
 *
 * @returns A React Query mutation object for deleting a goal; on successful deletion it invalidates the goals list query for the authenticated user (if present).
 */
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
