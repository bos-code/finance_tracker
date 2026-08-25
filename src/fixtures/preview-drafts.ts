import type { TransactionDraftContract } from "@/contracts/backend";
import {
  applyDraftCorrections,
  draftFieldsFromParser,
  evaluateDraftFields,
  isDraftExpired,
  type TransactionDraftCorrections,
} from "@/features/drafts/draft-review";
import { parseTransactionText } from "@/features/drafts/transaction-parser";
import {
  PREVIEW_USER,
  PREVIEW_WORKSPACE_ID,
} from "@/fixtures/preview-data";
import type {
  CreateTransactionDraftInput,
  CreateTransactionDraftResult,
  ListTransactionDraftOptions,
} from "@/services/supabase/draft-service";

const PARSER_VERSION = "deterministic-v1";

function futureTimestamp(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function buildPreviewDraft({
  id,
  sourceMessageId,
  text,
}: {
  id: string;
  sourceMessageId: string;
  text: string;
}): TransactionDraftContract {
  const timestamp = new Date().toISOString();
  const parsed = parseTransactionText(text, {
    defaultCurrency: "USD",
  });
  const review = evaluateDraftFields(draftFieldsFromParser(parsed));

  return {
    confirmed_transaction_id: null,
    created_at: timestamp,
    expires_at: futureTimestamp(30),
    extracted_fields: review.extracted_fields,
    id,
    lifecycle: review.lifecycle,
    missing_fields: review.missing_fields,
    original_text: text,
    overall_confidence: review.overall_confidence,
    owner_user_id: PREVIEW_USER.uid,
    parser_version: PARSER_VERSION,
    source: "mobile_app",
    source_message_id: sourceMessageId,
    updated_at: timestamp,
    workspace_id: PREVIEW_WORKSPACE_ID,
  };
}

let previewDrafts: TransactionDraftContract[] = [
  buildPreviewDraft({
    id: "preview-draft-review",
    sourceMessageId: "preview-message-review",
    text: "5k food yesterday at Mama Put",
  }),
  buildPreviewDraft({
    id: "preview-draft-ready",
    sourceMessageId: "preview-message-ready",
    text: "received $850 from Acme yesterday for client work",
  }),
];

export async function createPreviewTransactionDraft(
  input: CreateTransactionDraftInput,
): Promise<CreateTransactionDraftResult> {
  const source = input.source ?? "mobile_app";
  const sourceMessageId = input.sourceMessageId?.trim() || null;
  const duplicate = sourceMessageId
    ? previewDrafts.find(
        (draft) =>
          draft.owner_user_id === input.ownerUserId &&
          draft.source === source &&
          draft.source_message_id === sourceMessageId,
      )
    : undefined;
  if (duplicate) return { draft: duplicate, duplicate: true };

  const timestamp = new Date().toISOString();
  const now = input.now ? new Date(input.now) : new Date();
  const parsed = parseTransactionText(input.text, {
    categoryRules: input.categoryRules,
    defaultCurrency: input.defaultCurrency,
    now,
    reviewThreshold: input.reviewThreshold,
  });
  const review = evaluateDraftFields(
    draftFieldsFromParser(parsed),
    input.reviewThreshold,
  );
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const draft: TransactionDraftContract = {
    confirmed_transaction_id: null,
    created_at: timestamp,
    expires_at: expiresAt.toISOString(),
    extracted_fields: review.extracted_fields,
    id: `preview-draft-${Date.now()}`,
    lifecycle: review.lifecycle,
    missing_fields: review.missing_fields,
    original_text: input.text.trim(),
    overall_confidence: review.overall_confidence,
    owner_user_id: input.ownerUserId,
    parser_version: PARSER_VERSION,
    source,
    source_message_id: sourceMessageId,
    updated_at: timestamp,
    workspace_id: input.workspaceId,
  };
  previewDrafts = [draft, ...previewDrafts];
  return { draft, duplicate: false };
}

export async function listPreviewTransactionDrafts(
  workspaceId: string,
  options: ListTransactionDraftOptions = {},
) {
  const now = new Date();
  return previewDrafts
    .filter((draft) => draft.workspace_id === workspaceId)
    .filter((draft) => options.includeExpired || !isDraftExpired(draft, now))
    .filter((draft) => options.includeConfirmed || draft.lifecycle !== "confirmed")
    .filter(
      (draft) =>
        !options.lifecycle?.length || options.lifecycle.includes(draft.lifecycle),
    )
    .sort((first, second) => second.created_at.localeCompare(first.created_at));
}

export async function correctPreviewTransactionDraft(
  draft: TransactionDraftContract,
  corrections: TransactionDraftCorrections,
  reviewThreshold?: number,
) {
  const patch = applyDraftCorrections(draft, corrections, reviewThreshold);
  return updatePreviewDraft(draft.id, patch);
}

export async function markPreviewDraftPendingConfirmation(
  draft: TransactionDraftContract,
) {
  const review = evaluateDraftFields(draft.extracted_fields);
  if (review.missing_fields.length > 0) {
    throw new Error("Review the missing transaction fields before confirming.");
  }
  return updatePreviewDraft(draft.id, {
    ...review,
    lifecycle: "pending_confirmation",
  });
}

export async function confirmPreviewTransactionDraft(
  draft: TransactionDraftContract,
  transactionId: string,
) {
  return updatePreviewDraft(draft.id, {
    confirmed_transaction_id: transactionId,
    lifecycle: "confirmed",
  });
}

export async function deletePreviewTransactionDraft(
  draft: TransactionDraftContract,
) {
  previewDrafts = previewDrafts.filter((item) => item.id !== draft.id);
}

function updatePreviewDraft(
  id: string,
  patch: Partial<TransactionDraftContract>,
) {
  const current = previewDrafts.find((draft) => draft.id === id);
  if (!current) throw new Error("Draft not found in preview data.");
  const updated: TransactionDraftContract = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  previewDrafts = previewDrafts.map((draft) =>
    draft.id === id ? updated : draft,
  );
  return updated;
}
