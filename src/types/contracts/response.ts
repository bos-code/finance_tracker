import type { AppError, ErrorCode } from "./errors";

/**
 * Standard API response envelope. Every Edge Function, and every backend
 * service function that crosses a trust boundary (network, another
 * channel), should resolve to one of these two shapes rather than throwing
 * a raw error or returning bare data.
 *
 * Local, same-process helpers (pure calculators, cache readers) are not
 * required to use this envelope — wrap at the boundary, not everywhere.
 */
export type ApiSuccess<T> = {
  status: "success";
  data: T;
};

export type ApiFailure = {
  status: "error";
  error: AppError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { status: "success", data };
}

export function apiFailure(error: AppError): ApiFailure {
  return { status: "error", error };
}

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.status === "success";
}

export function isApiFailure<T>(response: ApiResponse<T>): response is ApiFailure {
  return response.status === "error";
}

/** Narrow a response to its error code without unwrapping the whole object. */
export function getErrorCode<T>(response: ApiResponse<T>): ErrorCode | null {
  return isApiFailure(response) ? response.error.code : null;
}
