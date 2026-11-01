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

const UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const SCALE_WORDS: Record<string, number> = {
  thousand: 1_000, million: 1_000_000, billion: 1_000_000_000,
};

// `word in table` is also true for inherited names such as "constructor", so
// look words up on the table's own keys only.
const hasOwn = (table: Record<string, number>, key: string) =>
  Object.prototype.hasOwnProperty.call(table, key);

/** Every numeric amount that literally appears in the message. */
export function amountsInText(text: string): number[] {
  const tokens = text.match(/\d[\d,]*(?:\.\d+)?\s*[kmb]?/gi) ?? [];
  return tokens
    .map((token) => parseCompactAmountToken(token))
    .filter((value): value is number => value !== null);
}

/** "2 thousand" / "1.5 million": digits followed by a scale word. */
function scaledDigitAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(
    /(\d[\d,]*(?:\.\d+)?)\s*(thousand|million|billion)\b/gi,
  )) {
    const base = Number(match[1].replace(/,/g, ""));
    const scale = SCALE_WORDS[match[2].toLowerCase()];
    if (Number.isFinite(base) && base > 0) amounts.push(base * scale);
  }
  return amounts;
}

/**
 * Amounts written in English words, such as "two thousand five hundred" (2500)
 * or "twenty-five" (25). Each run of number words is one amount, so
 * "five and ten" is 5 and 10, not 15.
 */
export function numberWordAmounts(text: string): number[] {
  const words = text.toLowerCase().replace(/-/g, " ").match(/[a-z]+|\d[\d,]*(?:\.\d+)?/g) ?? [];
  const values: number[] = [];
  let total = 0;
  let current = 0;
  let active = false;
  let lastWasMagnitude = false;

  const flush = () => {
    if (active && total + current > 0) values.push(total + current);
    total = 0;
    current = 0;
    active = false;
    lastWasMagnitude = false;
  };

  for (const word of words) {
    if (hasOwn(UNIT_WORDS, word)) {
      current += UNIT_WORDS[word];
      active = true;
      lastWasMagnitude = false;
    } else if (hasOwn(TENS_WORDS, word)) {
      current += TENS_WORDS[word];
      active = true;
      lastWasMagnitude = false;
    } else if (word === "hundred") {
      current = (current || 1) * 100;
      active = true;
      lastWasMagnitude = true;
    } else if (hasOwn(SCALE_WORDS, word)) {
      total += (current || 1) * SCALE_WORDS[word];
      current = 0;
      active = true;
      lastWasMagnitude = true;
    } else if (word === "and" && active && lastWasMagnitude) {
      // "one hundred and fifty": "and" continues the same amount.
      lastWasMagnitude = false;
    } else {
      flush();
    }
  }
  flush();
  return values;
}

function amountIsGrounded(amount: number, text: string): boolean {
  const close = (a: number, b: number) =>
    Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);
  // The suggested amount has to be one the user actually wrote, as digits or
  // as words. Merely containing a number word is not enough.
  return [
    ...amountsInText(text),
    ...scaledDigitAmounts(text),
    ...numberWordAmounts(text),
  ].some((candidate) => close(candidate, amount));
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
