import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assessDraftForChat } from "../../src/features/drafts/chat-confirmation.ts";
import { buildTransactionDraftInsert } from "../../src/features/drafts/draft-capture.ts";
import {
  draftReply,
  handleTelegramUpdate,
  MESSAGES,
  parseCallbackData,
} from "../../supabase/functions/telegram-webhook/handler.ts";

const NOW = new Date("2026-10-22T10:00:00.000Z");
const DRAFT_ID = "7c1f3a52-0d1e-4b6a-9a31-2f5e8b9c4d10";
const CONNECTION = {
  aiAssistEnabled: true,
  defaultAccountId: "account-1",
  defaultCurrency: "NGN",
  id: "conn-1",
  ownerUserId: "user-1",
  workspaceId: "workspace-1",
};

function harness({
  assistant = undefined,
  claim = "new",
  connection = null,
  link = "linked",
} = {}) {
  const sent = [];
  const drafts = [];
  const finished = [];
  const edits = [];
  const answers = [];
  const calls = {
    aiAssist: [],
    confirm: [],
    consume: [],
    discard: [],
    disconnect: [],
  };
  const state = {
    confirmOutcome: "confirmed",
    connection: connection ? { ...connection } : null,
    discardOutcome: "discarded",
    openDrafts: [],
    storedDraft: null,
    throwOn: null,
  };

  const store = {
    async claimEvent() {
      return claim;
    },
    async consumeLinkCode(code, userId, chatId) {
      calls.consume.push({ chatId, code, userId });
      return link;
    },
    async countReviewableDrafts() {
      return 3;
    },
    async disconnect(userId) {
      calls.disconnect.push(userId);
      const had = state.connection !== null;
      state.connection = null;
      return had;
    },
    async setAiAssist(userId, enabled) {
      calls.aiAssist.push({ enabled, userId });
      if (state.connection) state.connection.aiAssistEnabled = enabled;
      return state.connection !== null;
    },
    async finishEvent(eventId, status, errorCode) {
      finished.push({ errorCode, eventId, status });
    },
    async findConnection() {
      if (state.throwOn === "findConnection") throw new Error("db down");
      return state.connection;
    },
    async insertDraft(draft) {
      drafts.push(draft);
      return { draftId: DRAFT_ID, duplicate: false };
    },
    async getDraft() {
      if (state.throwOn === "getDraft") throw new Error("db down");
      return state.storedDraft;
    },
    async listOpenDrafts(_connection, limit) {
      return state.openDrafts.slice(0, limit);
    },
    async confirmDraft(userId, draftId, transaction) {
      calls.confirm.push({ draftId, transaction, userId });
      return { outcome: state.confirmOutcome, transactionId: "tx-1" };
    },
    async discardDraft(userId, draftId) {
      calls.discard.push({ draftId, userId });
      return state.discardOutcome;
    },
  };

  return {
    calls,
    deps: {
      answerCallback: async (id, text) => {
        answers.push({ id, text });
      },
      assistant,
      editMessage: async (chatId, messageId, text) => {
        edits.push({ chatId, messageId, text });
      },
      now: () => NOW,
      sendMessage: async (chatId, text, options) => {
        sent.push({
          chatId,
          text,
          ...(options?.buttons ? { buttons: options.buttons } : {}),
        });
      },
      store,
    },
    answers,
    drafts,
    edits,
    finished,
    sent,
    state,
  };
}

/** A draft as the database would hold it, built by the real parser. */
function storedDraft(text, overrides = {}) {
  return {
    ...buildTransactionDraftInsert({
      defaultCurrency: "NGN",
      now: NOW,
      ownerUserId: "user-1",
      source: "telegram",
      sourceMessageId: "555:1",
      text,
      workspaceId: "workspace-1",
    }),
    id: DRAFT_ID,
    ...overrides,
  };
}

