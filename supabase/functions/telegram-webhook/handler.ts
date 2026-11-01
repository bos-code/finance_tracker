import type { TransactionDraftInsert } from "../../../src/contracts/backend.ts";
import {
  aiFillableFieldsFor,
  aiSuggestedFieldNames,
  applyAiSuggestion,
} from "../../../src/features/assistant/ai-suggestions.ts";
import { isPlausibleLinkCode } from "../../../src/features/channels/telegram-link.ts";
import { buildTransactionDraftInsert } from "../../../src/features/drafts/draft-capture.ts";
import { DEFAULT_CATEGORY_RULES } from "../../../src/features/drafts/transaction-parser.ts";
import type { AssistantPort } from "./assistant.ts";

/**
 * Telegram update handling, kept free of Deno and network globals so it can be
 * unit-tested with fakes. index.ts wires it to Supabase and the Bot API.
 */

const MAX_MESSAGE_LENGTH = 4000;

export type TelegramMessage = {
  message_id: number;
  date?: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot?: boolean };
  text?: string;
  photo?: unknown;
  document?: unknown;
  voice?: unknown;
  video?: unknown;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type ActiveConnection = {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  defaultCurrency: string;
  aiAssistEnabled: boolean;
};

export type ClaimOutcome = "new" | "duplicate" | "rate_limited";
export type LinkOutcome = "linked" | "invalid" | "conflict" | "rate_limited";
export type EventStatus = "processed" | "ignored" | "failed";

export interface ChannelStore {
  claimEvent(eventId: string, actorId: string): Promise<ClaimOutcome>;
  finishEvent(
    eventId: string,
    status: EventStatus,
    errorCode?: string,
  ): Promise<void>;
  findConnection(providerUserId: string): Promise<ActiveConnection | null>;
  consumeLinkCode(
    code: string,
    providerUserId: string,
    chatId: string,
  ): Promise<LinkOutcome>;
  disconnect(providerUserId: string): Promise<boolean>;
  setAiAssist(providerUserId: string, enabled: boolean): Promise<boolean>;
  insertDraft(draft: TransactionDraftInsert): Promise<{ duplicate: boolean }>;
  countReviewableDrafts(connection: ActiveConnection): Promise<number>;
}

export type HandlerDeps = {
  store: ChannelStore;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  now?: () => Date;
  /** Optional: when absent or disabled the bot is purely deterministic. */
  assistant?: AssistantPort;
};

export type HandlerResult = {
  status: "processed" | "ignored" | "duplicate" | "rate_limited" | "failed";
};

export const MESSAGES = {
  aiDisabledForChat:
    "AI assistance is off for this chat. Send /ai on to turn it on.",
  aiOff:
    "AI assistance is off. Your messages will not be sent to the AI provider.",
  aiOn: "AI assistance is on. Short messages may be sent to an AI provider to help read them or answer questions.",
  aiUnavailable:
    "The assistant isn’t set up yet, so I can only read messages with simple rules for now.",
  aiUsage: "Send /ai on or /ai off.",
  askUsage: "Ask me something after /ask, for example: /ask how do I attach a receipt?",
  assistantBusy:
    "The assistant isn’t available right now. Send /help to see what I can do.",
  alreadyLinked:
    "This chat is already linked to your Finance Tracker account. Send /help to see what I can do.",
  disconnected:
    "Disconnected. Your data stays in the app. To link again, open Profile → Connections → Telegram.",
  failure:
    "Something went wrong on our side. Please try again in a moment.",
  help: [
    "Send a message like “spent 2500 on lunch” and I’ll save it as a draft for you to review in the app.",
    "",
    "/ask – ask how to use Finance Tracker",
    "/ai on|off – allow or stop AI assistance",
    "/status – check your link",
    "/disconnect – unlink this chat",
    "/help – show this message",
  ].join("\n"),
  linkConflict:
    "This Telegram account or your Finance Tracker account is already linked elsewhere. Disconnect the other link first, then try again.",
  linkInvalid:
    "That code is invalid or has expired. Open Profile → Connections → Telegram in the app to get a new one.",
  linkRateLimited: "Too many attempts. Please wait a few minutes and try again.",
  linked:
    "Linked! Send a message like “spent 2500 on lunch” and I’ll save it as a draft for you to review in the app.",
  linkUsage:
    "Send /link followed by the code from the app, for example: /link K7M2-9QXA",
  mediaSoon:
    "Receipt uploads over Telegram are coming soon. For now, attach receipts to a transaction in the app.",
  notLinked:
    "This chat isn’t linked to a Finance Tracker account yet. Open the app → Profile → Connections → Telegram, then send /link followed by your code.",
  notATransaction:
    "I couldn’t find an amount or whether it was income or an expense. Try something like “spent 2500 on lunch”, or send /help.",
  notLinkedDisconnect: "This chat isn’t linked, so there is nothing to disconnect.",
  privateOnly: "Please message me in a private chat to use Finance Tracker.",
  tooLong: "That message is too long. Please keep it under 4,000 characters.",
  unknownCommand: "I don’t know that command. Send /help to see what I can do.",
  welcome:
    "Welcome to Finance Tracker. To connect your account, open the app → Profile → Connections → Telegram, then send /link followed by the code.",
} as const;

