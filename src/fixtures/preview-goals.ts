import type { Goal, GoalInsert, GoalUpdate } from "@/types/domain/goal";
import { PREVIEW_USER } from "@/fixtures/preview-data";

function futureDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const now = new Date().toISOString();

let previewGoals: Goal[] = [
  {
    id: "preview-goal-reserve",
    user_id: PREVIEW_USER.uid,
    title: "Emergency reserve",
    goal_type: "saving",
    target_amount: 12000,
    saved_amount: 5800,
    currency_code: "USD",
    target_date: futureDate(180),
    notes: "Build six months of quiet operating room.",
    icon_name: "shield-outline",
    color: "#7E9E78",
    status: "active",
    completed_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-goal-studio",
    user_id: PREVIEW_USER.uid,
    title: "Studio move",
    goal_type: "item",
    target_amount: 6500,
    saved_amount: 2100,
    currency_code: "USD",
    target_date: futureDate(92),
    notes: "Deposit, moving costs, and the first month.",
    icon_name: "home-outline",
    color: "#8E82C9",
    status: "active",
    completed_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-goal-laptop",
    user_id: PREVIEW_USER.uid,
    title: "Laptop refresh",
    goal_type: "item",
    target_amount: 2400,
    saved_amount: 2400,
    currency_code: "USD",
    target_date: futureDate(-24),
    notes: "Completed without drawing from the reserve.",
    icon_name: "laptop",
    color: "#63A6B3",
    status: "completed",
    completed_at: now,
    created_at: now,
    updated_at: now,
  },
];

export async function listPreviewGoals() {
  return [...previewGoals].sort((first, second) => {
    if (first.status !== second.status) {
      return first.status === "active" ? -1 : 1;
    }
    return (first.target_date ?? "9999").localeCompare(
      second.target_date ?? "9999",
    );
  });
}

export async function createPreviewGoal(payload: GoalInsert) {
  const goal: Goal = {
    ...payload,
    id: `preview-goal-${Date.now()}`,
    completed_at: payload.completed_at ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  previewGoals = [goal, ...previewGoals];
  return goal;
}

export async function updatePreviewGoal(id: string, payload: GoalUpdate) {
  const current = previewGoals.find((goal) => goal.id === id);
  if (!current) throw new Error("Goal not found in preview data.");
  const updated: Goal = {
    ...current,
    ...payload,
    updated_at: new Date().toISOString(),
  };
  previewGoals = previewGoals.map((goal) => (goal.id === id ? updated : goal));
  return updated;
}

export async function deletePreviewGoal(id: string) {
  previewGoals = previewGoals.filter((goal) => goal.id !== id);
}
