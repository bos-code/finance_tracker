import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";
import { supabaseClient } from "./supabase-client";

const GOALS_TABLE = process.env.EXPO_PUBLIC_GOALS_TABLE || "goals";

/**
 * Resolve the configured goals table identifier into a Supabase table query builder, supporting an optional `schema.table` form.
 *
 * @returns A Supabase query builder targeting the configured goals table; if the configured identifier is `schema.table` the builder is scoped to that schema, otherwise the raw identifier is used.
 */
function goalsTable() {
  const raw = GOALS_TABLE.trim();
  const [maybeSchema, maybeTable] = raw.split(".");

  if (maybeSchema && maybeTable) {
    return supabaseClient.schema(maybeSchema).from(maybeTable);
  }

  return supabaseClient.from(raw);
}

/**
 * Detects whether an error likely indicates that the goals table is missing from the database.
 *
 * @param error - The error value to classify
 * @returns `true` if the error likely indicates the goals table is missing, `false` otherwise
 */
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

/**
 * Retrieve all goals for a specific user, ordered by status, target date, and creation time.
 *
 * @param userId - The user's identifier used to filter goals
 * @returns An array of Goal objects for the specified user; empty array if there are none
 * @throws The underlying Supabase error when the query fails
 */
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

/**
 * Inserts a new goal row and returns the created record.
 *
 * @param payload - Column values for the new goal
 * @returns The newly created `Goal` record
 * @throws The Supabase error returned when the insert operation fails
 */
export async function createGoal(payload: GoalInsert): Promise<Goal> {
  const { data, error } = await goalsTable()
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return data as Goal;
}

/**
 * Update a goal record identified by `id` with the provided fields.
 *
 * @param id - The id of the goal to update
 * @param payload - Fields to apply to the goal record
 * @returns The updated `Goal`
 * @throws The underlying Supabase error when the update fails
 */
export async function updateGoal(id: string, payload: GoalUpdate): Promise<Goal> {
  const { data, error } = await goalsTable()
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data as Goal;
}

/**
 * Deletes a goal row identified by `id` from the configured goals table.
 *
 * @param id - The goal's primary key identifier to delete
 * @throws The Supabase error returned when the delete operation fails
 */
export async function deleteGoal(id: string): Promise<void> {
  const { error } = await goalsTable()
    .delete()
    .eq("id", id);

  if (error) throw error;
}