function tap(action, { draftId = DRAFT_ID, chatType = "private", data, updateId = 2001 } = {}) {
  return {
    callback_query: {
      data: data ?? `${action}:${draftId}`,
      from: { id: 777, is_bot: false },
      id: "cb-1",
      message: { chat: { id: 555, type: chatType }, message_id: 99 },
    },
    update_id: updateId,
  };
}

function update(text, overrides = {}) {
  return {
    message: {
      chat: { id: 555, type: "private" },
      from: { id: 777, is_bot: false },
      message_id: 42,
      text,
      ...overrides.message,
    },
    update_id: overrides.update_id ?? 1001,
  };
}

test("an unlinked chat is told how to link and nothing is saved", async () => {
  const h = harness();
  const result = await handleTelegramUpdate(update("spent 2500 on lunch"), h.deps);
  assert.equal(result.status, "processed");
  assert.deepEqual(h.sent, [{ chatId: "555", text: MESSAGES.notLinked }]);
  assert.equal(h.drafts.length, 0);
});

test("/start with a code links the chat through the one-time code RPC", async () => {
  const h = harness();
  await handleTelegramUpdate(update("/start K7M29QXA"), h.deps);
  assert.deepEqual(h.calls.consume, [
    { chatId: "555", code: "K7M29QXA", userId: "777" },
  ]);
  assert.equal(h.sent[0].text, MESSAGES.linked);
});

test("/link maps every outcome to a user-friendly reply", async () => {
  const expected = {
    conflict: MESSAGES.linkConflict,
    invalid: MESSAGES.linkInvalid,
    linked: MESSAGES.linked,
    rate_limited: MESSAGES.linkRateLimited,
  };
  for (const [outcome, reply] of Object.entries(expected)) {
    const h = harness({ link: outcome });
    await handleTelegramUpdate(update("/link K7M2-9QXA"), h.deps);
    assert.equal(h.sent[0].text, reply, outcome);
  }
});

test("/link without a code explains the format and does not call the RPC", async () => {
  const h = harness();
  await handleTelegramUpdate(update("/link"), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.linkUsage);
  assert.equal(h.calls.consume.length, 0);
});

test("a pasted bare code from an unlinked chat is treated as a link attempt", async () => {
  const h = harness();
  await handleTelegramUpdate(update("K7M2-9QXA"), h.deps);
  assert.equal(h.calls.consume.length, 1);
  assert.equal(h.sent[0].text, MESSAGES.linked);
});

test("commands tolerate the @botname suffix and mixed case", async () => {
  const h = harness();
  await handleTelegramUpdate(update("/HELP@FinanceTrackerBot"), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.help);
});

test("a linked message becomes a telegram-sourced draft in the owner's workspace", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("spent 2500 on lunch"), h.deps);

  assert.equal(h.drafts.length, 1);
  const [draft] = h.drafts;
  assert.equal(draft.source, "telegram");
  assert.equal(draft.source_message_id, "555:42");
  assert.equal(draft.owner_user_id, "user-1");
  assert.equal(draft.workspace_id, "workspace-1");
  assert.equal(draft.original_text, "spent 2500 on lunch");
  assert.equal(draft.extracted_fields.amount.value, 2500);
  assert.equal(draft.extracted_fields.currency_code.value, "NGN");
  assert.match(h.sent[0].text, /^Draft ready: 2,500 NGN · expense · Eat & drink/);
  assert.match(h.sent[0].text, /Save it to your ledger\?/);
});

test("a draft with missing fields lists them instead of inventing values", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("bought lunch"), h.deps);
  const [draft] = h.drafts;
  assert.ok(draft.missing_fields.includes("amount"));
  assert.equal(draft.extracted_fields.amount.value, null);
  assert.match(h.sent[0].text, /Still needed: .*amount/);
});

test("replies never expose internal identifiers", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("spent 2500 on lunch"), h.deps);
  await handleTelegramUpdate(update("/status", { update_id: 1002 }), h.deps);
  for (const { text } of h.sent) {
    assert.doesNotMatch(text, /user-1|workspace-1|conn-1/);
  }
});

