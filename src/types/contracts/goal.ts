/**
 * Canonical goal contract. Matches `public.goals` today, plus the
 * `workspace_id` field Stage 3 adds when goals become workspace-scoped.
 */

export type GoalType = "saving" | "item";
export type GoalStatus = "active" | "completed";

/** Matches `public.goals` exactly as it exists today. */
export type CurrentGoalRow = {
  id: string;
  user_id: string;
  title: string;
  goal_type: GoalType;
  target_amount: number;
  saved_amount: number;
  currency_code: string;
  target_date: string | null;
  notes: string | null;
  icon_name: string;
  color: string;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = CurrentGoalRow & {
  /** Stage 3: goals become workspace-scoped. */
  workspace_id: string;
};

export type GoalInsert = Omit<Goal, "id" | "created_at" | "updated_at" | "completed_at"> & {
  completed_at?: string | null;
};

export type GoalUpdate = Partial<Omit<Goal, "id" | "user_id" | "workspace_id" | "created_at" | "updated_at">>;