const COMMAND_PATTERN = /^\/([A-Za-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/;

function parseCommand(text: string) {
  const match = COMMAND_PATTERN.exec(text);
  if (!match) return null;
  return { argument: (match[2] ?? "").trim(), name: match[1].toLowerCase() };
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function fieldValue(draft: TransactionDraftInsert, key: string) {
  const field = draft.extracted_fields[key] as { value?: unknown } | undefined;
  return field?.value ?? null;
}

export function draftSummary(draft: TransactionDraftInsert) {
  const amount = fieldValue(draft, "amount");
  const currency = fieldValue(draft, "currency_code");
  const type = fieldValue(draft, "type");
  const category = fieldValue(draft, "category_key");
  const date = fieldValue(draft, "transaction_date");

  const parts = [
    amount !== null ? `${amount}${currency ? ` ${currency}` : ""}` : null,
    type === "Revenue" ? "income" : type === "Expenditure" ? "expense" : null,
    category ? String(category) : null,
    date ? String(date) : null,
  ].filter((part): part is string => part !== null);

  const headline = parts.length
    ? `Saved to your drafts: ${parts.join(" · ")}`
    : "Saved to your drafts.";

  const suggested = aiSuggestedFieldNames(draft);
  const aiNote = suggested.length
    ? `\nThe AI assistant suggested: ${suggested.join(", ")}. Please check ${suggested.length === 1 ? "it" : "them"} in the app.`
    : "";

  if (draft.missing_fields.length > 0) {
    return `${headline}${aiNote}\nStill needed: ${draft.missing_fields.join(", ")}. Open Finance Tracker → Drafts to finish it.`;
  }
  return `${headline}${aiNote}\nOpen Finance Tracker → Drafts to review and confirm.`;
}

function assistantReady(deps: HandlerDeps, connection: ActiveConnection) {
  return Boolean(deps.assistant?.enabled && connection.aiAssistEnabled);
}

async function answerQuestion(
  deps: HandlerDeps,
  connection: ActiveConnection,
  chatId: string,
  question: string,
) {
  if (!deps.assistant?.enabled) {
    await deps.sendMessage(chatId, MESSAGES.aiUnavailable);
  } else if (!connection.aiAssistEnabled) {
    await deps.sendMessage(chatId, MESSAGES.aiDisabledForChat);
  } else {
    const answer = await deps.assistant.answer({
      ownerUserId: connection.ownerUserId,
      question,
    });
    await deps.sendMessage(chatId, answer ?? MESSAGES.assistantBusy);
  }
}

async function linkChat(
  deps: HandlerDeps,
  chatId: string,
  userId: string,
  code: string,
) {
  const outcome = await deps.store.consumeLinkCode(code, userId, chatId);
  const reply =
    outcome === "linked"
      ? MESSAGES.linked
      : outcome === "rate_limited"
        ? MESSAGES.linkRateLimited
        : outcome === "conflict"
          ? MESSAGES.linkConflict
          : MESSAGES.linkInvalid;
  await deps.sendMessage(chatId, reply);
}

async function route(
  deps: HandlerDeps,
  message: TelegramMessage,
  userId: string,
): Promise<"processed" | "ignored"> {
  const chatId = String(message.chat.id);

  if (message.chat.type !== "private") {
    await deps.sendMessage(chatId, MESSAGES.privateOnly);
    return "ignored";
  }

  const text = message.text?.trim();
  if (!text) {
    if (message.photo || message.document || message.voice || message.video) {
      await deps.sendMessage(chatId, MESSAGES.mediaSoon);
      return "processed";
    }
    return "ignored";
  }

  const command = parseCommand(text);
  if (command) {
    switch (command.name) {
      case "start": {
        if (command.argument) {
          await linkChat(deps, chatId, userId, command.argument);
          return "processed";
        }
        const existing = await deps.store.findConnection(userId);
        await deps.sendMessage(
          chatId,
          existing ? MESSAGES.alreadyLinked : MESSAGES.welcome,
        );
        return "processed";
      }
      case "link": {
        if (!command.argument) {
          await deps.sendMessage(chatId, MESSAGES.linkUsage);
        } else {
          await linkChat(deps, chatId, userId, command.argument);
        }
        return "processed";
      }
      case "help":
        await deps.sendMessage(chatId, MESSAGES.help);
        return "processed";
      case "status": {
        const connection = await deps.store.findConnection(userId);
        if (!connection) {
          await deps.sendMessage(chatId, MESSAGES.notLinked);
          return "processed";
        }
        const waiting = await deps.store.countReviewableDrafts(connection);
        const ai = !deps.assistant?.enabled
          ? "not set up"
          : connection.aiAssistEnabled
            ? "on"
            : "off (send /ai on to enable)";
        await deps.sendMessage(
          chatId,
          `Linked. Base currency ${connection.defaultCurrency}. ${plural(waiting, "draft")} waiting for review. AI assistance: ${ai}.`,
        );
        return "processed";
      }
      case "ask": {
        const connection = await deps.store.findConnection(userId);
        if (!connection) {
          await deps.sendMessage(chatId, MESSAGES.notLinked);
        } else if (!command.argument) {
          await deps.sendMessage(chatId, MESSAGES.askUsage);
        } else {
          await answerQuestion(deps, connection, chatId, command.argument);
        }
        return "processed";
      }
      case "ai": {
        const connection = await deps.store.findConnection(userId);
        if (!connection) {
          await deps.sendMessage(chatId, MESSAGES.notLinked);
          return "processed";
        }
        const choice = command.argument.toLowerCase();
        if (choice !== "on" && choice !== "off") {
          await deps.sendMessage(chatId, MESSAGES.aiUsage);
          return "processed";
        }
        await deps.store.setAiAssist(userId, choice === "on");
        await deps.sendMessage(
          chatId,
          choice === "on" ? MESSAGES.aiOn : MESSAGES.aiOff,
        );
        return "processed";
      }
      case "disconnect": {
        const revoked = await deps.store.disconnect(userId);
        await deps.sendMessage(
          chatId,
          revoked ? MESSAGES.disconnected : MESSAGES.notLinkedDisconnect,
        );
        return "processed";
      }
      default:
        await deps.sendMessage(chatId, MESSAGES.unknownCommand);
        return "processed";
    }
  }

  const connection = await deps.store.findConnection(userId);
  if (!connection) {
    // A bare code is a natural thing to paste; accept it as a link attempt.
    if (isPlausibleLinkCode(text)) {
      await linkChat(deps, chatId, userId, text);
    } else {
      await deps.sendMessage(chatId, MESSAGES.notLinked);
    }
    return "processed";
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    await deps.sendMessage(chatId, MESSAGES.tooLong);
    return "processed";
  }

  const parsed = buildTransactionDraftInsert({
    defaultCurrency: connection.defaultCurrency,
    now: deps.now?.(),
    ownerUserId: connection.ownerUserId,
    source: "telegram",
    sourceMessageId: `${chatId}:${message.message_id}`,
    text,
    workspaceId: connection.workspaceId,
  });

  // No amount and no income/expense wording: this is a question or small talk,
  // not a transaction. Don't save an empty draft for it.
  if (
    fieldValue(parsed, "amount") === null &&
    fieldValue(parsed, "type") === null
  ) {
    if (assistantReady(deps, connection)) {
      const answer = await deps.assistant!.answer({
        ownerUserId: connection.ownerUserId,
        question: text,
      });
      await deps.sendMessage(chatId, answer ?? MESSAGES.notATransaction);
    } else {
      await deps.sendMessage(chatId, MESSAGES.notATransaction);
    }
    return "processed";
  }

  // Let the AI suggest only what the rules could not read. Suggestions stay
  // below the review threshold, so the draft still needs a human check.
  let draft = parsed;
  const fieldsNeeded = aiFillableFieldsFor(parsed);
  if (fieldsNeeded.length > 0 && assistantReady(deps, connection)) {
    const suggestion = await deps.assistant!.suggestFields({
      categoryKeys: DEFAULT_CATEGORY_RULES.map((rule) => rule.key),
      fieldsNeeded,
      ownerUserId: connection.ownerUserId,
      text,
    });
    if (suggestion) draft = applyAiSuggestion(parsed, suggestion);
  }

  const { duplicate } = await deps.store.insertDraft(draft);
  await deps.sendMessage(
    chatId,
    duplicate ? "That message was already saved." : draftSummary(draft),
  );
  return "processed";
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const message = update.message;
  const sender = message?.from;
  if (!message || !sender || sender.is_bot) return { status: "ignored" };

  const eventId = String(update.update_id);
  const userId = String(sender.id);

  const claim = await deps.store.claimEvent(eventId, userId);
  if (claim === "duplicate") return { status: "duplicate" };
  if (claim === "rate_limited") return { status: "rate_limited" };

  try {
    const outcome = await route(deps, message, userId);
    await deps.store.finishEvent(eventId, outcome);
    return { status: outcome };
  } catch {
    // Never surface backend details to the chat, and never throw back to
    // Telegram: a non-2xx response only makes it redeliver the same update.
    await deps.store.finishEvent(eventId, "failed", "HANDLER_ERROR").catch(
      () => undefined,
    );
    await deps.sendMessage(String(message.chat.id), MESSAGES.failure).catch(
      () => undefined,
    );
    return { status: "failed" };
  }
}
