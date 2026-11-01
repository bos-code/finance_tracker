import type { BotConnectionContract } from "@/contracts/backend";
import { BackendError, toBackendError } from "@/services/backend/errors";

import { supabaseClient } from "./supabase-client";

export type TelegramLinkCode = {
  /** Display form, XXXX-XXXX. Shown once; only its hash is stored. */
  code: string;
  expiresAt: string;
};

export async function getTelegramConnection(
  userId: string,
): Promise<BotConnectionContract | null> {
  const { data, error } = await supabaseClient
    .from("channel_connections")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("provider", "telegram")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw toBackendError(error, "INTERNAL_ERROR");
  return data;
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  const { data, error } = await supabaseClient.rpc("create_channel_link_code", {
    p_provider: "telegram",
  });

  if (error) {
    const backendError = toBackendError(error, "INTERNAL_ERROR");
    if (backendError.code === "CONFLICT") {
      throw new BackendError({
        cause: error,
        code: "CONFLICT",
        message: "Telegram is already connected to this account.",
      });
    }
    if (backendError.code === "RATE_LIMITED") {
      throw new BackendError({
        cause: error,
        code: "RATE_LIMITED",
        message: "You have requested too many codes. Try again in an hour.",
        retryable: true,
      });
    }
    throw backendError;
  }

  const row = data?.[0];
  if (!row) throw new BackendError({ code: "INTERNAL_ERROR" });
  return { code: row.link_code, expiresAt: row.link_expires_at };
}

export async function disconnectTelegram(connectionId: string): Promise<void> {
  const { error } = await supabaseClient.rpc("revoke_channel_connection", {
    p_connection_id: connectionId,
  });
  if (error) throw toBackendError(error, "INTERNAL_ERROR");
}
