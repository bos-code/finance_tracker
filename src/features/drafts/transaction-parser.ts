export type ParsedTransactionType = "Expenditure" | "Revenue";

export type ParsedField<T> = {
  value: T | null;
  confidence: number;
  reason: string | null;
};

export type CategoryKeywordRule = {
  key: string;
  keywords: readonly string[];
};

export type ParseTransactionContext = {
  now?: Date;
  defaultCurrency?: string;
  reviewThreshold?: number;
  categoryRules?: readonly CategoryKeywordRule[];
};

export type DeterministicTransactionDraft = {
  original_text: string;
  normalized_text: string;
  fields: {
    amount: ParsedField<number>;
    type: ParsedField<ParsedTransactionType>;
    currency_code: ParsedField<string>;
    transaction_date: ParsedField<string>;
    category_key: ParsedField<string>;
    description: ParsedField<string>;
    merchant_name: ParsedField<string>;
  };
  missing_fields: string[];
  overall_confidence: number;
  requires_review: boolean;
};

const DEFAULT_REVIEW_THRESHOLD = 0.75;

const INCOME_TERMS = [
  "received",
  "receive",
  "earned",
  "income",
  "salary",
  "wage",
  "wages",
  "credit",
  "credited",
  "refund",
  "refunded",
  "sold",
  "sale",
  "deposit",
  "deposited",
  "paid me",
] as const;

const EXPENSE_TERMS = [
  "spent",
  "spend",
  "paid",
  "bought",
  "buy",
  "purchase",
  "purchased",
  "debit",
  "debited",
  "withdrew",
  "withdrawal",
  "sent",
] as const;

export const DEFAULT_CATEGORY_RULES: readonly CategoryKeywordRule[] = [
  {
    key: "food",
    keywords: [
      "food",
      "meal",
      "lunch",
      "dinner",
      "breakfast",
      "restaurant",
      "groceries",
      "grocery",
    ],
  },
  {
    key: "transport",
    keywords: ["transport", "bus", "uber", "bolt", "fuel", "petrol", "fare", "taxi"],
  },
  { key: "housing", keywords: ["rent", "housing", "house"] },
  {
    key: "utilities",
    keywords: ["electricity", "power", "water", "data", "airtime", "internet"],
  },
  {
    key: "health",
    keywords: ["hospital", "pharmacy", "medicine", "medical", "doctor"],
  },
  {
    key: "education",
    keywords: ["school", "tuition", "course", "book", "books"],
  },
  { key: "salary", keywords: ["salary", "wage", "wages", "paycheck"] },
  {
    key: "business",
    keywords: ["client", "invoice", "business", "freelance", "contract"],
  },
  {
    key: "shopping",
    keywords: ["shopping", "clothes", "cloth", "shoe", "shoes"],
  },
  {
    key: "entertainment",
    keywords: ["movie", "cinema", "game", "games", "netflix", "outing"],
  },
  { key: "savings", keywords: ["savings", "saving"] },
] as const;

const CURRENCY_ALIASES: ReadonlyArray<{
  code: string;
  pattern: RegExp;
}> = [
  { code: "NGN", pattern: /(?:₦|\bngn\b|\bnaira\b)/i },
  { code: "USD", pattern: /(?:\$|\busd\b|\bdollars?\b)/i },
  { code: "EUR", pattern: /(?:€|\beur\b|\beuros?\b)/i },
  { code: "GBP", pattern: /(?:£|\bgbp\b|\bpounds?\b)/i },
];

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parseCompactAmountToken(token: string): number | null {
  const normalized = token
    .toLowerCase()
    .replace(/[₦$€£,\s]/g, "")
    .replace(/^(?:ngn|usd|eur|gbp)/, "")
    .replace(/(?:naira|dollars?|euros?|pounds?)$/, "");

  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const multiplier =
    match[2]?.toLowerCase() === "k"
      ? 1_000
      : match[2]?.toLowerCase() === "m"
        ? 1_000_000
        : match[2]?.toLowerCase() === "b"
          ? 1_000_000_000
          : 1;

  const amount = value * multiplier;
  return Number.isFinite(amount) ? amount : null;
}

