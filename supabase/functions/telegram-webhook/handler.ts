import type {
  TransactionDraftInsert,
  TransactionInsert,
} from "../../../src/contracts/backend.ts";
import {
  aiFillableFieldsFor,
  aiSuggestedFieldNames,
  applyAiSuggestion,
} from "../../../src/features/assistant/ai-suggestions.ts";
import {
  applyReceiptReading,
  hasAnyReading,
  RECEIPT_CATEGORY_KEYS,
  RECEIPT_PLACEHOLDER_TEXT,
} from "../../../src/features/assistant/receipt-extraction.ts";
import { isPlausibleLinkCode } from "../../../src/features/channels/telegram-link.ts";
import {
  pickReceiptMedia,
  type ReceiptMedia,
  type ReceiptMimeType,
} from "../../../src/features/channels/telegram-media.ts";
import {
  assessDraftForChat,
  fieldLabel,
  transactionSummary,
  type ChatConfirmation,
  type ChatDraft,
} from "../../../src/features/drafts/chat-confirmation.ts";
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
  /** The text a person typed under a photo. */
  caption?: string;
  photo?: unknown;
  document?: unknown;
  voice?: unknown;
  video?: unknown;
};

export type TelegramCallbackQuery = {
  id: string;
  from: { id: number; is_bot?: boolean };
  /** The bot message the tapped button was attached to. */
  message?: { message_id: number; chat: { id: number; type: string } };
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type InlineButton = { text: string; data: string };
export type SendOptions = { buttons?: InlineButton[][] };

/** A downloaded receipt image, already checked to really be an image. */
export type ReceiptImage = {
  bytes: Uint8Array;
  mimeType: ReceiptMimeType;
  filename: string;
  /** Lowercase hex SHA-256 of the bytes. */
  sha256: string;
  providerMediaId: string | null;
};

export type ReceiptDownload =
  | { ok: true; image: ReceiptImage }
  | { ok: false; reason: "too_large" | "not_image" | "unavailable" };

export interface ReceiptPort {
  download(media: ReceiptMedia): Promise<ReceiptDownload>;
}

export type ActiveConnection = {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  defaultCurrency: string;
  /** The workspace's default account; saved transactions land here. */
  defaultAccountId: string | null;
  aiAssistEnabled: boolean;
};

export type ClaimOutcome = "new" | "duplicate" | "rate_limited";
export type LinkOutcome = "linked" | "invalid" | "conflict" | "rate_limited";
export type EventStatus = "processed" | "ignored" | "failed";
export type ConfirmOutcome =
  | "confirmed"
  | "already_confirmed"
  | "not_found"
  | "expired"
  | "not_linked";
export type DiscardOutcome =
  | "discarded"
  | "already_confirmed"
  | "not_found"
  | "not_linked";

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
  /** With a receipt, also keeps the photo privately and links it to the draft. */
  insertDraft(
    draft: TransactionDraftInsert,
    receipt?: ReceiptImage,
  ): Promise<{
    duplicate: boolean;
    draftId: string | null;
    receiptStored?: boolean;
  }>;
  countReviewableDrafts(connection: ActiveConnection): Promise<number>;
  /** A draft owned by this connection, or null. Never another person's. */
  getDraft(
    connection: ActiveConnection,
    draftId: string,
  ): Promise<ChatDraft | null>;
  /** Newest unconfirmed, unexpired drafts first. */
  listOpenDrafts(
    connection: ActiveConnection,
    limit: number,
  ): Promise<ChatDraft[]>;
  /** Creates the transaction and confirms the draft in one database step. */
  confirmDraft(
    providerUserId: string,
    draftId: string,
    transaction: TransactionInsert,
  ): Promise<{ outcome: ConfirmOutcome; transactionId: string | null }>;
  discardDraft(
    providerUserId: string,
    draftId: string,
  ): Promise<DiscardOutcome>;
}