test("/status reports the base currency and waiting drafts", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("/status"), h.deps);
  assert.equal(h.sent[0].text, "Linked. Base currency NGN. 3 drafts waiting for review. AI assistance: not set up.");
});

test("/disconnect revokes the link and is honest when nothing is linked", async () => {
  const linked = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("/disconnect"), linked.deps);
  assert.deepEqual(linked.calls.disconnect, ["777"]);
  assert.equal(linked.sent[0].text, MESSAGES.disconnected);

  const unlinked = harness();
  await handleTelegramUpdate(update("/disconnect"), unlinked.deps);
  assert.equal(unlinked.sent[0].text, MESSAGES.notLinkedDisconnect);
});

test("retried updates and rate-limited chats are dropped silently", async () => {
  for (const [claim, status] of [
    ["duplicate", "duplicate"],
    ["rate_limited", "rate_limited"],
  ]) {
    const h = harness({ claim, connection: CONNECTION });
    const result = await handleTelegramUpdate(update("spent 10 on tea"), h.deps);
    assert.equal(result.status, status);
    assert.equal(h.sent.length, 0);
    assert.equal(h.drafts.length, 0);
  }
});

test("group chats, bots, and non-message updates are ignored", async () => {
  const group = harness({ connection: CONNECTION });
  const groupResult = await handleTelegramUpdate(
    update("spent 10 on tea", { message: { chat: { id: -9, type: "group" } } }),
    group.deps,
  );
  assert.equal(groupResult.status, "ignored");
  assert.equal(group.drafts.length, 0);
  assert.equal(group.sent[0].text, MESSAGES.privateOnly);

  const bot = harness();
  const botResult = await handleTelegramUpdate(
    update("hi", { message: { from: { id: 1, is_bot: true } } }),
    bot.deps,
  );
  assert.equal(botResult.status, "ignored");
  assert.equal(bot.sent.length, 0);

  const other = harness();
  const otherResult = await handleTelegramUpdate({ update_id: 5 }, other.deps);
  assert.equal(otherResult.status, "ignored");
});

test("receipt media gets an honest coming-soon reply", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(
    update(undefined, { message: { photo: [{ file_id: "x" }], text: undefined } }),
    h.deps,
  );
  assert.equal(h.sent[0].text, MESSAGES.mediaSoon);
  assert.equal(h.drafts.length, 0);
});

test("oversized messages are rejected before parsing", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("a".repeat(4001)), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.tooLong);
  assert.equal(h.drafts.length, 0);
});

test("a backend failure is contained: generic reply, event marked failed, no throw", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.throwOn = "findConnection";
  const result = await handleTelegramUpdate(update("spent 10 on tea"), h.deps);
  assert.equal(result.status, "failed");
  assert.equal(h.sent[0].text, MESSAGES.failure);
  assert.doesNotMatch(h.sent[0].text, /db down/);
  assert.deepEqual(h.finished.at(-1), {
    errorCode: "HANDLER_ERROR",
    eventId: "1001",
    status: "failed",
  });
});

test("the entrypoint authenticates with the webhook secret, not a JWT", async () => {
  const entry = await readFile(
    new URL("../../supabase/functions/telegram-webhook/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(entry, /x-telegram-bot-api-secret-token/);
  assert.match(entry, /TELEGRAM_WEBHOOK_SECRET/);
  assert.match(entry, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(entry, /SUPABASE_SERVICE_ROLE_KEY/);
  // Secret check must come before the request body is parsed.
  assert.ok(entry.indexOf("secretsMatch(providedSecret") < entry.indexOf("request.json()"));
  // The bot token is part of the Bot API URL and must never be logged.
  assert.doesNotMatch(entry, /console\.\w+\([^)]*botToken/);
  assert.doesNotMatch(entry, /EXPO_PUBLIC/);
});

// --- Save / Discard buttons ---------------------------------------------------

test("a complete message gets Save and Discard buttons carrying the draft id", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("spent 2500 on lunch"), h.deps);
  assert.deepEqual(h.sent[0].buttons, [
    [
      { data: `s:${DRAFT_ID}`, text: "✅ Save" },
      { data: `d:${DRAFT_ID}`, text: "🗑 Discard" },
    ],
  ]);
  // Callback data is limited to 64 bytes by Telegram.
  for (const button of h.sent[0].buttons.flat()) {
    assert.ok(Buffer.byteLength(button.data) <= 64, button.data);
  }
});

test("a draft that cannot be saved yet offers only Discard and says why", async () => {
  const missing = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("bought lunch"), missing.deps);
  assert.deepEqual(missing.sent[0].buttons, [[{ data: `d:${DRAFT_ID}`, text: "🗑 Discard" }]]);
  assert.match(missing.sent[0].text, /Still needed: amount/);

  const foreign = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("spent $20 on lunch"), foreign.deps);
  assert.equal(foreign.sent[0].buttons.length, 1);
  assert.equal(foreign.sent[0].buttons[0].length, 1);
  assert.match(foreign.sent[0].text, /exchange rate/);
});

