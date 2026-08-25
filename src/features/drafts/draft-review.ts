import type {
  DraftFieldValue,
  TransactionDraftContract,
  TransactionDraftFields,
  TransactionDraftLifecycle,
} from "@/contracts/backend";

import type { DeterministicTransactionDraft } from "./transaction-parser";

export const REQUIRED_DRAFT_FIELDS = [
  "amount",
  "type",
  "currency_code",
  "transaction_date",
  "category_key",
] as const;

export type RequiredDraftField = (typeof REQUIRED_DRAFT_FIELDS)[number];
export type DraftCorrectionField =
  | RequiredDraftField
  | "description"
  | "merchant_name";

export type TransactionDraftCorrections = Partial<
  Record<DraftCorrectionField, DraftFieldValue>
>;

export type DraftReviewEvaluation = {
  extracted_fields: TransactionDraftFields;
  lifecycle: TransactionDraftLifecycle;
  missing_fields: string[];
  overall_confidence: number;
};

const DEFAULT_REVIEW_THRESHOLD = 0.75;

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function normalizedValue(value: DraftFieldValue): DraftFieldValue {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasValue(value: DraftFieldValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

export function draftFieldsFromParser(
  parsed: DeterministicTransactionDraft,
): TransactionDraftFields {
  return {
    amount: parsed.fields.amount,
    category_key: parsed.fields.category_key,
    currency_code: parsed.fields.currency_code,
    description: parsed.fields.description,
    merchant_name: parsed.fields.merchant_name,
    transaction_date: parsed.fields.transaction_date,
    type: parsed.fields.type,
  };
}

export function evaluateDraftFields(
  fields: TransactionDraftFields,
  reviewThreshold = DEFAULT_REVIEW_THRESHOLD,
): DraftReviewEvaluation {
  const missingFields = REQUIRED_DRAFT_FIELDS.filter((fieldName) => {
    const field = fields[fieldName];
    return (
      !field ||
      !hasValue(field.value) ||
      field.confidence < reviewThreshold
    );
  });

  const confidenceValues = REQUIRED_DRAFT_FIELDS.map(
    (fieldName) => fields[fieldName]?.confidence ?? 0,
  );
  const overallConfidence = clampConfidence(
    confidenceValues.reduce((sum, value) => sum + value, 0) /
      REQUIRED_DRAFT_FIELDS.length,
  );

  const lifecycle: TransactionDraftLifecycle =
    missingFields.length > 0 ? "needs_review" : "pending_confirmation";

  return {
    extracted_fields: fields,
    lifecycle,
    missing_fields: [...missingFields],
    overall_confidence: overallConfidence,
  };
}

export function applyDraftCorrections(
  draft: Pick<TransactionDraftContract, "extracted_fields">,
  corrections: TransactionDraftCorrections,
  reviewThreshold = DEFAULT_REVIEW_THRESHOLD,
): DraftReviewEvaluation {
  const fields: TransactionDraftFields = { ...draft.extracted_fields };

  for (const [fieldName, rawValue] of Object.entries(corrections) as [
    DraftCorrectionField,
    DraftFieldValue | undefined,
  ][]) {
    if (rawValue === undefined) continue;
    const value = normalizedValue(rawValue);
    fields[fieldName] = {
      confidence: hasValue(value) ? 1 : 0,
      reason: hasValue(value)
        ? "Confirmed by user."
        : "Cleared by user and requires review.",
      value,
    };
  }

  return evaluateDraftFields(fields, reviewThreshold);
}

export function isDraftExpired(
  draft: Pick<TransactionDraftContract, "expires_at">,
  now = new Date(),
) {
  const expiresAt = new Date(draft.expires_at);
  return !Number.isFinite(expiresAt.getTime()) || expiresAt <= now;
}
