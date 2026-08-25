/**
 * Canonical AI-usage contract (PLAN_BACKEND.md Stage 6).
 * No AI usage tracking exists today — there is no AI integration at all
 * yet. This is the target shape for tracking every Gemini Flash-Lite call
 * so limits, cost, and failure can be enforced and observed.
 */

export type AiFeature = "transaction_parse" | "receipt_ocr_assist";

export type AiUsageOutcome = "success" | "failure" | "timeout" | "circuit_open" | "limit_reached";

export type AiUsageRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  feature: AiFeature;
  model: string;
  input_tokens: number;
  output_tokens: number;
  outcome: AiUsageOutcome;
  /** Estimated cost in USD for this single call, for budget tracking. */
  estimated_cost_usd: number;
  latency_ms: number;
  created_at: string;
};

export type AiLimitScope = "project" | "user";

export type AiLimit = {
  scope: AiLimitScope;
  /** Null when scope is "project". */
  user_id: string | null;
  max_calls_per_day: number;
  max_cost_usd_per_day: number;
};
