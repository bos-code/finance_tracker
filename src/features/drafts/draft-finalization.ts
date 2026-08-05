import type {
  TransactionDraftContract,
  TransactionInsert,
  TransactionType,
} from "@/contracts/backend";
import {
  ALL_CATEGORIES,
  EXPENDITURE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "@/constants/categories";
import { BackendError } from "@/services/backend/errors";

import { isDraftExpired } from "./draft-review";

export type FinalizeDraftContext = {
  accountId: string;
  baseCurrencyCode: string;
  exchangeRate?: number | null;
  now?: Date;
  ownerUserId: string;
  workspaceId: string;
};

const CATEGORY_ALIASES: Record<string, string> = {
  education: "school",
  food: "eat",
  housing: "house",
};

function fieldValue(draft: TransactionDraftContract, fieldName: string) {
  return draft.extracted_fields[fieldName]?.value ?? null;
}

function requiredText(
  draft: TransactionDraftContract,
  fieldName: string,
): string {
  const value = fieldValue(draft, fieldName);
  if (typeof value !== "string" || !value.trim()) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "REQUIRED",
          field: fieldName,
          message: "Review and confirm this field.",
        },
      ],
      message: `The ${fieldName.replaceAll("_", " ")} field is required.`,
    });
  }
  return value.trim();
}

function validISODate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function resolveTransactionType(draft: TransactionDraftContract): TransactionType {
  const value = requiredText(draft, "type");
  if (value !== "Expenditure" && value !== "Revenue") {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "INVALID",
          field: "type",
          message: "Choose income or expense.",
        },
      ],
      message: "Choose whether this transaction is income or an expense.",
    });
  }
  return value;
}

function resolveCategoryId(
  draft: TransactionDraftContract,
  type: TransactionType,
) {
  const rawCategory = requiredText(draft, "category_key").toLowerCase();
  let categoryId = CATEGORY_ALIASES[rawCategory] ?? rawCategory;

  if (rawCategory === "utilities") {
    const source = draft.original_text.toLowerCase();
    categoryId = /\b(?:airtime|data|internet|phone)\b/.test(source)
      ? "phone"
      : /\b(?:electricity|power)\b/.test(source)
        ? "electricity"
        : "utilities";
  }

  const allowed =
    type === "Revenue" ? REVENUE_CATEGORIES : EXPENDITURE_CATEGORIES;
  const validForType = allowed.some((category) => category.id === categoryId);
  if (!ALL_CATEGORIES[categoryId] || !validForType) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "INVALID",
          field: "category_key",
          message: "Choose a category that matches this transaction type.",
        },
      ],
      message: "Choose a valid ledger category before saving this draft.",
    });
  }
  return categoryId;
}

function resolveAmount(draft: TransactionDraftContract) {
  const value = fieldValue(draft, "amount");
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "INVALID",
          field: "amount",
          message: "Enter a positive amount.",
        },
      ],
      message: "Enter a valid positive transaction amount.",
    });
  }
  return Number(amount.toFixed(2));
}

function resolveCurrency(draft: TransactionDraftContract) {
  const currency = requiredText(draft, "currency_code").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "INVALID",
          field: "currency_code",
          message: "Use a three-letter currency code.",
        },
      ],
      message: "Use a valid three-letter currency code.",
    });
  }
  return currency;
}

function resolveExchangeRate(
  currencyCode: string,
  baseCurrencyCode: string,
  suppliedRate: number | null | undefined,
) {
  if (currencyCode === baseCurrencyCode) return 1;
  if (!Number.isFinite(suppliedRate) || Number(suppliedRate) <= 0) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "REQUIRED",
          field: "exchange_rate",
          message: `Enter how many ${baseCurrencyCode} equal one ${currencyCode}.`,
        },
      ],
      message: `Enter a manual ${currencyCode} to ${baseCurrencyCode} exchange rate.`,
    });
  }
  return Number(Number(suppliedRate).toFixed(8));
}

function resolveNote(draft: TransactionDraftContract) {
  const description = fieldValue(draft, "description");
  const merchant = fieldValue(draft, "merchant_name");
  const parts = [description, merchant]
    .filter((value): value is string => typeof value === "string" && !!value.trim())
    .map((value) => value.trim());
  return (parts.join(" — ") || draft.original_text.trim()).slice(0, 500);
}

export function draftTransactionIdempotencyKey(draftId: string) {
  return `transaction:draft:${draftId}`;
}

export function transactionInsertFromDraft(
  draft: TransactionDraftContract,
  context: FinalizeDraftContext,
): TransactionInsert {
  if (
    draft.owner_user_id !== context.ownerUserId ||
    draft.workspace_id !== context.workspaceId
  ) {
    throw new BackendError({ code: "PERMISSION_DENIED" });
  }
  if (draft.lifecycle !== "pending_confirmation") {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Review the draft and mark it ready before saving it to the ledger.",
    });
  }
  if (draft.missing_fields.length > 0) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Resolve every missing draft field before saving it to the ledger.",
    });
  }
  if (isDraftExpired(draft, context.now)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "This draft has expired. Create a new draft from the source text.",
    });
  }
  if (!context.accountId.trim()) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Choose an account before saving this transaction.",
    });
  }

  const type = resolveTransactionType(draft);
  const amount = resolveAmount(draft);
  const currencyCode = resolveCurrency(draft);
  const baseCurrencyCode = context.baseCurrencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(baseCurrencyCode)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "The workspace base currency is not valid.",
    });
  }
  const transactionDate = requiredText(draft, "transaction_date");
  if (!validISODate(transactionDate)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: [
        {
          code: "INVALID",
          field: "transaction_date",
          message: "Use YYYY-MM-DD.",
        },
      ],
      message: "Use a valid transaction date in YYYY-MM-DD format.",
    });
  }

  return {
    account_id: context.accountId,
    amount,
    base_currency_code: baseCurrencyCode,
    category_id: resolveCategoryId(draft, type),
    currency_code: currencyCode,
    exchange_rate: resolveExchangeRate(
      currencyCode,
      baseCurrencyCode,
      context.exchangeRate,
    ),
    note: resolveNote(draft),
    transaction_date: transactionDate,
    type,
    user_id: context.ownerUserId,
    workspace_id: context.workspaceId,
  };
}
