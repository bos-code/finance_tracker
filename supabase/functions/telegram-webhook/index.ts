import { createClient } from "npm:@supabase/supabase-js@2.99.1";

import {
  handleTelegramUpdate,
  type ActiveConnection,
  type ChannelStore,
  type ClaimOutcome,
  type LinkOutcome,
  type TelegramUpdate,
} from "./handler.ts";

const JSON_HEADERS = { "content-type": "application/json" };
const PROVIDER = "telegram";
const REVIEWABLE_LIFECYCLES = ["draft", "pending_confirmation", "needs_review"];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secretsMatch(provided: string, expected: string) {
  const [left, right] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function createStore(
  admin: ReturnType<typeof createClient>,
): ChannelStore {
  return {
    async claimEvent(eventId, actorId) {
      const { data, error } = await admin.rpc("claim_channel_webhook_event", {
        p_actor_id: actorId,
        p_event_id: eventId,
        p_provider: PROVIDER,
      });
      if (error) throw error;
      return data as ClaimOutcome;
    },

    async finishEvent(eventId, status, errorCode) {
      const { error } = await admin
        .from("channel_webhook_events")
        .update({
          error_code: errorCode ?? null,
          processed_at: new Date().toISOString(),
          status,
        })
        .eq("provider", PROVIDER)
        .eq("external_event_id", eventId);
      if (error) throw error;
    },

    async findConnection(providerUserId) {
      const { data: connection, error } = await admin
        .from("channel_connections")
        .select("id, owner_user_id, workspace_id")
        .eq("provider", PROVIDER)
        .eq("provider_user_id", providerUserId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!connection) return null;

      const { data: workspace, error: workspaceError } = await admin
        .from("workspaces")
        .select("default_currency")
        .eq("id", connection.workspace_id)
        .maybeSingle();
      if (workspaceError) throw workspaceError;

      return {
        defaultCurrency: workspace?.default_currency ?? "USD",
        id: connection.id,
        ownerUserId: connection.owner_user_id,
        workspaceId: connection.workspace_id,
      } satisfies ActiveConnection;
    },

    async consumeLinkCode(code, providerUserId, chatId) {
      const { data, error } = await admin.rpc("consume_channel_link_code", {
        p_code: code,
        p_provider: PROVIDER,
        p_provider_chat_id: chatId,
        p_provider_user_id: providerUserId,
      });
      if (error) throw error;
      return data as LinkOutcome;
    },

    async disconnect(providerUserId) {
      const { data, error } = await admin.rpc(
        "revoke_channel_connection_for_actor",
        { p_provider: PROVIDER, p_provider_user_id: providerUserId },
      );
      if (error) throw error;
      return data === true;
    },

    async insertDraft(draft) {
      const { error } = await admin.from("transaction_drafts").insert(draft);
      if (!error) return { duplicate: false };
      // The unique (owner, source, source_message_id) index makes a redelivered
      // message a harmless duplicate rather than a second draft.
      if (error.code === "23505") return { duplicate: true };
      throw error;
    },

    async countReviewableDrafts(connection) {
      const { count, error } = await admin
        .from("transaction_drafts")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", connection.ownerUserId)
        .eq("workspace_id", connection.workspaceId)
        .in("lifecycle", REVIEWABLE_LIFECYCLES)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  // Telegram echoes the secret set with setWebhook in this header. It is the
  // only credential on this endpoint, so JWT verification is disabled.
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  const providedSecret =
    request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (
    !webhookSecret ||
    !providedSecret ||
    !(await secretsMatch(providedSecret, webhookSecret))
  ) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "SERVER_MISCONFIGURED" });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }
  if (!update || typeof update.update_id !== "number") {
    return json(400, { error: "INVALID_UPDATE" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await handleTelegramUpdate(update, {
    sendMessage: async (chatId, text) => {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          body: JSON.stringify({
            chat_id: chatId,
            disable_web_page_preview: true,
            text,
          }),
          headers: JSON_HEADERS,
          method: "POST",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) {
        // Log the status only; the URL contains the bot token.
        console.error("telegram sendMessage failed", response.status);
      }
    },
    store: createStore(admin),
  });

  return json(200, { ok: true, status: result.status });
});
