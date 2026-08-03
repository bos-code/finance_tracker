import type { ApiResult } from "@/contracts/backend";
import { BackendError, toBackendError } from "@/services/backend/errors";
import { supabaseClient } from "@/services/supabase/supabase-client";

/**
 * Typed boundary for trusted Supabase Edge Functions.
 *
 * The Supabase SDK supplies the current bearer token and project URL. Edge
 * Functions return the canonical ApiResult envelope, so no screen needs to
 * understand FunctionsHttpError or provider response bodies.
 */
export async function invokeEdgeFunction<TResponse>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  const { data, error } = await supabaseClient.functions.invoke<
    ApiResult<TResponse>
  >(functionName, { body });

  if (error) throw toBackendError(error);
  if (!data) {
    throw new BackendError({
      code: "INTERNAL_ERROR",
      message: "The service returned no response. Please try again.",
      retryable: true,
    });
  }
  if (!data.ok) {
    throw new BackendError({
      code: data.error.code,
      fieldErrors: data.error.field_errors,
      message: data.error.message,
      retryable: data.error.retryable,
    });
  }

  return data.data;
}
