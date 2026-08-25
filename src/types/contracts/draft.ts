/**
 * Canonical transaction-draft contract (PLAN_BACKEND.md Stage 5).
 * No `transaction_drafts` table exists today. This is the target shape for
 * the shared parsing/draft engine that converts channel messages
 * (Telegram, WhatsApp, import) into reviewable drafts before they become
 * confirmed transactions.
 */

import type { TransactionSource, TransactionType } from "./transaction";

export type DraftFieldName =
  | "amount"
  | "type"
  | "transaction_date"
  | "category_id"
  | "account_id"
  | "currency_code"
  | "note";

/** Confidence score in [0, 1] for a single extracted field. */
export type FieldConfidence = Partial<Record<DraftFieldName, number>>;

export type DraftExtractedFields = {
  amount?: number;
  type?: TransactionType;
  transaction_date?: string;
  category_id?: string;
  account_id?: string;
  currency_code?: string;
  note?: string;
  merchant?: string;
};

export type DraftStatus = "needs_review" | "confirmed" | "discarded";

export type TransactionDraft = {
  id: string;
  workspace_id: string;
  user_id: string;
  source: TransactionSource;
  /** Original, unmodified text from the channel — always kept for context during correction. */
  source_text: string;
  /** Dedupe key: same channel + same provider message id must not create two drafts. */
  source_channel_message_id: string | null;
  extracted: DraftExtractedFields;
  field_confidence: FieldConfidence;
  missing_fields: DraftFieldName[];
  /** Whether the deterministic parser or the Stage 6 AI fallback produced this draft. Not exposed to end users. */
  parsed_by: "deterministic" | "ai_fallback";
  status: DraftStatus;
  /** Set once a draft is confirmed into a real transaction. */
  resolved_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};
