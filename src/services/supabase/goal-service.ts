import type {
  GoalInsert,
  GoalRecord,
  GoalUpdate,
} from "@/contracts/backend";
import { toBackendError } from "@/services/backend/errors";
import { supabaseClient } from "./supabase-client";

export type Goal = GoalRecord;
export type { GoalInsert, GoalUpdate };

function goalsTable() {
  return supabaseClient.from("goals");
}

export function isMissingGoalsTableError(error: unknown) {
  return toBackendError(error).code === "BACKEND_NOT_READY";
}

export async function listGoals(
  userId: string,
  workspaceId: string,
): Promise<Goal[]> {
  const { data, error } = await goalsTable()
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("status", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw toBackendError(error, "GOAL_READ_FAILED");

  return data ?? [];
}

export async function createGoal(payload: GoalInsert): Promise<Goal> {
  const { data, error } = await goalsTable()
    .insert(payload)
    .select()
    .single();

  if (error) throw toBackendError(error, "GOAL_WRITE_FAILED");

  return data;
}

export async function updateGoal(
  id: string,
  payload: GoalUpdate,
): Promise<Goal> {
  const { data, error } = await goalsTable()
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw toBackendError(error, "GOAL_WRITE_FAILED");

  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await goalsTable().delete().eq("id", id);

  if (error) throw toBackendError(error, "GOAL_WRITE_FAILED");
}
