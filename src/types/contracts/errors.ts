/**
 * Canonical error-code catalogue for the Finance Tracker backend.
 *
 * Every backend failure (Supabase, Edge Functions, parser, AI fallback,
 * Telegram webhook, etc.) must be mapped to one of these codes before it
 * reaches a client. Raw Postgres/PostgREST/network errors must never be
 * forwarded to the mobile app or Telegram bot directly — see
 * docs/backend/error-codes.md for the user-facing message mapped to each
 * code and the reasoning behind each category.
 *
 * Category prefixes match the response categories required by
 * PLAN_BACKEND.md Stage 1: validation, authentication, permission,
 * conflict, rate limit, and server failure.
 */

export const ErrorCategory = {
  Validation: "validation",
  Authentication: "authentication",
  Permission: "permission",
  Conflict: "conflict",
  RateLimit: "rate_limit",
  NotFound: "not_found",
  Server: "server",
  Offline: "offline",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

export const ErrorCode = {
  // Validation (4xx — bad input)
  VALIDATION_FAILED: "validation_failed",
  MISSING_FIELD: "missing_field",
  INVALID_FIELD: "invalid_field",
  UNSUPPORTED_FILE_TYPE: "unsupported_file_type",
  FILE_TOO_LARGE: "file_too_large",

  // Authentication (401)
  UNAUTHENTICATED: "unauthenticated",
  SESSION_EXPIRED: "session_expired",
  INVALID_CREDENTIALS: "invalid_credentials",

  // Permission (403)
  FORBIDDEN: "forbidden",
  NOT_OWNER: "not_owner",
  WORKSPACE_ACCESS_DENIED: "workspace_access_denied",

  // Conflict (409)
  CONFLICT: "conflict",
  ALREADY_EXISTS: "already_exists",
  DUPLICATE_REQUEST: "duplicate_request",
  STALE_UPDATE: "stale_update",

  // Rate limit (429)
  RATE_LIMITED: "rate_limited",
  QUOTA_EXCEEDED: "quota_exceeded",
  AI_LIMIT_REACHED: "ai_limit_reached",

  // Not found (404)
  NOT_FOUND: "not_found",

  // Server failure (5xx)
  SERVER_ERROR: "server_error",
  UPSTREAM_UNAVAILABLE: "upstream_unavailable",
  TIMEOUT: "timeout",

  // Offline / connectivity (client-observed, not HTTP)
  OFFLINE: "offline",
  SYNC_FAILED: "sync_failed",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_CODE_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.VALIDATION_FAILED]: ErrorCategory.Validation,
  [ErrorCode.MISSING_FIELD]: ErrorCategory.Validation,
  [ErrorCode.INVALID_FIELD]: ErrorCategory.Validation,
  [ErrorCode.UNSUPPORTED_FILE_TYPE]: ErrorCategory.Validation,
  [ErrorCode.FILE_TOO_LARGE]: ErrorCategory.Validation,

  [ErrorCode.UNAUTHENTICATED]: ErrorCategory.Authentication,
  [ErrorCode.SESSION_EXPIRED]: ErrorCategory.Authentication,
  [ErrorCode.INVALID_CREDENTIALS]: ErrorCategory.Authentication,

  [ErrorCode.FORBIDDEN]: ErrorCategory.Permission,
  [ErrorCode.NOT_OWNER]: ErrorCategory.Permission,
  [ErrorCode.WORKSPACE_ACCESS_DENIED]: ErrorCategory.Permission,

  [ErrorCode.CONFLICT]: ErrorCategory.Conflict,
  [ErrorCode.ALREADY_EXISTS]: ErrorCategory.Conflict,
  [ErrorCode.DUPLICATE_REQUEST]: ErrorCategory.Conflict,
  [ErrorCode.STALE_UPDATE]: ErrorCategory.Conflict,

  [ErrorCode.RATE_LIMITED]: ErrorCategory.RateLimit,
  [ErrorCode.QUOTA_EXCEEDED]: ErrorCategory.RateLimit,
  [ErrorCode.AI_LIMIT_REACHED]: ErrorCategory.RateLimit,

  [ErrorCode.NOT_FOUND]: ErrorCategory.NotFound,

  [ErrorCode.SERVER_ERROR]: ErrorCategory.Server,
  [ErrorCode.UPSTREAM_UNAVAILABLE]: ErrorCategory.Server,
  [ErrorCode.TIMEOUT]: ErrorCategory.Server,

  [ErrorCode.OFFLINE]: ErrorCategory.Offline,
  [ErrorCode.SYNC_FAILED]: ErrorCategory.Offline,
};

