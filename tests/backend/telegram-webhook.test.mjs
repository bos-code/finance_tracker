import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  draftSummary,
  handleTelegramUpdate,
  MESSAGES,
} from "../../supabase/functions/telegram-webhook/handler.ts";

const NOW = new Date("2026-10-22T10:00:00.000Z");
const CONNECTION = {
  aiAssistEnabled: true,
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
  const calls = { aiAssist: [], consume: [], disconnect: [] };
  const state = {
    connection: connection ? { ...connection } : null,
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
      return { duplicate: false };
    },
  };

  return {
    calls,
    deps: {
      assistant,
      now: () => NOW,
      sendMessage: async (chatId, text) => {
        sent.push({ chatId, text });
      },
      store,
    },
    drafts,
    finished,
    sent,
    state,
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
  assert.match(h.sent[0].text, /^Saved to your drafts: 2500 NGN/);
  assert.match(h.sent[0].text, /Drafts/);
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

test("draftSummary stays readable for a complete draft", () => {
  const text = draftSummary({
    extracted_fields: {
      amount: { value: 2500 },
      category_key: { value: "food" },
      currency_code: { value: "NGN" },
      transaction_date: { value: "2026-10-22" },
      type: { value: "Expenditure" },
    },
    missing_fields: [],
  });
  assert.equal(
    text,
    "Saved to your drafts: 2500 NGN · expense · food · 2026-10-22\nOpen Finance Tracker → Drafts to review and confirm.",
  );
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
