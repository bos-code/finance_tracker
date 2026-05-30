import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";
import { supabaseClient } from "./supabase-client";

const GOALS_TABLE = process.env.EXPO_PUBLIC_GOALS_TABLE || "goals";

function goalsTable() {
  const raw = GOALS_TABLE.trim();
  const [maybeSchema, maybeTable] = raw.split(".");

  if (maybeSchema && maybeTable) {
    return supabaseClient.schema(maybeSchema).from(maybeTable);
  }

  return supabaseClient.from(raw);
}

export function isMissingGoalsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const anyError = error as any;
  const message = String(anyError?.message ?? "").toLowerCase();
  const code = String(anyError?.code ?? "").toLowerCase();

  return (
    code === "42p01" ||
    code === "pgrst205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await goalsTable()
    .select("*")
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as Goal[];
}

export async function createGoal(payload: GoalInsert): Promise<Goal> {
  const { data, error } = await goalsTable()
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return data as Goal;
}

export async function updateGoal(id: string, payload: GoalUpdate): Promise<Goal> {
  const { data, error } = await goalsTable()
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await goalsTable()
    .delete()
    .eq("id", id);

  if (error) throw error;
}
