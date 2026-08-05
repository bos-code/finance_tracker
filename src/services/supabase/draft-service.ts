import type {
  TransactionDraftContract,
  TransactionDraftInsert,
  TransactionDraftLifecycle,
  TransactionSource,
} from "@/contracts/backend";
import {
  applyDraftCorrections,
  draftFieldsFromParser,
  evaluateDraftFields,
  isDraftExpired,
  type TransactionDraftCorrections,
} from "@/features/drafts/draft-review";
import {
  parseTransactionText,
  type ParseTransactionContext,
} from "@/features/drafts/transaction-parser";
import { BackendError, toBackendError } from "@/services/backend/errors";

import { supabaseClient } from "./supabase-client";

export const DETERMINISTIC_PARSER_VERSION = "deterministic-v1";
export const DEFAULT_DRAFT_TTL_DAYS = 30;

export type CreateTransactionDraftInput = Pick<
  ParseTransactionContext,
  "categoryRules" | "defaultCurrency" | "now" | "reviewThreshold"
> & {
  ownerUserId: string;
  source?: TransactionSource;
  sourceMessageId?: string | null;
  text: string;
  workspaceId: string;
};

export type CreateTransactionDraftResult = {
  draft: TransactionDraftContract;
  duplicate: boolean;
};

export type ListTransactionDraftOptions = {
  includeConfirmed?: boolean;
  includeExpired?: boolean;
  lifecycle?: TransactionDraftLifecycle[];
};

function draftsTable() {
  return supabaseClient.from("transaction_drafts");
}

function draftExpiry(now: Date, ttlDays = DEFAULT_DRAFT_TTL_DAYS) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  return expiresAt.toISOString();
}

function validateDraftIdentity(input: CreateTransactionDraftInput) {
  const text = input.text.trim();
  if (!input.ownerUserId.trim() || !input.workspaceId.trim()) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "A signed-in owner and workspace are required to save a draft.",
    });
  }
  if (!text || text.length > 4000) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Transaction text must contain between 1 and 4,000 characters.",
    });
  }
  const sourceMessageId = input.sourceMessageId?.trim() || null;
  if (sourceMessageId && sourceMessageId.length > 255) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "The source message identifier is too long.",
    });
  }
  return { sourceMessageId, text };
}

async function findDuplicateDraft({
  ownerUserId,
  source,
  sourceMessageId,
}: {
  ownerUserId: string;
  source: TransactionSource;
  sourceMessageId: string;
}) {
  const { data, error } = await draftsTable()
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("source", source)
    .eq("source_message_id", sourceMessageId)
    .maybeSingle();
  if (error) throw toBackendError(error, "DRAFT_READ_FAILED");
  return data;
}

export async function getTransactionDraft(
  draftId: string,
  ownerUserId: string,
  workspaceId: string,
) {
  const { data, error } = await draftsTable()
    .select("*")
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw toBackendError(error, "DRAFT_READ_FAILED");
  if (!data) {
    throw new BackendError({ code: "RESOURCE_NOT_FOUND" });
  }
  return data;
}

export async function createTransactionDraft(
  input: CreateTransactionDraftInput,
): Promise<CreateTransactionDraftResult> {
  const { sourceMessageId, text } = validateDraftIdentity(input);
  const source = input.source ?? "mobile_app";

  if (sourceMessageId) {
    const duplicate = await findDuplicateDraft({
      ownerUserId: input.ownerUserId,
      source,
      sourceMessageId,
    });
    if (duplicate) return { draft: duplicate, duplicate: true };
  }

  const now = input.now ? new Date(input.now) : new Date();
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

  const draftInsert: TransactionDraftInsert = {
    expires_at: draftExpiry(now),
    extracted_fields: review.extracted_fields,
    lifecycle: review.lifecycle,
    missing_fields: review.missing_fields,
    original_text: text,
    overall_confidence: review.overall_confidence,
    owner_user_id: input.ownerUserId,
    parser_version: DETERMINISTIC_PARSER_VERSION,
    source,
    source_message_id: sourceMessageId,
    workspace_id: input.workspaceId,
  };

  const { data, error } = await draftsTable()
    .insert(draftInsert)
    .select("*")
    .single();

  if (!error) return { draft: data, duplicate: false };

  const backendError = toBackendError(error, "DRAFT_WRITE_FAILED");
  if (backendError.code === "CONFLICT" && sourceMessageId) {
    const duplicate = await findDuplicateDraft({
      ownerUserId: input.ownerUserId,
      source,
      sourceMessageId,
    });
    if (duplicate) return { draft: duplicate, duplicate: true };
  }
  throw backendError;
}

