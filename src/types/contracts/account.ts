/**
 * Canonical financial-account contract (PLAN_BACKEND.md Stage 3).
 * No `financial_accounts` table exists today — the app implicitly treats
 * every user as having a single unnamed account. This is the target shape
 * for Stage 3's `financial_accounts` table.
 */

export const FinancialAccountType = {
  Cash: "cash",
  Bank: "bank",
  Savings: "savings",
  MobileMoney: "mobile_money",
  Card: "card",
  Custom: "custom",
} as const;

export type FinancialAccountType = (typeof FinancialAccountType)[keyof typeof FinancialAccountType];

export type FinancialAccount = {
  id: string;
  workspace_id: string;
  name: string;
  type: FinancialAccountType;
  currency_code: string;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialAccountInsert = Omit<FinancialAccount, "id" | "created_at" | "updated_at" | "archived_at"> & {
  archived_at?: string | null;
};

export type FinancialAccountUpdate = Partial<Omit<FinancialAccount, "id" | "workspace_id" | "created_at" | "updated_at">>;
