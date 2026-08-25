/**
 * Canonical transaction contract for Finance Tracker.
 *
 * This is the target shape the mobile app, Telegram bot, and any future
 * channel must agree on. It is intentionally ahead of the current database
 * schema — see docs/backend/database-inventory.md for what `public.transactions`
 * actually contains today. Fields are annotated with the stage that
 * introduces them so nobody mistakes a planned field for a shipped one.
 */

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/**
 * Transaction lifecycle states (PLAN_BACKEND.md Stage 1).
 * Today every row in `public.transactions` is implicitly `confirmed` —
 * there is no `status` column yet. Stage 5 introduces `draft` and
 * `needs_review` via `transaction_drafts`; Stage 2 introduces `reversed`
 * as a soft-delete/undo state instead of hard deleting rows.
 */
export const TransactionStatus = {
  Draft: "draft",
  PendingConfirmation: "pending_confirmation",
  Confirmed: "confirmed",
  NeedsReview: "needs_review",
  Reversed: "reversed",
  Deleted: "deleted",
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

/**
 * Where a transaction originated (PLAN_BACKEND.md Stage 1).
 * Only `mobile_app` exists in practice today. `system` covers
 * backend-generated writes (migrations, reconciliation jobs).
 */
export const TransactionSource = {
  MobileApp: "mobile_app",
  Telegram: "telegram",
  WhatsApp: "whatsapp",
  WebDashboard: "web_dashboard",
  Import: "import",
  System: "system",
} as const;

export type TransactionSource = (typeof TransactionSource)[keyof typeof TransactionSource];

/**
 * Local sync state for the offline queue (PLAN_BACKEND.md Stage 2).
 * Not persisted server-side — this describes the client's local cache
 * entry for a transaction, independent of its server-side TransactionStatus.
 */
export const SyncState = {
  LocalOnly: "local_only",
  Queued: "queued",
  Syncing: "syncing",
  Synced: "synced",
  Failed: "failed",
  Conflict: "conflict",
} as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];

// ─── Core type (matches today's schema) ────────────────────────────────────

/** Matches `public.transactions` exactly as it exists today. No currency, workspace, or status columns yet. */
export type TransactionType = "Expenditure" | "Revenue";

export type CurrentTransactionRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  /** Local "YYYY-MM-DD" calendar date string, not a timestamp. */
  transaction_date: string;
  created_at: string;
  updated_at: string;
};

// ─── Canonical target contract ─────────────────────────────────────────────

export type Transaction = {
  id: string;
  /** Stage 3: transactions become workspace-scoped instead of user-scoped directly. */
  workspace_id: string;
  user_id: string;
  /** Stage 3: replaces the implicit single "Cash" account. */
  account_id: string | null;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  transaction_date: string;
  status: TransactionStatus;
  source: TransactionSource;

  // Stage 3 — currency fields
  currency_code: string;
  base_currency_code: string;
  base_amount: number;
  exchange_rate: number;

  // Stage 5 — provenance for parser/draft-created transactions
  source_channel_message_id: string | null;

  created_at: string;
  updated_at: string;
};

export type TransactionInsert = Omit<Transaction, "id" | "created_at" | "updated_at" | "status"> & {
  status?: TransactionStatus;
};

export type TransactionUpdate = Partial<Omit<Transaction, "id" | "user_id" | "workspace_id" | "created_at" | "updated_at">>;