export async function listTransactionDrafts(
  workspaceId: string,
  options: ListTransactionDraftOptions = {},
) {
  let query = draftsTable()
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (!options.includeExpired) {
    query = query.gt("expires_at", new Date().toISOString());
  }
  if (!options.includeConfirmed) {
    query = query.neq("lifecycle", "confirmed");
  }
  if (options.lifecycle?.length) {
    query = query.in("lifecycle", options.lifecycle);
  }

  const { data, error } = await query;
  if (error) throw toBackendError(error, "DRAFT_READ_FAILED");
  return data ?? [];
}

export async function correctTransactionDraft(
  draft: TransactionDraftContract,
  corrections: TransactionDraftCorrections,
  reviewThreshold?: number,
) {
  if (draft.lifecycle === "confirmed") {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "A confirmed draft can no longer be edited.",
    });
  }
  if (isDraftExpired(draft)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "This draft has expired. Create a new draft from the source text.",
    });
  }

  const patch = applyDraftCorrections(draft, corrections, reviewThreshold);
  const { data, error } = await draftsTable()
    .update(patch)
    .eq("id", draft.id)
    .eq("workspace_id", draft.workspace_id)
    .eq("owner_user_id", draft.owner_user_id)
    .select("*")
    .single();
  if (error) throw toBackendError(error, "DRAFT_WRITE_FAILED");
  return data;
}

export async function markTransactionDraftPendingConfirmation(
  draft: TransactionDraftContract,
) {
  if (draft.lifecycle === "confirmed") return draft;
  if (isDraftExpired(draft)) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "This draft has expired. Create a new draft from the source text.",
    });
  }

  const review = evaluateDraftFields(draft.extracted_fields);
  if (review.missing_fields.length > 0) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      fieldErrors: review.missing_fields.map((field) => ({
        code: "REQUIRED",
        field,
        message: "Review and confirm this field.",
      })),
      message: "Review the missing transaction fields before confirming.",
    });
  }

  const { data, error } = await draftsTable()
    .update({
      ...review,
      lifecycle: "pending_confirmation",
    })
    .eq("id", draft.id)
    .eq("workspace_id", draft.workspace_id)
    .eq("owner_user_id", draft.owner_user_id)
    .select("*")
    .single();
  if (error) throw toBackendError(error, "DRAFT_WRITE_FAILED");
  return data;
}

export async function confirmTransactionDraft(
  draft: TransactionDraftContract,
  transactionId: string,
) {
  const normalizedTransactionId = transactionId.trim();
  if (!normalizedTransactionId) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "A saved transaction is required to confirm this draft.",
    });
  }
  if (
    draft.lifecycle === "confirmed" &&
    draft.confirmed_transaction_id === normalizedTransactionId
  ) {
    return draft;
  }
  if (draft.lifecycle === "confirmed") {
    throw new BackendError({
      code: "CONFLICT",
      message: "This draft is already linked to a different transaction.",
    });
  }
  if (draft.missing_fields.length > 0) {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Resolve every missing field before confirming this draft.",
    });
  }

  const { data, error } = await draftsTable()
    .update({
      confirmed_transaction_id: normalizedTransactionId,
      lifecycle: "confirmed",
    })
    .eq("id", draft.id)
    .eq("workspace_id", draft.workspace_id)
    .eq("owner_user_id", draft.owner_user_id)
    .select("*")
    .single();
  if (!error) return data;

  const backendError = toBackendError(error, "DRAFT_WRITE_FAILED");
  if (
    backendError.code === "CONFLICT" ||
    backendError.code === "VALIDATION_FAILED"
  ) {
    const current = await getTransactionDraft(
      draft.id,
      draft.owner_user_id,
      draft.workspace_id,
    );
    if (
      current.lifecycle === "confirmed" &&
      current.confirmed_transaction_id === normalizedTransactionId
    ) {
      return current;
    }
  }
  throw backendError;
}

export async function deleteTransactionDraft(draft: TransactionDraftContract) {
  if (draft.lifecycle === "confirmed") {
    throw new BackendError({
      code: "VALIDATION_FAILED",
      message: "Confirmed draft history cannot be deleted from this action.",
    });
  }

  const { error } = await draftsTable()
    .delete()
    .eq("id", draft.id)
    .eq("workspace_id", draft.workspace_id)
    .eq("owner_user_id", draft.owner_user_id);
  if (error) throw toBackendError(error, "DRAFT_WRITE_FAILED");
}
