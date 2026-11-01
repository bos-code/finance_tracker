import type { BotConnectionContract } from "@/contracts/backend";
import {
  PREVIEW_USER,
  PREVIEW_WORKSPACE_ID,
} from "@/fixtures/preview-data";
import { LINK_CODE_TTL_MINUTES } from "@/features/channels/telegram-link";
import type { TelegramLinkCode } from "@/services/supabase/channel-service";

/**
 * In-memory stand-in for UI preview mode. Preview has no backend, so linking is
 * simulated: generating a code leaves the account unlinked, and the "connected"
 * state is only reachable by the connection panel's preview shortcut.
 */
let connection: BotConnectionContract | null = null;

export async function getPreviewTelegramConnection() {
  return connection;
}

export async function createPreviewTelegramLinkCode(): Promise<TelegramLinkCode> {
  return {
    code: "K7M2-9QXA",
    expiresAt: new Date(
      Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000,
    ).toISOString(),
  };
}

export async function simulatePreviewTelegramLink() {
  connection = {
    ai_assist_enabled: true,
    id: "preview-telegram-connection",
    linked_at: new Date().toISOString(),
    owner_user_id: PREVIEW_USER.uid,
    provider: "telegram",
    provider_chat_id: "preview",
    provider_user_id: "preview",
    revoked_at: null,
    status: "active",
    workspace_id: PREVIEW_WORKSPACE_ID,
  };
  return connection;
}

export async function disconnectPreviewTelegram() {
  connection = null;
}
