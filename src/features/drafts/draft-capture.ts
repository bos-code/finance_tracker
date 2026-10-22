import type {
  TransactionDraftInsert,
  TransactionSource,
} from "@/contracts/backend";

import { draftFieldsFromParser, evaluateDraftFields } from "./draft-review.ts";
import {
  parseTransactionText,
  type ParseTransactionContext,
} from "./transaction-parser.ts";

export const DETERMINISTIC_PARSER_VERSION = "deterministic-v1";
export const DEFAULT_DRAFT_TTL_DAYS = 30;

export type BuildTransactionDraftInput = Pick<
  ParseTransactionContext,
  "categoryRules" | "defaultCurrency" | "reviewThreshold"
> & {
  now?: Date;
  ownerUserId: string;
  source?: TransactionSource;
  sourceMessageId?: string | null;
  text: string;
  workspaceId: string;
};

export function draftExpiry(now: Date, ttlDays = DEFAULT_DRAFT_TTL_DAYS) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  return expiresAt.toISOString();
}

/**
 * Parses free text into a reviewable draft row. This is the single place that
 * turns user text into a draft, so the mobile app and every channel (Telegram
 * today) produce identical results.
 */
export function buildTransactionDraftInsert(
  input: BuildTransactionDraftInput,
): TransactionDraftInsert {
  const now = input.now ? new Date(input.now) : new Date();
  const text = input.text.trim();
  const parsed = parseTransactionText(text, {
    categoryRules: input.categoryRules,
    defaultCurrency: input.defaultCurrency,
    now,
    reviewThreshold: input.reviewThreshold,
  });
  const review = evaluateDraftFields(
    draftFieldsFromParser(parsed),
    input.reviewThreshold,
  );

  return {
    expires_at: draftExpiry(now),
    extracted_fields: review.extracted_fields,
    lifecycle: review.lifecycle,
    missing_fields: review.missing_fields,
    original_text: text,
    overall_confidence: review.overall_confidence,
    owner_user_id: input.ownerUserId,
    parser_version: DETERMINISTIC_PARSER_VERSION,
    source: input.source ?? "mobile_app",
    source_message_id: input.sourceMessageId?.trim() || null,
    workspace_id: input.workspaceId,
  };
}