function extractAmount(text: string): ParsedField<number> {
  const currencyFirst = text.match(
    /(?:₦|\$|€|£|\b(?:ngn|usd|eur|gbp)\b)\s*(\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
  );
  const compact = text.match(/\b(\d[\d,]*(?:\.\d+)?\s*[kmb])\b/i);
  const plain = text.match(/\b(\d[\d,]*(?:\.\d+)?)\b/);
  const token = currencyFirst?.[1] ?? compact?.[1] ?? plain?.[1] ?? null;

  if (!token) {
    return { value: null, confidence: 0, reason: "No amount was found." };
  }

  const amount = parseCompactAmountToken(token);
  if (amount === null) {
    return { value: null, confidence: 0, reason: "The amount format was not valid." };
  }

  const confidence = currencyFirst ? 0.99 : compact ? 0.96 : 0.88;
  return {
    value: amount,
    confidence,
    reason: currencyFirst
      ? "Amount appeared beside an explicit currency."
      : compact
        ? "Amount used a recognised compact suffix."
        : "A standalone positive number was used as the amount.",
  };
}

function includesTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\b)${escaped}(?:$|\\b)`, "i").test(text);
}

function extractType(text: string): ParsedField<ParsedTransactionType> {
  const incomeMatches = INCOME_TERMS.filter((term) => includesTerm(text, term));
  const expenseMatches = EXPENSE_TERMS.filter((term) => includesTerm(text, term));

  if (incomeMatches.length > 0 && expenseMatches.length === 0) {
    return {
      value: "Revenue",
      confidence: incomeMatches.includes("salary") ? 0.98 : 0.94,
      reason: `Matched income wording: ${incomeMatches.join(", ")}.`,
    };
  }

  if (expenseMatches.length > 0 && incomeMatches.length === 0) {
    return {
      value: "Expenditure",
      confidence: 0.94,
      reason: `Matched expense wording: ${expenseMatches.join(", ")}.`,
    };
  }

  if (incomeMatches.length > 0 && expenseMatches.length > 0) {
    return {
      value: null,
      confidence: 0.25,
      reason: "Both income and expense wording appeared.",
    };
  }

  return {
    value: null,
    confidence: 0,
    reason: "No reliable income or expense wording was found.",
  };
}

function extractCurrency(
  text: string,
  defaultCurrency: string | undefined,
): ParsedField<string> {
  const matches = CURRENCY_ALIASES.filter(({ pattern }) => pattern.test(text));
  const unique = [...new Set(matches.map(({ code }) => code))];

  if (unique.length === 1) {
    return {
      value: unique[0],
      confidence: 0.99,
      reason: "An explicit currency symbol, code, or name was found.",
    };
  }

  if (unique.length > 1) {
    return {
      value: null,
      confidence: 0.2,
      reason: "More than one currency was mentioned.",
    };
  }

  const normalizedDefault = defaultCurrency?.trim().toUpperCase();
  if (normalizedDefault && /^[A-Z]{3}$/.test(normalizedDefault)) {
    return {
      value: normalizedDefault,
      confidence: 0.8,
      reason: "Used the workspace default currency.",
    };
  }

  return {
    value: null,
    confidence: 0,
    reason: "No currency was found and no valid default was supplied.",
  };
}

function extractDate(text: string, now: Date): ParsedField<string> {
  const isoMatch = text.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (validDateParts(year, month, day)) {
      return {
        value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        confidence: 0.99,
        reason: "Used an explicit ISO date.",
      };
    }
  }

  const slashMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[\/.](0?[1-9]|1[0-2])[\/.](20\d{2})\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (validDateParts(year, month, day)) {
      return {
        value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        confidence: 0.97,
        reason: "Used an explicit day/month/year date.",
      };
    }
  }

  if (/\byesterday\b/i.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return {
      value: formatLocalDate(date),
      confidence: 0.98,
      reason: "Resolved the relative date 'yesterday'.",
    };
  }

  if (/\btoday\b/i.test(text)) {
    return {
      value: formatLocalDate(now),
      confidence: 0.99,
      reason: "Resolved the relative date 'today'.",
    };
  }

  const weekdayMatch = text.match(
    /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekdayMatch) {
    const target = WEEKDAY_INDEX[weekdayMatch[1].toLowerCase()];
    const current = now.getDay();
    let daysBack = (current - target + 7) % 7;
    if (daysBack === 0) daysBack = 7;
    const date = new Date(now);
    date.setDate(date.getDate() - daysBack);
    return {
      value: formatLocalDate(date),
      confidence: 0.96,
      reason: `Resolved the relative weekday '${weekdayMatch[0]}'.`,
    };
  }

  return {
    value: formatLocalDate(now),
    confidence: 0.78,
    reason: "No date was supplied, so today was used as the reviewable default.",
  };
}

function extractCategory(
  text: string,
  rules: readonly CategoryKeywordRule[],
): ParsedField<string> {
  const matches = rules
    .map((rule) => ({
      key: rule.key,
      matched: rule.keywords.filter((keyword) => includesTerm(text, keyword)),
    }))
    .filter((entry) => entry.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length);

  if (matches.length === 0) {
    return {
      value: null,
      confidence: 0,
      reason: "No known category keyword was found.",
    };
  }

  const best = matches[0];
  const tied = matches.filter((entry) => entry.matched.length === best.matched.length);
  if (tied.length > 1) {
    return {
      value: null,
      confidence: 0.45,
      reason: `Category wording matched multiple groups: ${tied.map(({ key }) => key).join(", ")}.`,
    };
  }

  return {
    value: best.key,
    confidence: best.matched.length > 1 ? 0.95 : 0.88,
    reason: `Matched category wording: ${best.matched.join(", ")}.`,
  };
}

function extractMerchant(text: string): ParsedField<string> {
  const match = text.match(
    /\b(?:at|from|to)\s+([a-z][a-z0-9&'._-]*(?:\s+[a-z][a-z0-9&'._-]*){0,3})/i,
  );
  if (!match) {
    return { value: null, confidence: 0, reason: "No merchant phrase was found." };
  }

  const merchant = normalizeWhitespace(
    match[1].replace(
      /\b(?:today|yesterday|last\s+(?:sun|mon|tues|wednes|thurs|fri|satur)day)\b.*$/i,
      "",
    ),
  );

  if (!merchant) {
    return { value: null, confidence: 0, reason: "The merchant phrase was empty." };
  }

  return {
    value: merchant,
    confidence: 0.8,
    reason: "Extracted a merchant after a recognised connector.",
  };
}

function extractDescription(text: string): ParsedField<string> {
  let description = ` ${text.toLowerCase()} `;

  description = description
    .replace(/(?:₦|\$|€|£|\b(?:ngn|usd|eur|gbp)\b)\s*\d[\d,]*(?:\.\d+)?\s*[kmb]?/gi, " ")
    .replace(/\b\d[\d,]*(?:\.\d+)?\s*[kmb]?\b/gi, " ")
    .replace(/\b(?:today|yesterday)\b/gi, " ")
    .replace(/\blast\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, " ")
    .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[\/.]\d{1,2}[\/.]20\d{2}\b/g, " ");

  for (const term of [...INCOME_TERMS, ...EXPENSE_TERMS]) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  description = normalizeWhitespace(
    description
      .replace(/\b(?:on|for|at|from|to|the|a|an|my|of)\b/gi, " ")
      .replace(/[^a-z0-9&'._ -]/gi, " "),
  );

  if (!description) {
    return {
      value: null,
      confidence: 0,
      reason: "No useful description remained after extracting structured fields.",
    };
  }

  return {
    value: description,
    confidence: 0.72,
    reason: "Built from the remaining source wording after structured fields were removed.",
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function parseTransactionText(
  input: string,
  context: ParseTransactionContext = {},
): DeterministicTransactionDraft {
  const originalText = input ?? "";
  const normalizedText = normalizeWhitespace(originalText.toLowerCase());
  const now = context.now ? new Date(context.now) : new Date();
  const threshold = context.reviewThreshold ?? DEFAULT_REVIEW_THRESHOLD;
  const rules = context.categoryRules ?? DEFAULT_CATEGORY_RULES;

  if (!normalizedText) {
    const emptyField = { value: null, confidence: 0, reason: "The source message was empty." };
    return {
      original_text: originalText,
      normalized_text: normalizedText,
      fields: {
        amount: emptyField,
        type: emptyField,
        currency_code: emptyField,
        transaction_date: emptyField,
        category_key: emptyField,
        description: emptyField,
        merchant_name: emptyField,
      },
      missing_fields: ["amount", "type", "currency_code", "transaction_date", "category_key"],
      overall_confidence: 0,
      requires_review: true,
    };
  }

  const fields = {
    amount: extractAmount(normalizedText),
    type: extractType(normalizedText),
    currency_code: extractCurrency(normalizedText, context.defaultCurrency),
    transaction_date: extractDate(normalizedText, now),
    category_key: extractCategory(normalizedText, rules),
    description: extractDescription(normalizedText),
    merchant_name: extractMerchant(normalizedText),
  };

  const requiredFieldNames = [
    "amount",
    "type",
    "currency_code",
    "transaction_date",
    "category_key",
  ] as const;

  const missingFields = requiredFieldNames.filter((fieldName) => {
    const field = fields[fieldName];
    return field.value === null || field.confidence < threshold;
  });

  const requiredConfidences = requiredFieldNames.map(
    (fieldName) => fields[fieldName].confidence,
  );
  const overallConfidence = clampConfidence(average(requiredConfidences));

  return {
    original_text: originalText,
    normalized_text: normalizedText,
    fields,
    missing_fields: missingFields,
    overall_confidence: overallConfidence,
    requires_review: missingFields.length > 0,
  };
}
