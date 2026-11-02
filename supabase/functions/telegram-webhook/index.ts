import { createClient } from "npm:@supabase/supabase-js@2.99.1";

import {
  createAssistant,
  type AiFeature,
  type AssistantQuotaStore,
} from "./assistant.ts";
import {
  handleTelegramUpdate,
  type ActiveConnection,
  type ChannelStore,
  type ClaimOutcome,
  type ConfirmOutcome,
  type DiscardOutcome,
  type LinkOutcome,
  type ReceiptImage,
  type ReceiptPort,
  type TelegramUpdate,
} from "./handler.ts";
import {
  MAX_RECEIPT_BYTES,
  safeReceiptFilename,
  sniffImageType,
} from "../../../src/features/channels/telegram-media.ts";
import type { ChatDraft } from "../../../src/features/drafts/chat-confirmation.ts";

const JSON_HEADERS = { "content-type": "application/json" };
const PROVIDER = "telegram";
const REVIEWABLE_LIFECYCLES = ["draft", "pending_confirmation", "needs_review"];
const RECEIPT_BUCKET = "transaction-receipts";
const DRAFT_COLUMNS =
  "id, owner_user_id, workspace_id, lifecycle, extracted_fields, missing_fields, original_text, expires_at";

function intFromEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(Deno.env.get(name) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

async function sha256Hex(bytes: Uint8Array) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Downloads a photo the person sent. The bot token is part of every Bot API URL,
 * so nothing here logs a URL or an error object, only fixed text and a status.
 */
function createReceiptPort(botToken: string): ReceiptPort {
  const unavailable = { ok: false, reason: "unavailable" } as const;
  return {
    async download(media) {
      try {
        const info = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile`,
          {
            body: JSON.stringify({ file_id: media.fileId }),
            headers: JSON_HEADERS,
            method: "POST",
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!info.ok) {
          console.error("telegram getFile failed", info.status);
          return unavailable;
        }
        const result = (await info.json())?.result;
        if (typeof result?.file_path !== "string" || !result.file_path) {
          return unavailable;
        }
        if (typeof result.file_size === "number" && result.file_size > MAX_RECEIPT_BYTES) {
          return { ok: false, reason: "too_large" } as const;
        }

        const file = await fetch(
          `https://api.telegram.org/file/bot${botToken}/${result.file_path}`,
          { signal: AbortSignal.timeout(15_000) },
        );
        if (!file.ok) {
          console.error("telegram file download failed", file.status);
          return unavailable;
        }
        if (Number(file.headers.get("content-length") ?? 0) > MAX_RECEIPT_BYTES) {
          return { ok: false, reason: "too_large" } as const;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > MAX_RECEIPT_BYTES) {
          return { ok: false, reason: "too_large" } as const;
        }

        // Trust the bytes, not the name or the type Telegram claimed.
        const mimeType = sniffImageType(bytes);
        if (!mimeType) return { ok: false, reason: "not_image" } as const;

        return {
          image: {
            bytes,
            filename: safeReceiptFilename(mimeType, media.filename),
            mimeType,
            providerMediaId: media.providerMediaId,
            sha256: await sha256Hex(bytes),
          },
          ok: true,
        } as const;
      } catch {
        console.error("telegram receipt download failed");
        return unavailable;
      }
    },
  };
}

/**
 * Keeps a receipt photo in the private bucket and records it against the draft.
 * It is attached to a transaction only when the draft is confirmed (a database
 * trigger does that), and removed if the draft is discarded or abandoned.
 */