export type HandlerDeps = {
  store: ChannelStore;
  sendMessage: (
    chatId: string,
    text: string,
    options?: SendOptions,
  ) => Promise<void>;
  /** Stops the button's loading spinner; the optional text shows as a toast. */
  answerCallback: (callbackQueryId: string, text?: string) => Promise<void>;
  /** Replaces a bot message's text and removes its buttons. */
  editMessage: (
    chatId: string,
    messageId: number,
    text: string,
  ) => Promise<void>;
  now?: () => Date;
  /** Optional: when absent or disabled the bot is purely deterministic. */
  assistant?: AssistantPort;
  /** Downloads photos sent to the bot. Without it, photos are declined. */
  receipts?: ReceiptPort;
};

export type HandlerResult = {
  status: "processed" | "ignored" | "duplicate" | "rate_limited" | "failed";
};

export const MESSAGES = {
  aiDisabledForChat:
    "AI assistance is off for this chat. Send /ai on to turn it on.",
  aiOff:
    "AI assistance is off. Your messages will not be sent to the AI provider.",
  aiOn: "AI assistance is on. Short messages and receipt photos may be sent to an AI provider to help read them or answer questions.",
  aiUnavailable:
    "The assistant isn’t set up yet, so I can only read messages with simple rules for now.",
  aiUsage: "Send /ai on or /ai off.",
  askUsage: "Ask me something after /ask, for example: /ask how do I attach a receipt?",
  assistantBusy:
    "The assistant isn’t available right now. Send /help to see what I can do.",
  alreadyLinked:
    "This chat is already linked to your Finance Tracker account. Send /help to see what I can do.",
  alreadySaved: "This draft is already saved to your ledger.",
  discarded: "Discarded. Nothing was saved to your ledger.",
  draftExpired:
    "That draft expired. Send the message again to make a new one.",
  draftGone: "That draft is no longer available.",
  draftsNone:
    "No drafts are waiting. Send a message like “spent 2500 on lunch” to make one.",
  disconnected:
    "Disconnected. Your data stays in the app. To link again, open Profile → Connections → Telegram.",
  failure:
    "Something went wrong on our side. Please try again in a moment.",
  help: [
    "Send a message like “spent 2500 on lunch” and I’ll make a draft. Tap Save to add it to your ledger, or review it in the app.",
    "",
    "Or send a photo of a receipt and I’ll read it (with AI assistance on) and attach it.",
    "",
    "/drafts – review and save waiting drafts",
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
    "Linked! Send a message like “spent 2500 on lunch” and I’ll make a draft. Tap Save to add it to your ledger, or review it in the app.",
  linkUsage:
    "Send /link followed by the code from the app, for example: /link K7M2-9QXA",
  mediaUnsupported:
    "I can read receipt photos. Voice notes, videos and other media aren’t supported yet.",
  receiptDocument:
    "I can read photos and image files (JPEG, PNG or WebP). PDFs and other files aren’t supported yet.",
  receiptDownloadFailed:
    "I couldn’t download that image. Please try sending it again.",
  receiptNeedsAi:
    "I can read a receipt photo when AI assistance is on. Send /ai on, or add a caption like “spent 2500 on groceries” and I’ll attach the photo to that draft.",
  receiptNeedsAiUnavailable:
    "The assistant isn’t set up yet, so I can’t read receipt photos. Add a caption like “spent 2500 on groceries” and I’ll attach the photo to that draft.",
  receiptTooLarge: "That image is too large. Please send a photo under 8 MB.",
  receiptUnavailable:
    "Receipt photos aren’t available right now. Please try again later.",
  receiptUnreadable:
    "I couldn’t read that receipt. Try a clearer, well-lit photo, or add a caption like “spent 2500 on groceries”.",
  notLinked:
    "This chat isn’t linked to a Finance Tracker account yet. Open the app → Profile → Connections → Telegram, then send /link followed by your code.",
  notATransaction:
    "I couldn’t find an amount or whether it was income or an expense. Try something like “spent 2500 on lunch”, or send /help.",
  notLinkedToast: "This chat isn’t linked to an account.",
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

/** The pieces a draft has so far, for drafts that cannot be saved from chat yet. */
function partialSummary(draft: Pick<ChatDraft, "extracted_fields">) {
  const get = (key: string) => {
    const field = draft.extracted_fields[key] as { value?: unknown } | undefined;
    return field?.value ?? null;
  };
  const amount = get("amount");
  const currency = get("currency_code");
  const type = get("type");
  const category = get("category_key");
  const date = get("transaction_date");

  return [
    amount !== null ? `${amount}${currency ? ` ${currency}` : ""}` : null,
    type === "Revenue" ? "income" : type === "Expenditure" ? "expense" : null,
    category ? String(category) : null,
    date ? String(date) : null,
  ].filter((part): part is string => part !== null);
}

/**
 * What the bot says about a draft, and the buttons under it. A draft that can
 * be saved gets Save and Discard; one that is missing something gets Discard and
 * a pointer to the app. Tapping Save is the review, so the message shows every
 * value first and names any the parser or AI was unsure about.
 */
export function draftReply(
  draft: ChatDraft,
  assessment: ChatConfirmation,
  note?: string,
): { text: string; buttons: InlineButton[][] } {
  const discard = { data: `d:${draft.id}`, text: "🗑 Discard" };
  const suggested = aiSuggestedFieldNames(draft);

  if (assessment.status === "ready") {
    const check = assessment.check.map((field) =>
      suggested.includes(field)
        ? `${fieldLabel(field)} (suggested by the AI assistant)`
        : fieldLabel(field),
    );
    const lines = [`Draft ready: ${transactionSummary(assessment.transaction)}`];
    if (check.length) lines.push(`Please double-check: ${check.join(", ")}.`);
    if (note) lines.push(note);
    lines.push("Save it to your ledger?");
    return {
      buttons: [[{ data: `s:${draft.id}`, text: "✅ Save" }, discard]],
      text: lines.join("\n"),
    };
  }

  const parts = partialSummary(draft);
  const headline = parts.length
    ? `Saved to your drafts: ${parts.join(" · ")}`
    : "Saved to your drafts.";
  const aiNote = suggested.length
    ? `\nThe AI assistant suggested: ${suggested.map(fieldLabel).join(", ")}.`
    : "";
  return {
    buttons: [[discard]],
    text: `${headline}${aiNote}\n${assessment.reason}${note ? `\n${note}` : ""}`,
  };
}

const CALLBACK_PATTERN =
  /^([sd]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Button payloads are "s:<draft id>" (save) and "d:<draft id>" (discard). */
export function parseCallbackData(data: string | undefined) {
  const match = data ? CALLBACK_PATTERN.exec(data) : null;
  if (!match) return null;
  return {
    action: match[1].toLowerCase() === "s" ? ("save" as const) : ("discard" as const),
    draftId: match[2].toLowerCase(),
  };
}

const DRAFT_LIST_LIMIT = 5;

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

  const picked = pickReceiptMedia(message);
  if (picked.kind === "unsupported") {
    await deps.sendMessage(
      chatId,
      picked.reason === "document"
        ? MESSAGES.receiptDocument
        : picked.reason === "too_large"
          ? MESSAGES.receiptTooLarge
          : MESSAGES.mediaUnsupported,
    );
    return "processed";
  }
  if (picked.kind === "receipt") {
    await handleReceiptPhoto(deps, message, userId, picked.media);
    return "processed";
  }

  const text = message.text?.trim();
  if (!text) return "ignored";

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
      case "drafts": {
        const connection = await deps.store.findConnection(userId);
        if (!connection) {
          await deps.sendMessage(chatId, MESSAGES.notLinked);
          return "processed";
        }
        const open = await deps.store.listOpenDrafts(connection, DRAFT_LIST_LIMIT);
        if (open.length === 0) {
          await deps.sendMessage(chatId, MESSAGES.draftsNone);
          return "processed";
        }
        await deps.sendMessage(
          chatId,
          `Your latest ${plural(open.length, "draft")}:`,
        );
        for (const draft of open) {
          await sendDraft(deps, chatId, connection, draft);
        }
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

  const { duplicate, draftId } = await deps.store.insertDraft(draft);
  if (duplicate) {
    await deps.sendMessage(chatId, "That message was already saved.");
  } else if (!draftId) {
    await deps.sendMessage(chatId, "Saved to your drafts. Review it in the app.");
  } else {
    await sendDraft(deps, chatId, connection, { ...draft, id: draftId });
  }
  return "processed";
}

/**
 * A photo of a receipt. The AI (when the person has switched it on) reads the
 * total, date, shop and category; whatever was typed in the caption wins. The
 * photo is kept privately and attached to the transaction only if the draft is
 * saved. Nothing is saved without the person tapping Save.
 */
async function handleReceiptPhoto(
  deps: HandlerDeps,
  message: TelegramMessage,
  userId: string,
  media: ReceiptMedia,
) {
  const chatId = String(message.chat.id);
  const connection = await deps.store.findConnection(userId);
  if (!connection) {
    await deps.sendMessage(chatId, MESSAGES.notLinked);
    return;
  }

  const caption = message.caption?.trim() ?? "";
  if (caption.length > MAX_MESSAGE_LENGTH) {
    await deps.sendMessage(chatId, MESSAGES.tooLong);
    return;
  }

  const assistant = deps.assistant;
  const canRead = assistantReady(deps, connection);
  if (!canRead && !caption) {
    await deps.sendMessage(
      chatId,
      assistant?.enabled
        ? MESSAGES.receiptNeedsAi
        : MESSAGES.receiptNeedsAiUnavailable,
    );
    return;
  }
  if (!deps.receipts) {
    await deps.sendMessage(chatId, MESSAGES.receiptUnavailable);
    return;
  }

  const parsed = buildTransactionDraftInsert({
    defaultCurrency: connection.defaultCurrency,
    now: deps.now?.(),
    ownerUserId: connection.ownerUserId,
    source: "telegram",
    sourceMessageId: `${chatId}:${message.message_id}`,
    text: caption || RECEIPT_PLACEHOLDER_TEXT,
    workspaceId: connection.workspaceId,
  });

  // Without the AI the caption is all there is to go on; if it is no
  // transaction, there is no point downloading the photo.
  if (
    !canRead &&
    fieldValue(parsed, "amount") === null &&
    fieldValue(parsed, "type") === null
  ) {
    await deps.sendMessage(chatId, MESSAGES.notATransaction);
    return;
  }

  const download = await deps.receipts.download(media);
  if (!download.ok) {
    await deps.sendMessage(
      chatId,
      download.reason === "too_large"
        ? MESSAGES.receiptTooLarge
        : download.reason === "not_image"
          ? MESSAGES.receiptDocument
          : MESSAGES.receiptDownloadFailed,
    );
    return;
  }
  const image = download.image;

  let draft = parsed;
  let readByAi = false;
  if (canRead && assistant) {
    const reading = await assistant.readReceipt({
      baseCurrency: connection.defaultCurrency,
      categoryKeys: RECEIPT_CATEGORY_KEYS,
      image: { bytes: image.bytes, mimeType: image.mimeType },
      now: deps.now?.(),
      ownerUserId: connection.ownerUserId,
    });
    if (reading && hasAnyReading(reading)) {
      draft = applyReceiptReading(parsed, reading, {
        hasCaption: Boolean(caption),
      });
      readByAi = true;
    }
  }

  // Nothing read and nothing usable typed: don't save an empty draft.
  if (
    !readByAi &&
    (!caption ||
      (fieldValue(parsed, "amount") === null &&
        fieldValue(parsed, "type") === null))
  ) {
    await deps.sendMessage(
      chatId,
      caption ? MESSAGES.notATransaction : MESSAGES.receiptUnreadable,
    );
    return;
  }

  const { duplicate, draftId, receiptStored } = await deps.store.insertDraft(
    draft,
    image,
  );
  if (duplicate) {
    await deps.sendMessage(chatId, "That message was already saved.");
    return;
  }
  if (!draftId) {
    await deps.sendMessage(chatId, "Saved to your drafts. Review it in the app.");
    return;
  }

  const note = !receiptStored
    ? "I couldn’t keep the photo, so only the details were saved."
    : readByAi
      ? "Receipt photo attached, and read by the AI assistant."
      : "Receipt photo attached.";
  await sendDraft(deps, chatId, connection, { ...draft, id: draftId }, note);
}

/** Shows a draft with Save and Discard when it can be saved from chat. */
async function sendDraft(
  deps: HandlerDeps,
  chatId: string,
  connection: ActiveConnection,
  draft: ChatDraft,
  note?: string,
) {
  const assessment = assessDraftForChat(draft, {
    accountId: connection.defaultAccountId,
    baseCurrencyCode: connection.defaultCurrency,
    now: deps.now?.(),
  });
  const reply = draftReply(draft, assessment, note);
  await deps.sendMessage(chatId, reply.text, { buttons: reply.buttons });
}

/** A tap on Save or Discard under a draft message. */
async function handleCallback(
  deps: HandlerDeps,
  query: TelegramCallbackQuery,
): Promise<"processed" | "ignored"> {
  const action = parseCallbackData(query.data);
  const message = query.message;
  if (!action || !message || message.chat.type !== "private") {
    await deps.answerCallback(query.id);
    return "ignored";
  }

  const chatId = String(message.chat.id);
  const userId = String(query.from.id);
  const settle = async (text: string, toast?: string) => {
    await deps.editMessage(chatId, message.message_id, text);
    await deps.answerCallback(query.id, toast);
  };

  const connection = await deps.store.findConnection(userId);
  if (!connection) {
    await deps.answerCallback(query.id, MESSAGES.notLinkedToast);
    return "processed";
  }

  if (action.action === "discard") {
    const outcome = await deps.store.discardDraft(userId, action.draftId);
    if (outcome === "discarded") await settle(MESSAGES.discarded, "Discarded");
    else if (outcome === "already_confirmed") {
      await settle(MESSAGES.alreadySaved, "Already saved");
    } else if (outcome === "not_found") {
      await settle(MESSAGES.draftGone);
    } else await deps.answerCallback(query.id, MESSAGES.notLinkedToast);
    return "processed";
  }

  const draft = await deps.store.getDraft(connection, action.draftId);
  if (!draft) {
    await settle(MESSAGES.draftGone);
    return "processed";
  }
  if (draft.lifecycle === "confirmed") {
    await settle(MESSAGES.alreadySaved, "Already saved");
    return "processed";
  }

  const assessment = assessDraftForChat(draft, {
    accountId: connection.defaultAccountId,
    baseCurrencyCode: connection.defaultCurrency,
    now: deps.now?.(),
  });
  if (assessment.status === "blocked") {
    await settle(assessment.reason, "Can’t save this yet");
    return "processed";
  }

  const result = await deps.store.confirmDraft(
    userId,
    draft.id,
    assessment.transaction,
  );
  switch (result.outcome) {
    case "confirmed":
      await settle(
        `✅ Saved to your ledger: ${transactionSummary(assessment.transaction)}`,
        "Saved",
      );
      break;
    case "already_confirmed":
      await settle(MESSAGES.alreadySaved, "Already saved");
      break;
    case "expired":
      await settle(MESSAGES.draftExpired);
      break;
    case "not_found":
      await settle(MESSAGES.draftGone);
      break;
    default:
      await deps.answerCallback(query.id, MESSAGES.notLinkedToast);
  }
  return "processed";
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const callback = update.callback_query;
  const message = update.message;
  const sender = callback ? callback.from : message?.from;
  if ((!message && !callback) || !sender || sender.is_bot) {
    return { status: "ignored" };
  }

  const eventId = String(update.update_id);
  const userId = String(sender.id);

  const claim = await deps.store.claimEvent(eventId, userId);
  if (claim === "duplicate") return { status: "duplicate" };
  if (claim === "rate_limited") return { status: "rate_limited" };

  try {
    const outcome = callback
      ? await handleCallback(deps, callback)
      : await route(deps, message!, userId);
    await deps.store.finishEvent(eventId, outcome);
    return { status: outcome };
  } catch {
    // Never surface backend details to the chat, and never throw back to
    // Telegram: a non-2xx response only makes it redeliver the same update.
    await deps.store.finishEvent(eventId, "failed", "HANDLER_ERROR").catch(
      () => undefined,
    );
    const chat = callback ? callback.message?.chat.id : message?.chat.id;
    if (chat !== undefined) {
      await deps.sendMessage(String(chat), MESSAGES.failure).catch(
        () => undefined,
      );
    }
    // Stop the button's spinner so the person can tap it again.
    if (callback) await deps.answerCallback(callback.id).catch(() => undefined);
    return { status: "failed" };
  }
}
