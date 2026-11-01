import type {
  TransactionDraftFields,
  TransactionDraftInsert,
} from "@/contracts/backend";

import { evaluateDraftFields } from "../drafts/draft-review.ts";
import { parseCompactAmountToken } from "../drafts/transaction-parser.ts";

/**
 * The AI only ever *suggests* values for fields the deterministic parser could
 * not read, and every suggestion is checked here before it is used. A suggested
 * field keeps a confidence below the review threshold, so an AI-assisted draft
 * can never skip human review.
 */

export const AI_FILLABLE_FIELDS = ["amount", "type", "category_key"] as const;
export type AiFillableField = (typeof AI_FILLABLE_FIELDS)[number];

export const AI_FIELD_CONFIDENCE = 0.7;
export const AI_FIELD_REASON =
  "Suggested by the AI assistant; please check it.";
export const AI_PARSER_SUFFIX = "+ai";

export type AiSuggestion = {
  amount?: number;
  type?: "Expenditure" | "Revenue";
  category_key?: string;
};

const NUMBER_WORDS =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|dozen)\b/i;

/** Every numeric amount that literally appears in the message. */
export function amountsInText(text: string): number[] {
  const tokens = text.match(/\d[\d,]*(?:\.\d+)?\s*[kmb]?/gi) ?? [];
  return tokens
    .map((token) => parseCompactAmountToken(token))
    .filter((value): value is number => value !== null);
}

function amountIsGrounded(amount: number, text: string): boolean {
  const close = (a: number, b: number) =>
    Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);
  if (amountsInText(text).some((candidate) => close(candidate, amount))) {
    return true;
  }
  // "two thousand" has no digits to compare against, so allow a suggestion only
  // when the message really contains number words.
  return NUMBER_WORDS.test(text);
}

/**
 * Keeps only suggestions that are well-formed and anchored in the user's text.
 * Anything else is dropped silently — a bad answer must never become data.
 */
export function validateAiSuggestion(
  raw: unknown,
  context: { text: string; categoryKeys: readonly string[] },
): AiSuggestion {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const suggestion: AiSuggestion = {};

  const amount = input.amount;
  if (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount < 1e12 &&
    amountIsGrounded(amount, context.text)
  ) {
    suggestion.amount = amount;
  }

  if (input.type === "Expenditure" || input.type === "Revenue") {
    suggestion.type = input.type;
  }

  if (
    typeof input.category_key === "string" &&
    context.categoryKeys.includes(input.category_key)
  ) {
    suggestion.category_key = input.category_key;
  }

  return suggestion;
}

/** Fields the AI may fill: required by the parser, missing, and still empty. */
export function aiFillableFieldsFor(
  draft: Pick<TransactionDraftInsert, "extracted_fields" | "missing_fields">,
): AiFillableField[] {
  return AI_FILLABLE_FIELDS.filter(
    (name) =>
      draft.missing_fields.includes(name) &&
      (draft.extracted_fields[name]?.value ?? null) === null,
  );
}

export function applyAiSuggestion(
  draft: TransactionDraftInsert,
  suggestion: AiSuggestion,
): TransactionDraftInsert {
  const fields: TransactionDraftFields = { ...draft.extracted_fields };
  let applied = false;

  for (const name of aiFillableFieldsFor(draft)) {
    const value = suggestion[name];
    if (value === undefined) continue;
    fields[name] = {
      confidence: AI_FIELD_CONFIDENCE,
      reason: AI_FIELD_REASON,
      value,
    };
    applied = true;
  }

  if (!applied) return draft;

  const review = evaluateDraftFields(fields);
  return {
    ...draft,
    extracted_fields: review.extracted_fields,
    lifecycle: review.lifecycle,
    missing_fields: review.missing_fields,
    overall_confidence: review.overall_confidence,
    parser_version: draft.parser_version.endsWith(AI_PARSER_SUFFIX)
      ? draft.parser_version
      : `${draft.parser_version}${AI_PARSER_SUFFIX}`,
  };
}

/** Names of the fields in a draft that came from the AI, for user-facing notes. */
export function aiSuggestedFieldNames(
  draft: Pick<TransactionDraftInsert, "extracted_fields">,
): string[] {
  return Object.entries(draft.extracted_fields)
    .filter(([, field]) => field.reason === AI_FIELD_REASON)
    .map(([name]) => name);
}