async function keepReceipt(
  admin: ReturnType<typeof createClient>,
  draft: { owner_user_id: string; workspace_id: string },
  draftId: string,
  receipt: ReceiptImage,
) {
  const attachmentId = crypto.randomUUID();
  const path = `${draft.owner_user_id}/${draft.workspace_id}/${attachmentId}/${receipt.filename}`;

  const { error: uploadError } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, receipt.bytes, {
      contentType: receipt.mimeType,
      upsert: false,
    });
  if (uploadError) {
    console.error("receipt upload failed");
    return false;
  }

  const { error: rowError } = await admin.from("draft_receipts").insert({
    draft_id: draftId,
    file_hash: receipt.sha256,
    file_size_bytes: receipt.bytes.length,
    id: attachmentId,
    mime_type: receipt.mimeType,
    original_filename: receipt.filename,
    owner_user_id: draft.owner_user_id,
    provider_media_id: receipt.providerMediaId,
    storage_path: path,
    workspace_id: draft.workspace_id,
  });
  if (rowError) {
    console.error("receipt record failed");
    // Never leave a photo behind that nothing points to.
    await admin.storage.from(RECEIPT_BUCKET).remove([path]);
    return false;
  }
  return true;
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
        .select("id, owner_user_id, workspace_id, ai_assist_enabled")
        .eq("provider", PROVIDER)
        .eq("provider_user_id", providerUserId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!connection) return null;

      const [workspaceResult, accountResult] = await Promise.all([
        admin
          .from("workspaces")
          .select("default_currency")
          .eq("id", connection.workspace_id)
          .maybeSingle(),
        admin
          .from("financial_accounts")
          .select("id")
          .eq("workspace_id", connection.workspace_id)
          .eq("is_default", true)
          .eq("is_archived", false)
          .maybeSingle(),
      ]);
      if (workspaceResult.error) throw workspaceResult.error;
      if (accountResult.error) throw accountResult.error;

      return {
        aiAssistEnabled: connection.ai_assist_enabled !== false,
        defaultAccountId: accountResult.data?.id ?? null,
        defaultCurrency: workspaceResult.data?.default_currency ?? "USD",
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

    async setAiAssist(providerUserId, enabled) {
      const { data, error } = await admin
        .from("channel_connections")
        .update({ ai_assist_enabled: enabled })
        .eq("provider", PROVIDER)
        .eq("provider_user_id", providerUserId)
        .eq("status", "active")
        .select("id");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },

    async insertDraft(draft, receipt) {
      const { data, error } = await admin
        .from("transaction_drafts")
        .insert(draft)
        .select("id")
        .single();
      if (error) {
        // The unique (owner, source, source_message_id) index makes a redelivered
        // message a harmless duplicate rather than a second draft.
        if (error.code === "23505") return { draftId: null, duplicate: true };
        throw error;
      }
      const draftId: string | null = data?.id ?? null;
      const receiptStored =
        receipt && draftId ? await keepReceipt(admin, draft, draftId, receipt) : false;
      return { draftId, duplicate: false, receiptStored };
    },

    async getDraft(connection, draftId) {
      // Scoped to the connection's owner and workspace, so a button copied from
      // someone else's chat can never reach another person's draft.
      const { data, error } = await admin
        .from("transaction_drafts")
        .select(DRAFT_COLUMNS)
        .eq("id", draftId)
        .eq("owner_user_id", connection.ownerUserId)
        .eq("workspace_id", connection.workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data as ChatDraft | null) ?? null;
    },

    async listOpenDrafts(connection, limit) {
      const { data, error } = await admin
        .from("transaction_drafts")
        .select(DRAFT_COLUMNS)
        .eq("owner_user_id", connection.ownerUserId)
        .eq("workspace_id", connection.workspaceId)
        .in("lifecycle", REVIEWABLE_LIFECYCLES)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ChatDraft[];
    },

    async confirmDraft(providerUserId, draftId, transaction) {
      const { data, error } = await admin.rpc("telegram_confirm_draft", {
        p_account_id: transaction.account_id,
        p_amount: transaction.amount,
        p_base_currency_code: transaction.base_currency_code,
        p_category_id: transaction.category_id,
        p_currency_code: transaction.currency_code,
        p_draft_id: draftId,
        p_exchange_rate: transaction.exchange_rate,
        p_note: transaction.note,
        p_provider_user_id: providerUserId,
        p_transaction_date: transaction.transaction_date,
        p_type: transaction.type,
      });
      if (error) throw error;
      const row = (
        data as { outcome: ConfirmOutcome; result_transaction_id: string | null }[]
      )[0];
      return { outcome: row.outcome, transactionId: row.result_transaction_id };
    },

    async discardDraft(providerUserId, draftId) {
      // The same thing the app's own delete does, with the same limits: only an
      // unconfirmed draft, only the one owned by this chat's linked account.
      const { data: connection, error } = await admin
        .from("channel_connections")
        .select("owner_user_id, workspace_id")
        .eq("provider", PROVIDER)
        .eq("provider_user_id", providerUserId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!connection) return "not_linked";

      // A receipt photo held for this draft goes with it. Looked up first,
      // because once the draft is gone nothing points to the photo any more.
      let held: { id: string; storage_path: string } | null = null;
      try {
        const { data } = await admin
          .from("draft_receipts")
          .select("id, storage_path")
          .eq("draft_id", draftId)
          .eq("owner_user_id", connection.owner_user_id)
          .is("attached_at", null)
          .maybeSingle();
        held = data;
      } catch {
        // Not being able to look must not stop the person discarding.
      }

      const { data: removed, error: removeError } = await admin
        .from("transaction_drafts")
        .delete()
        .eq("id", draftId)
        .eq("owner_user_id", connection.owner_user_id)
        .eq("workspace_id", connection.workspace_id)
        .neq("lifecycle", "confirmed")
        .select("id");
      if (removeError) throw removeError;
      if (removed && removed.length > 0) {
        if (held) {
          // If the photo cannot be removed now its record stays, and the
          // scheduled cleanup removes both later.
          const { error: storageError } = await admin.storage
            .from(RECEIPT_BUCKET)
            .remove([held.storage_path]);
          if (!storageError) {
            await admin.from("draft_receipts").delete().eq("id", held.id);
          }
        }
        return "discarded";
      }

      // Nothing was removed: it was already saved, or it is not this account's.
      const { data: remaining, error: readError } = await admin
        .from("transaction_drafts")
        .select("lifecycle")
        .eq("id", draftId)
        .eq("owner_user_id", connection.owner_user_id)
        .eq("workspace_id", connection.workspace_id)
        .maybeSingle();
      if (readError) throw readError;
      return remaining?.lifecycle === "confirmed"
        ? "already_confirmed"
        : "not_found";
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

function createQuotaStore(
  admin: ReturnType<typeof createClient>,
): AssistantQuotaStore {
  const userLimit = intFromEnv("GEMINI_DAILY_USER_LIMIT", 30);
  const globalLimit = intFromEnv("GEMINI_DAILY_GLOBAL_LIMIT", 300);

  return {
    async claim(ownerUserId: string, feature: AiFeature, model: string) {
      const { data, error } = await admin.rpc("claim_ai_quota", {
        p_feature: feature,
        p_global_daily_limit: globalLimit,
        p_model: model,
        p_owner_user_id: ownerUserId,
        p_user_daily_limit: userLimit,
      });
      if (error) throw error;
      const row = (data as { quota_outcome: string; quota_usage_id: string | null }[])[0];
      return { outcome: row.quota_outcome, usageId: row.quota_usage_id };
    },

    async finish(usageId, outcome, inputTokens, outputTokens) {
      const { error } = await admin.rpc("finish_ai_usage", {
        p_input_tokens: inputTokens,
        p_outcome: outcome,
        p_output_tokens: outputTokens,
        p_usage_id: usageId,
      });
      if (error) throw error;
    },
  };
}

let webhookChecked: Promise<void> | null = null;

/**
 * Save and Discard buttons only reach this function if the webhook allows
 * `callback_query` updates. Webhooks set up earlier were limited to `message`,
 * so once per running instance this widens that list. Best effort: a failure
 * is ignored and never blocks a message.
 */
function ensureButtonTapsAllowed(botToken: string, secret: string) {
  webhookChecked ??= (async () => {
    try {
      const base = `https://api.telegram.org/bot${botToken}`;
      const info = await (
        await fetch(`${base}/getWebhookInfo`, { signal: AbortSignal.timeout(5_000) })
      ).json();
      const url: string | undefined = info?.result?.url;
      const allowed: string[] | undefined = info?.result?.allowed_updates;
      // No list means Telegram's default, which already includes button taps.
      if (!url || !allowed?.length || allowed.includes("callback_query")) return;
      await fetch(`${base}/setWebhook`, {
        body: JSON.stringify({
          allowed_updates: [...allowed, "callback_query"],
          secret_token: secret,
          url,
        }),
        headers: JSON_HEADERS,
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Ignore: the bot still works for messages.
    }
  })();
  return webhookChecked;
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

  await ensureButtonTapsAllowed(botToken, webhookSecret);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The assistant stays off unless both the key and an explicit model name are
  // set; the model is a secret so it can change without a redeploy.
  const assistant = createAssistant(
    {
      apiKey: Deno.env.get("GEMINI_API_KEY"),
      model: Deno.env.get("GEMINI_MODEL"),
    },
    createQuotaStore(admin),
  );

  // The URL contains the bot token, so only the method and status are logged.
  const callTelegram = async (method: string, body: Record<string, unknown>) => {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      {
        body: JSON.stringify(body),
        headers: JSON_HEADERS,
        method: "POST",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) console.error(`telegram ${method} failed`, response.status);
  };

  const result = await handleTelegramUpdate(update, {
    answerCallback: (callbackQueryId, text) =>
      callTelegram("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      }),
    assistant,
    editMessage: (chatId, messageId, text) =>
      callTelegram("editMessageText", {
        chat_id: chatId,
        disable_web_page_preview: true,
        message_id: messageId,
        // An empty keyboard removes the buttons so they cannot be tapped twice.
        reply_markup: { inline_keyboard: [] },
        text,
      }),
    receipts: createReceiptPort(botToken),
    sendMessage: (chatId, text, options) =>
      callTelegram("sendMessage", {
        chat_id: chatId,
        disable_web_page_preview: true,
        ...(options?.buttons
          ? {
              reply_markup: {
                inline_keyboard: options.buttons.map((row) =>
                  row.map((button) => ({
                    callback_data: button.data,
                    text: button.text,
                  })),
                ),
              },
            }
          : {}),
        text,
      }),
    store: createStore(admin),
  });

  return json(200, { ok: true, status: result.status });
});