/**
 * User-facing copy for each error code. Never show a raw Supabase/Postgres
 * message to the user — map through this table (or extend it) instead.
 * Keep messages short, calm, and free of internal identifiers.
 */
export const ERROR_CODE_MESSAGE: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_FAILED]: "Some of this information doesn't look right. Please check and try again.",
  [ErrorCode.MISSING_FIELD]: "Please fill in the missing information.",
  [ErrorCode.INVALID_FIELD]: "One of the fields entered isn't valid.",
  [ErrorCode.UNSUPPORTED_FILE_TYPE]: "That file type isn't supported. Try a PDF, JPEG, PNG, or WebP.",
  [ErrorCode.FILE_TOO_LARGE]: "That file is too large to upload.",

  [ErrorCode.UNAUTHENTICATED]: "Please sign in to continue.",
  [ErrorCode.SESSION_EXPIRED]: "Your session has expired. Please sign in again.",
  [ErrorCode.INVALID_CREDENTIALS]: "That email and password combination doesn't match our records.",

  [ErrorCode.FORBIDDEN]: "You don't have permission to do that.",
  [ErrorCode.NOT_OWNER]: "This item doesn't belong to your account.",
  [ErrorCode.WORKSPACE_ACCESS_DENIED]: "You don't have access to this workspace.",

  [ErrorCode.CONFLICT]: "This was already updated elsewhere. Please refresh and try again.",
  [ErrorCode.ALREADY_EXISTS]: "This already exists.",
  [ErrorCode.DUPLICATE_REQUEST]: "This was already submitted.",
  [ErrorCode.STALE_UPDATE]: "This record changed since you last loaded it.",

  [ErrorCode.RATE_LIMITED]: "You're doing that a bit too fast. Please wait a moment and try again.",
  [ErrorCode.QUOTA_EXCEEDED]: "You've reached today's limit for this action.",
  [ErrorCode.AI_LIMIT_REACHED]: "Smart parsing is temporarily unavailable, but you can still enter this manually.",

  [ErrorCode.NOT_FOUND]: "We couldn't find that.",

  [ErrorCode.SERVER_ERROR]: "Something went wrong on our end. Please try again.",
  [ErrorCode.UPSTREAM_UNAVAILABLE]: "A service we depend on is temporarily unavailable. Please try again shortly.",
  [ErrorCode.TIMEOUT]: "That took too long to respond. Please try again.",

  [ErrorCode.OFFLINE]: "You're offline. This will be saved and synced automatically once you're back online.",
  [ErrorCode.SYNC_FAILED]: "This couldn't sync yet. It's safe on your device and will retry automatically.",
};

/** HTTP status suggested for each code, for server-side (Edge Function) responses. */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.INVALID_FIELD]: 400,
  [ErrorCode.UNSUPPORTED_FILE_TYPE]: 400,
  [ErrorCode.FILE_TOO_LARGE]: 413,

  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,

  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_OWNER]: 403,
  [ErrorCode.WORKSPACE_ACCESS_DENIED]: 403,

  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.DUPLICATE_REQUEST]: 409,
  [ErrorCode.STALE_UPDATE]: 409,

  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  [ErrorCode.AI_LIMIT_REACHED]: 429,

  [ErrorCode.NOT_FOUND]: 404,

  [ErrorCode.SERVER_ERROR]: 500,
  [ErrorCode.UPSTREAM_UNAVAILABLE]: 502,
  [ErrorCode.TIMEOUT]: 504,

  [ErrorCode.OFFLINE]: 0,
  [ErrorCode.SYNC_FAILED]: 0,
};

export type AppError = {
  code: ErrorCode;
  message: string;
  /** Machine-readable extra context (field name, retry-after seconds, etc.) */
  details?: Record<string, unknown>;
  /** Correlates this error with server-side logs. */
  requestId?: string;
};

/** Builds an AppError with the catalogue's default user-facing message. */
export function createAppError(
  code: ErrorCode,
  overrides?: Partial<Pick<AppError, "message" | "details" | "requestId">>,
): AppError {
  return {
    code,
    message: overrides?.message ?? ERROR_CODE_MESSAGE[code],
    details: overrides?.details,
    requestId: overrides?.requestId,
  };
}