test("a redelivered message says it was already saved and shows no buttons", async () => {
  const h = harness({ connection: CONNECTION });
  h.deps.store.insertDraft = async () => ({ draftId: null, duplicate: true });
  await handleTelegramUpdate(update("spent 2500 on lunch"), h.deps);
  assert.equal(h.sent[0].text, "That message was already saved.");
  assert.equal(h.sent[0].buttons, undefined);
});

test("tapping Save creates the transaction once, with the draft's own values", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.storedDraft = storedDraft("spent 2500 on lunch");
  const result = await handleTelegramUpdate(tap("s"), h.deps);

  assert.equal(result.status, "processed");
  assert.equal(h.calls.confirm.length, 1);
  const [call] = h.calls.confirm;
  assert.equal(call.userId, "777");
  assert.equal(call.draftId, DRAFT_ID);
  assert.deepEqual(
    {
      account: call.transaction.account_id,
      amount: call.transaction.amount,
      base: call.transaction.base_currency_code,
      category: call.transaction.category_id,
      currency: call.transaction.currency_code,
      rate: call.transaction.exchange_rate,
      type: call.transaction.type,
    },
    {
      account: "account-1",
      amount: 2500,
      base: "NGN",
      category: "eat",
      currency: "NGN",
      rate: 1,
      type: "Expenditure",
    },
  );
  assert.deepEqual(h.edits, [
    {
      chatId: "555",
      messageId: 99,
      text: "✅ Saved to your ledger: 2,500 NGN · expense · Eat & drink · 2026-10-22",
    },
  ]);
  assert.deepEqual(h.answers, [{ id: "cb-1", text: "Saved" }]);
});

test("tapping Save on an already-saved draft does not save it again", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.storedDraft = storedDraft("spent 2500 on lunch");
  h.state.confirmOutcome = "already_confirmed";
  await handleTelegramUpdate(tap("s"), h.deps);
  assert.equal(h.edits[0].text, MESSAGES.alreadySaved);

  const confirmedAlready = harness({ connection: CONNECTION });
  confirmedAlready.state.storedDraft = storedDraft("spent 2500 on lunch", {
    confirmed_transaction_id: "tx-9",
    lifecycle: "confirmed",
  });
  await handleTelegramUpdate(tap("s"), confirmedAlready.deps);
  assert.equal(confirmedAlready.calls.confirm.length, 0);
  assert.equal(confirmedAlready.edits[0].text, MESSAGES.alreadySaved);
});

test("Save is refused, with the reason, when the draft is not saveable", async () => {
  const foreign = harness({ connection: CONNECTION });
  foreign.state.storedDraft = storedDraft("spent $20 on lunch");
  await handleTelegramUpdate(tap("s"), foreign.deps);
  assert.equal(foreign.calls.confirm.length, 0);
  assert.match(foreign.edits[0].text, /exchange rate/);

  const missing = harness({ connection: CONNECTION });
  missing.state.storedDraft = storedDraft("bought lunch");
  await handleTelegramUpdate(tap("s"), missing.deps);
  assert.equal(missing.calls.confirm.length, 0);
  assert.match(missing.edits[0].text, /Still needed: amount/);

  const expired = harness({ connection: CONNECTION });
  expired.state.storedDraft = storedDraft("spent 2500 on lunch", {
    expires_at: "2026-10-01T00:00:00.000Z",
  });
  await handleTelegramUpdate(tap("s"), expired.deps);
  assert.equal(expired.calls.confirm.length, 0);
  assert.match(expired.edits[0].text, /expired/);
});

