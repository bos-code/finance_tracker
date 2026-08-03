import type {
  ApiFieldError,
  BackendErrorCode,
} from "@/contracts/backend";

type ProviderErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

const FRIENDLY_MESSAGES: Record<BackendErrorCode, string> = {
  ATTACHMENT_DELETE_FAILED:
    "The private receipt could not be removed. Please try again.",
  ATTACHMENT_READ_FAILED:
    "Private receipts could not be loaded. Please try again.",
  ATTACHMENT_UPLOAD_FAILED:
    "The transaction was kept, but its receipt could not be uploaded.",
  AUTHENTICATION_REQUIRED: "Please sign in and try again.",
  BACKEND_NOT_READY: "Finance data is not ready yet. Please try again shortly.",
  CONFLICT: "That change conflicts with a newer record. Refresh and try again.",
  GOAL_READ_FAILED: "Goals could not be loaded. Please try again.",
  GOAL_WRITE_FAILED: "The goal change could not be saved. Please try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  NETWORK_UNAVAILABLE: "The service could not be reached. Check your connection.",
  PERMISSION_DENIED: "You do not have permission to access that record.",
  RATE_LIMITED: "Too many requests were made. Wait a moment and try again.",
  RESOURCE_NOT_FOUND: "That record no longer exists.",
  TRANSACTION_READ_FAILED: "Transactions could not be loaded. Please try again.",
  TRANSACTION_WRITE_FAILED:
    "The transaction could not be saved. Your entry has not been discarded.",
  VALIDATION_FAILED: "Check the highlighted information and try again.",
};

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly retryable: boolean;
  readonly fieldErrors?: ApiFieldError[];
  readonly cause?: unknown;

  constructor({
    cause,
    code,
    fieldErrors,
    message = FRIENDLY_MESSAGES[code],
    retryable = false,
  }: {
    cause?: unknown;
    code: BackendErrorCode;
    fieldErrors?: ApiFieldError[];
    message?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.retryable = retryable;
    this.fieldErrors = fieldErrors;
    this.cause = cause;
  }
}

function providerDetails(error: unknown) {
  const providerError = (error ?? {}) as ProviderErrorShape;
  return {
    code: String(providerError.code ?? "").toLocaleUpperCase(),
    message: String(providerError.message ?? "").toLocaleLowerCase(),
    status: Number(providerError.status ?? 0),
  };
}

export function toBackendError(
  error: unknown,
  fallbackCode: BackendErrorCode = "INTERNAL_ERROR",
) {
  if (error instanceof BackendError) return error;

  const details = providerDetails(error);
  if (
    details.message.includes("network request failed") ||
    details.message.includes("failed to fetch") ||
    details.message.includes("networkerror") ||
    details.message.includes("timeout")
  ) {
    return new BackendError({
      cause: error,
      code: "NETWORK_UNAVAILABLE",
      retryable: true,
    });
  }

  if (
    details.code === "42883" ||
    details.code === "42P01" ||
    details.code === "PGRST202" ||
    details.code === "PGRST205"
  ) {
    return new BackendError({
      cause: error,
      code: "BACKEND_NOT_READY",
      retryable: false,
    });
  }

  if (
    details.code === "23505" ||
    details.code === "40001" ||
    details.status === 409
  ) {
    return new BackendError({ cause: error, code: "CONFLICT" });
  }

  if (
    ["22023", "23502", "23503", "23514", "22P02"].includes(details.code)
  ) {
    return new BackendError({ cause: error, code: "VALIDATION_FAILED" });
  }

  if (details.status === 401 || details.code === "PGRST301") {
    return new BackendError({
      cause: error,
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  if (details.status === 403 || details.code === "42501") {
    return new BackendError({ cause: error, code: "PERMISSION_DENIED" });
  }

  if (
    details.status === 404 ||
    details.code === "P0002" ||
    details.code === "PGRST116"
  ) {
    return new BackendError({ cause: error, code: "RESOURCE_NOT_FOUND" });
  }

  if (details.status === 429) {
    return new BackendError({
      cause: error,
      code: "RATE_LIMITED",
      retryable: true,
    });
  }

  return new BackendError({
    cause: error,
    code: fallbackCode,
    retryable: fallbackCode === "INTERNAL_ERROR",
  });
}

export function backendErrorMessage(error: unknown) {
  return toBackendError(error).message;
}
