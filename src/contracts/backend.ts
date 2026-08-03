/**
 * Canonical Finance Tracker backend contracts.
 *
 * Database-facing records use snake_case because the current mobile client
 * talks directly to Supabase/PostgREST. Edge Functions must translate their
 * responses into ApiResult rather than exposing provider-specific errors.
 */

export const TRANSACTION_LIFECYCLE_STATES = [
  "draft",
  "pending_confirmation",
  "confirmed",
  "needs_review",
  "reversed",
  "deleted",
] as const;

export const TRANSACTION_SOURCES = [
  "mobile_app",
  "telegram",
  "whatsapp",
  "web_dashboard",
  "import",
  "system",
] as const;

export const SYNC_STATES = [
  "local_only",
  "queued",
  "syncing",
  "synced",
  "failed",
  "conflict",
] as const;

export const BACKEND_ERROR_CODES = [
  "VALIDATION_FAILED",
  "AUTHENTICATION_REQUIRED",
  "PERMISSION_DENIED",
  "RESOURCE_NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "NETWORK_UNAVAILABLE",
  "BACKEND_NOT_READY",
  "TRANSACTION_READ_FAILED",
  "TRANSACTION_WRITE_FAILED",
  "GOAL_READ_FAILED",
  "GOAL_WRITE_FAILED",
  "INTERNAL_ERROR",
] as const;

export type TransactionLifecycle =
  (typeof TRANSACTION_LIFECYCLE_STATES)[number];
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];
export type SyncState = (typeof SYNC_STATES)[number];
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

export type ISODateString = string;
export type ISODateTimeString = string;
export type CurrencyCode = string;
export type EntityId = string;

export type TransactionType = "Expenditure" | "Revenue";

/** Transaction row after the additive Stage 2 reliability migration. */
export type TransactionRecord = {
  id: EntityId;
  user_id: EntityId;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  transaction_date: ISODateString;
  idempotency_key: string | null;
  lifecycle: TransactionLifecycle;
  source: TransactionSource;
  revision: number;
  deleted_at: ISODateTimeString | null;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type TransactionInsert = Pick<
  TransactionRecord,
  | "user_id"
  | "type"
  | "amount"
  | "note"
  | "category_id"
  | "transaction_date"
>;

export type TransactionUpdate = Partial<
  Omit<TransactionInsert, "user_id">
>;

export type TransactionView = TransactionRecord & {
  sync_state: SyncState;
  sync_error_code?: BackendErrorCode;
};

export type GoalType = "saving" | "item";
export type GoalStatus = "active" | "completed";

export type GoalRecord = {
  id: EntityId;
  user_id: EntityId;
  title: string;
  goal_type: GoalType;
  target_amount: number;
  saved_amount: number;
  currency_code: CurrencyCode;
  target_date: ISODateString | null;
  notes: string | null;
  icon_name: string;
  color: string;
  status: GoalStatus;
  completed_at: ISODateTimeString | null;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type GoalInsert = Omit<
  GoalRecord,
  "id" | "created_at" | "updated_at" | "completed_at"
> & {
  completed_at?: ISODateTimeString | null;
};

export type GoalUpdate = Partial<
  Omit<GoalRecord, "id" | "user_id" | "created_at" | "updated_at">
>;

export type UserContract = {
  id: EntityId;
  email: string;
  full_name: string | null;
  country_code: string | null;
  locale: string | null;
  timezone: string | null;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type WorkspaceContract = {
  id: EntityId;
  owner_user_id: EntityId;
  name: string;
  default_currency: CurrencyCode;
  currency_detection_source: "device_region" | "manual" | "migration";
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type FinancialAccountType =
  | "cash"
  | "bank"
  | "savings"
  | "mobile_money"
  | "card"
  | "custom";

export type FinancialAccountContract = {
  id: EntityId;
  workspace_id: EntityId;
  owner_user_id: EntityId;
  name: string;
  account_type: FinancialAccountType;
  currency_code: CurrencyCode;
  opening_balance: number;
  is_archived: boolean;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type CategoryContract = {
  id: EntityId;
  workspace_id: EntityId | null;
  owner_user_id: EntityId | null;
  transaction_type: TransactionType;
  key: string;
  label: string;
  icon_name: string;
  signal_color: string;
  is_system: boolean;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type CurrencyContract = {
  code: CurrencyCode;
  numeric_code: string;
  name: string;
  minor_unit: number;
  symbol: string;
};

export type AttachmentProcessingStatus =
  | "uploaded"
  | "extracting_text"
  | "processed"
  | "failed"
  | "needs_review";

export type TransactionAttachmentContract = {
  id: EntityId;
  owner_user_id: EntityId;
  workspace_id: EntityId;
  transaction_id: EntityId | null;
  draft_id: EntityId | null;
  storage_path: string;
  original_filename: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  file_size_bytes: number;
  file_hash: string;
  upload_source: TransactionSource;
  provider_media_id: string | null;
  processing_status: AttachmentProcessingStatus;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type FieldConfidence = {
  value: unknown;
  confidence: number;
  reason: string | null;
};

export type TransactionDraftContract = {
  id: EntityId;
  owner_user_id: EntityId;
  workspace_id: EntityId;
  source: TransactionSource;
  source_message_id: string | null;
  original_text: string;
  lifecycle: Extract<
    TransactionLifecycle,
    "draft" | "pending_confirmation" | "needs_review"
  >;
  extracted_fields: Record<string, FieldConfidence>;
  missing_fields: string[];
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type BotProvider = "telegram" | "whatsapp";

export type BotConnectionContract = {
  id: EntityId;
  owner_user_id: EntityId;
  workspace_id: EntityId;
  provider: BotProvider;
  provider_user_id: string;
  provider_chat_id: string;
  status: "active" | "revoked";
  linked_at: ISODateTimeString;
  revoked_at: ISODateTimeString | null;
};

export type AIUsageContract = {
  id: EntityId;
  owner_user_id: EntityId;
  feature: "transaction_parser" | "receipt_parser";
  provider: "gemini";
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  outcome: "success" | "failure" | "limited" | "fallback";
  created_at: ISODateTimeString;
};

export type ApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ApiMeta = {
  request_id: string;
  timestamp: ISODateTimeString;
};

export type ApiErrorPayload = {
  code: BackendErrorCode;
  message: string;
  retryable: boolean;
  field_errors?: ApiFieldError[];
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorPayload;
  meta: ApiMeta;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(
  data: T,
  requestId: string,
  timestamp = new Date().toISOString(),
): ApiSuccess<T> {
  return {
    data,
    meta: { request_id: requestId, timestamp },
    ok: true,
  };
}

export function apiFailure(
  error: ApiErrorPayload,
  requestId: string,
  timestamp = new Date().toISOString(),
): ApiFailure {
  return {
    error,
    meta: { request_id: requestId, timestamp },
    ok: false,
  };
}