test("a draft that is not this account's is reported as gone, never saved", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.storedDraft = null; // the store only returns drafts owned by the connection
  await handleTelegramUpdate(tap("s"), h.deps);
  assert.equal(h.calls.confirm.length, 0);
  assert.equal(h.edits[0].text, MESSAGES.draftGone);
});

test("the database's verdict is shown honestly for every confirm outcome", async () => {
  const expected = {
    already_confirmed: MESSAGES.alreadySaved,
    expired: MESSAGES.draftExpired,
    not_found: MESSAGES.draftGone,
  };
  for (const [outcome, text] of Object.entries(expected)) {
    const h = harness({ connection: CONNECTION });
    h.state.storedDraft = storedDraft("spent 2500 on lunch");
    h.state.confirmOutcome = outcome;
    await handleTelegramUpdate(tap("s"), h.deps);
    assert.equal(h.edits[0].text, text, outcome);
  }
  const unlinked = harness({ connection: CONNECTION });
  unlinked.state.storedDraft = storedDraft("spent 2500 on lunch");
  unlinked.state.confirmOutcome = "not_linked";
  await handleTelegramUpdate(tap("s"), unlinked.deps);
  assert.equal(unlinked.edits.length, 0);
  assert.equal(unlinked.answers[0].text, MESSAGES.notLinkedToast);
});

test("Discard removes the draft and says nothing was saved", async () => {
  const h = harness({ connection: CONNECTION });
  await handleTelegramUpdate(tap("d"), h.deps);
  assert.deepEqual(h.calls.discard, [{ draftId: DRAFT_ID, userId: "777" }]);
  assert.equal(h.calls.confirm.length, 0);
  assert.deepEqual(h.edits, [{ chatId: "555", messageId: 99, text: MESSAGES.discarded }]);
  assert.deepEqual(h.answers, [{ id: "cb-1", text: "Discarded" }]);

  for (const [outcome, text] of [
    ["already_confirmed", MESSAGES.alreadySaved],
    ["not_found", MESSAGES.draftGone],
  ]) {
    const other = harness({ connection: CONNECTION });
    other.state.discardOutcome = outcome;
    await handleTelegramUpdate(tap("d"), other.deps);
    assert.equal(other.edits[0].text, text, outcome);
  }
});

test("buttons from an unlinked, group, or malformed source do nothing", async () => {
  const unlinked = harness();
  await handleTelegramUpdate(tap("s"), unlinked.deps);
  assert.equal(unlinked.calls.confirm.length, 0);
  assert.equal(unlinked.edits.length, 0);
  assert.equal(unlinked.answers[0].text, MESSAGES.notLinkedToast);

  const group = harness({ connection: CONNECTION });
  const groupResult = await handleTelegramUpdate(tap("s", { chatType: "group" }), group.deps);
  assert.equal(groupResult.status, "ignored");
  assert.equal(group.calls.confirm.length, 0);

  for (const data of ["s:not-a-uuid", `x:${DRAFT_ID}`, `s:${DRAFT_ID}:extra`, "", undefined]) {
    const h = harness({ connection: CONNECTION });
    const result = await handleTelegramUpdate(tap("s", { data: data ?? "" }), h.deps);
    assert.equal(result.status, "ignored", String(data));
    assert.equal(h.calls.confirm.length + h.calls.discard.length, 0);
    assert.equal(h.answers.length, 1);
  }
  assert.equal(parseCallbackData(undefined), null);
  assert.deepEqual(parseCallbackData(`S:${DRAFT_ID.toUpperCase()}`), {
    action: "save",
    draftId: DRAFT_ID,
  });
});

