import type {
  TransactionDraftContract,
  TransactionInsert,
} from "@/contracts/backend";

import { ALL_CATEGORIES } from "../../constants/categories.ts";
import { BackendError } from "../../services/backend/errors.ts";
import { transactionInsertFromDraft } from "./draft-finalization.ts";
import {
  applyDraftCorrections,
  isDraftExpired,
  REQUIRED_DRAFT_FIELDS,
  type TransactionDraftCorrections,
} from "./draft-review.ts";

/**
 * Deciding whether a draft can be saved straight from a chat (Telegram), and
 * building the transaction to save. Pure, so the app, the tests and the edge
 * function all share one set of rules with the in-app review screen.
 *
 * Tapping Save in a chat is the review: the message shows every value first.
 * A draft is saveable when every required value is present and valid; values
 * the parser or the AI was unsure about are listed so the person can look twice.
 */

/** The parts of a draft this needs, so a freshly inserted draft qualifies too. */
export type ChatDraft = Pick<
  TransactionDraftContract,
  | "expires_at"
  | "extracted_fields"
  | "id"
  | "lifecycle"
  | "missing_fields"
  | "original_text"
  | "owner_user_id"
  | "workspace_id"
>;

export type ChatConfirmationContext = {
  /** The workspace's default account; null when none could be found. */
  accountId: string | null;
  baseCurrencyCode: string;
  now?: Date;
};

export type ChatConfirmation =
  | {
      status: "ready";
      transaction: TransactionInsert;
      /** Field names the parser or AI was unsure about; worth a second look. */
      check: string[];
    }
  | { status: "blocked"; reason: string };

const FIELD_LABELS: Record<string, string> = {
  amount: "amount",
  category_key: "category",
  currency_code: "currency",
  transaction_date: "date",
  type: "income or expense",
};

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field.replaceAll("_", " ");
}

const FINISH_IN_APP = "Open Finance Tracker → Drafts to finish it.";

export function assessDraftForChat(
  draft: ChatDraft,
  context: ChatConfirmationContext,
): ChatConfirmation {
  if (draft.lifecycle === "confirmed") {
    return { reason: "This draft is already saved to your ledger.", status: "blocked" };
  }
  if (isDraftExpired(draft, context.now)) {
    return {
      reason: "This draft has expired. Send the message again to make a new one.",
      status: "blocked",
    };
  }

  // Treat the values on screen as confirmed, exactly as the in-app review does
  // when a person accepts them. A value that is missing stays missing.
  const accepted: TransactionDraftCorrections = {};
  for (const field of REQUIRED_DRAFT_FIELDS) {
    accepted[field] = draft.extracted_fields[field]?.value ?? null;
  }
  const reviewed = applyDraftCorrections(draft, accepted);
  if (reviewed.missing_fields.length > 0) {
    const needed = reviewed.missing_fields.map(fieldLabel).join(", ");
    return { reason: `Still needed: ${needed}. ${FINISH_IN_APP}`, status: "blocked" };
  }
  if (!context.accountId) {
    return {
      reason: "No default account was found for this workspace. Open Finance Tracker to set one up.",
      status: "blocked",
    };
  }

  try {
    const transaction = transactionInsertFromDraft(
      // transactionInsertFromDraft reads only the fields in ChatDraft.
      {
        ...draft,
        extracted_fields: reviewed.extracted_fields,
        lifecycle: "pending_confirmation",
        missing_fields: [],
      } as unknown as TransactionDraftContract,
      {
        accountId: context.accountId,
        baseCurrencyCode: context.baseCurrencyCode,
        now: context.now,
        ownerUserId: draft.owner_user_id,
        workspaceId: draft.workspace_id,
      },
    );
    const check = draft.missing_fields.filter((field) =>
      (REQUIRED_DRAFT_FIELDS as readonly string[]).includes(field),
    );
    return { check, status: "ready", transaction };
  } catch (error) {
    if (error instanceof BackendError) {
      return { reason: `${error.message} ${FINISH_IN_APP}`, status: "blocked" };
    }
    throw error;
  }
}

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

/** One line a person can check at a glance: "2,500 NGN · expense · Eat & drink · 2026-10-22". */
export function transactionSummary(
  transaction: Pick<
    TransactionInsert,
    "amount" | "category_id" | "currency_code" | "transaction_date" | "type"
  >,
) {
  const category =
    ALL_CATEGORIES[transaction.category_id]?.label ?? transaction.category_id;
  return [
    `${formatAmount(transaction.amount)} ${transaction.currency_code}`,
    transaction.type === "Revenue" ? "income" : "expense",
    category,
    transaction.transaction_date,
  ].join(" · ");
}