test("a redelivered button tap is dropped like any other duplicate update", async () => {
  const h = harness({ claim: "duplicate", connection: CONNECTION });
  h.state.storedDraft = storedDraft("spent 2500 on lunch");
  const result = await handleTelegramUpdate(tap("s"), h.deps);
  assert.equal(result.status, "duplicate");
  assert.equal(h.calls.confirm.length, 0);
});

test("a failure while saving is contained and the button spinner is cleared", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.throwOn = "getDraft";
  const result = await handleTelegramUpdate(tap("s"), h.deps);
  assert.equal(result.status, "failed");
  assert.equal(h.sent[0].text, MESSAGES.failure);
  assert.equal(h.answers.length, 1);
  assert.equal(h.edits.length, 0);
});

// --- /drafts ---------------------------------------------------------------------

test("/drafts shows each waiting draft with its own buttons", async () => {
  const h = harness({ connection: CONNECTION });
  const second = "11111111-2222-4333-8444-555555555555";
  h.state.openDrafts = [
    storedDraft("spent 2500 on lunch"),
    storedDraft("bought lunch", { id: second }),
  ];
  await handleTelegramUpdate(update("/drafts"), h.deps);

  assert.equal(h.sent[0].text, "Your latest 2 drafts:");
  assert.match(h.sent[1].text, /^Draft ready: 2,500 NGN/);
  assert.equal(h.sent[1].buttons[0][0].data, `s:${DRAFT_ID}`);
  assert.match(h.sent[2].text, /Still needed: amount/);
  assert.deepEqual(h.sent[2].buttons, [[{ data: `d:${second}`, text: "🗑 Discard" }]]);
});

test("/drafts is honest when nothing is waiting or the chat is not linked", async () => {
  const none = harness({ connection: CONNECTION });
  await handleTelegramUpdate(update("/drafts"), none.deps);
  assert.equal(none.sent[0].text, MESSAGES.draftsNone);

  const unlinked = harness();
  await handleTelegramUpdate(update("/drafts"), unlinked.deps);
  assert.equal(unlinked.sent[0].text, MESSAGES.notLinked);
});

test("/drafts never lists more than five drafts", async () => {
  const h = harness({ connection: CONNECTION });
  h.state.openDrafts = Array.from({ length: 9 }, (_, index) =>
    storedDraft("spent 2500 on lunch", {
      id: `00000000-0000-4000-8000-00000000000${index}`,
    }),
  );
  await handleTelegramUpdate(update("/drafts"), h.deps);
  assert.equal(h.sent.length, 1 + 5);
});

test("help mentions the new command and the Save button", () => {
  assert.match(MESSAGES.help, /\/drafts/);
  assert.match(MESSAGES.help, /Tap Save/);
});

test("replies for drafts carry no internal identifiers beyond the opaque draft id", () => {
  const draft = storedDraft("spent 2500 on lunch");
  const assessment = assessDraftForChat(draft, {
    accountId: "account-1",
    baseCurrencyCode: "NGN",
    now: NOW,
  });
  const reply = draftReply(draft, assessment);
  assert.doesNotMatch(reply.text, /user-1|workspace-1|account-1|conn-1/);
});

test("the entrypoint wires the confirm RPCs and keeps button taps enabled", async () => {
  const entry = await readFile(
    new URL("../../supabase/functions/telegram-webhook/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(entry, /telegram_confirm_draft/);
  assert.match(entry, /telegram_discard_draft/);
  assert.match(entry, /answerCallbackQuery/);
  assert.match(entry, /editMessageText/);
  // Drafts are always read scoped to the connection's own owner and workspace.
  assert.match(entry, /\.eq\("owner_user_id", connection\.ownerUserId\)/);
  assert.match(entry, /ensureButtonTapsAllowed/);
  // The bot token is in every Bot API URL and must never be logged.
  assert.doesNotMatch(entry, /console\.\w+\([^)]*(botToken|webhookSecret)/);
});
