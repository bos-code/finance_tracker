import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAssistant } from "../../supabase/functions/telegram-webhook/assistant.ts";
import {
  MESSAGES,
  handleTelegramUpdate,
} from "../../supabase/functions/telegram-webhook/handler.ts";
import {
  AI_FIELD_CONFIDENCE,
  AI_FIELD_REASON,
  aiFillableFieldsFor,
  applyAiSuggestion,
  validateAiSuggestion,
} from "../../src/features/assistant/ai-suggestions.ts";
import {
  buildHelpRequest,
  buildParseRequest,
  callGemini,
  cleanAnswer,
  parseJsonReply,
} from "../../src/features/assistant/gemini.ts";
import { buildTransactionDraftInsert } from "../../src/features/drafts/draft-capture.ts";
import { DEFAULT_CATEGORY_RULES } from "../../src/features/drafts/transaction-parser.ts";

const CATEGORY_KEYS = DEFAULT_CATEGORY_RULES.map((rule) => rule.key);
const NOW = new Date("2026-11-02T10:00:00.000Z");

function draftFor(text) {
  return buildTransactionDraftInsert({
    defaultCurrency: "NGN",
    now: NOW,
    ownerUserId: "user-1",
    source: "telegram",
    sourceMessageId: "1:1",
    text,
    workspaceId: "ws-1",
  });
}

// --- validation: a bad AI answer must never become data ---------------------

test("an amount that is not in the message is rejected as invented", () => {
  const text = "spent on lunch";
  assert.deepEqual(
    validateAiSuggestion({ amount: 5000 }, { categoryKeys: CATEGORY_KEYS, text }),
    {},
  );
});

test("an amount that appears in the message is accepted, including 50k style", () => {
  const ok = validateAiSuggestion(
    { amount: 50000 },
    { categoryKeys: CATEGORY_KEYS, text: "got paid 50k" },
  );
  assert.equal(ok.amount, 50000);
  const withComma = validateAiSuggestion(
    { amount: 2500 },
    { categoryKeys: CATEGORY_KEYS, text: "lunch cost 2,500" },
  );
  assert.equal(withComma.amount, 2500);
});

test("number words allow an amount without digits, but only then", () => {
  const spelled = validateAiSuggestion(
    { amount: 2000 },
    { categoryKeys: CATEGORY_KEYS, text: "spent two thousand on lunch" },
  );
  assert.equal(spelled.amount, 2000);
  const none = validateAiSuggestion(
    { amount: 2000 },
    { categoryKeys: CATEGORY_KEYS, text: "spent some on lunch" },
  );
  assert.equal(none.amount, undefined);
});

test("bad shapes, enums, and unknown categories are dropped field by field", () => {
  const context = { categoryKeys: CATEGORY_KEYS, text: "spent 100 on lunch" };
  assert.deepEqual(validateAiSuggestion(null, context), {});
  assert.deepEqual(validateAiSuggestion([1, 2], context), {});
  assert.deepEqual(validateAiSuggestion("amount", context), {});
  assert.deepEqual(
    validateAiSuggestion(
      { amount: -5, category_key: "crypto", type: "Transfer" },
      context,
    ),
    {},
  );
  assert.deepEqual(
    validateAiSuggestion(
      { amount: 100, category_key: "food", type: "Expenditure" },
      context,
    ),
    { amount: 100, category_key: "food", type: "Expenditure" },
  );
  assert.deepEqual(
    validateAiSuggestion({ amount: Number.NaN, type: 3 }, context),
    {},
  );
});

// --- merging: suggestions never promote a draft past review ------------------

test("an AI-filled field stays flagged for review and the draft stays needs_review", () => {
  const draft = draftFor("spent 2500 at the market");
  assert.deepEqual(aiFillableFieldsFor(draft), ["category_key"]);

  const merged = applyAiSuggestion(draft, { category_key: "food" });
  assert.equal(merged.extracted_fields.category_key.value, "food");
  assert.equal(merged.extracted_fields.category_key.confidence, AI_FIELD_CONFIDENCE);
  assert.equal(merged.extracted_fields.category_key.reason, AI_FIELD_REASON);
  assert.ok(merged.missing_fields.includes("category_key"));
  assert.equal(merged.lifecycle, "needs_review");
  assert.equal(merged.parser_version, "deterministic-v1+ai");
});

test("the AI never overrides a value the rules already read", () => {
  const draft = draftFor("spent 2500 on lunch");
  assert.equal(draft.extracted_fields.amount.value, 2500);
  const merged = applyAiSuggestion(draft, { amount: 9999, category_key: "health" });
  assert.equal(merged, draft, "nothing was missing, so nothing is applied");
  assert.equal(merged.extracted_fields.amount.value, 2500);
});

test("a suggestion that fills nothing leaves the draft untouched", () => {
  const draft = draftFor("bought lunch");
  const merged = applyAiSuggestion(draft, {});
  assert.equal(merged, draft);
  assert.equal(merged.parser_version, "deterministic-v1");
});

// --- Gemini client ------------------------------------------------------------

function fakeFetch(reply, { status = 200, onCall } = {}) {
  return async (url, init) => {
    onCall?.({ init, url: String(url) });
    return {
      json: async () => reply,
      ok: status >= 200 && status < 300,
      status,
    };
  };
}

const GOOD_REPLY = {
  candidates: [
    { content: { parts: [{ text: '{"category_key":"food"}' }] }, finishReason: "STOP" },
  ],
  usageMetadata: { candidatesTokenCount: 7, promptTokenCount: 120 },
};

test("the key goes in a header, never the URL, and the request is deterministic JSON", async () => {
  let seen;
  const result = await callGemini({
    apiKey: "test-key-123",
    body: buildParseRequest({
      categoryKeys: CATEGORY_KEYS,
      fieldsNeeded: ["category_key"],
      text: "spent 2500 at the market",
    }),
    fetchImpl: fakeFetch(GOOD_REPLY, { onCall: (call) => (seen = call) }),
    model: "some-flash-lite",
  });

  assert.equal(result.inputTokens, 120);
  assert.equal(result.outputTokens, 7);
  assert.doesNotMatch(seen.url, /test-key-123/);
  assert.match(seen.url, /models\/some-flash-lite:generateContent$/);
  assert.equal(seen.init.headers["x-goog-api-key"], "test-key-123");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.generationConfig.temperature, 0);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
});

test("only the message and category names are sent, never account data", () => {
  const request = buildParseRequest({
    categoryKeys: CATEGORY_KEYS,
    fieldsNeeded: ["amount"],
    text: "spent on lunch",
  });
  const sent = JSON.parse(request.contents[0].parts[0].text);
  assert.deepEqual(Object.keys(sent).sort(), [
    "allowed_categories",
    "fields_needed",
    "message",
  ]);
  assert.equal(sent.message, "spent on lunch");
  assert.equal(request.contents.length, 1);

  const help = buildHelpRequest("how do I link?");
  assert.deepEqual(help.contents, [
    { parts: [{ text: "how do I link?" }], role: "user" },
  ]);
});

test("HTTP errors, empty replies, and truncated replies all throw", async () => {
  const call = (fetchImpl) =>
    callGemini({ apiKey: "k", body: buildHelpRequest("hi"), fetchImpl, model: "m" });
  await assert.rejects(call(fakeFetch({}, { status: 429 })), /gemini_http_429/);
  await assert.rejects(call(fakeFetch({ candidates: [] })), /gemini_empty/);
  await assert.rejects(
    call(
      fakeFetch({
        candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }],
      }),
    ),
    /gemini_truncated/,
  );
});

test("fenced JSON is unwrapped and answers are cleaned and capped", () => {
  assert.deepEqual(parseJsonReply('```json\n{"amount": 5}\n```'), { amount: 5 });
  assert.throws(() => parseJsonReply("not json"));
  assert.equal(cleanAnswer("**Hello**   there\n\nfriend"), "Hello there friend");
  assert.equal(cleanAnswer("   "), null);
  assert.ok(cleanAnswer("x".repeat(2000)).length <= 600);
});

// --- assistant: quota, fallbacks, accounting ---------------------------------

function quotaStore({ claimOutcome = "ok" } = {}) {
  const finished = [];
  const claims = [];
  return {
    claims,
    finished,
    store: {
      async claim(ownerUserId, feature, model) {
        claims.push({ feature, model, ownerUserId });
        return claimOutcome === "ok"
          ? { outcome: "ok", usageId: "usage-1" }
          : { outcome: claimOutcome, usageId: null };
      },
      async finish(usageId, outcome, inputTokens, outputTokens) {
        finished.push({ inputTokens, outcome, outputTokens, usageId });
      },
    },
  };
}

test("without a key or an explicit model name the assistant is off and never calls out", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error("must not be called");
  };
  const q = quotaStore();
  for (const config of [{}, { apiKey: "k" }, { model: "m" }]) {
    const assistant = createAssistant({ ...config, fetchImpl }, q.store);
    assert.equal(assistant.enabled, false);
    assert.equal(await assistant.answer({ ownerUserId: "u", question: "hi" }), null);
  }
  assert.equal(called, false);
  assert.equal(q.claims.length, 0);
});

test("a successful suggestion is validated and its tokens are recorded", async () => {
  const q = quotaStore();
  const assistant = createAssistant(
    { apiKey: "k", fetchImpl: fakeFetch(GOOD_REPLY), model: "m" },
    q.store,
  );
  const suggestion = await assistant.suggestFields({
    categoryKeys: CATEGORY_KEYS,
    fieldsNeeded: ["category_key"],
    ownerUserId: "user-1",
    text: "spent 2500 at the market",
  });
  assert.deepEqual(suggestion, { category_key: "food" });
  assert.deepEqual(q.claims, [
    { feature: "transaction_parser", model: "m", ownerUserId: "user-1" },
  ]);
  assert.deepEqual(q.finished, [
    { inputTokens: 120, outcome: "success", outputTokens: 7, usageId: "usage-1" },
  ]);
});

test("every quota refusal short-circuits before any network call", async () => {
  for (const outcome of ["user_limited", "global_limited", "circuit_open"]) {
    let called = false;
    const q = quotaStore({ claimOutcome: outcome });
    const assistant = createAssistant(
      {
        apiKey: "k",
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
        model: "m",
      },
      q.store,
    );
    assert.equal(await assistant.answer({ ownerUserId: "u", question: "hi" }), null);
    assert.equal(called, false, outcome);
    assert.equal(q.finished.length, 0, outcome);
  }
});

test("provider failures and malformed output resolve to null and are logged as failures", async () => {
  const cases = [
    fakeFetch({}, { status: 500 }),
    async () => {
      throw new Error("network down");
    },
    fakeFetch({ candidates: [{ content: { parts: [{ text: "totally not json" }] } }] }),
  ];
  for (const fetchImpl of cases) {
    const q = quotaStore();
    const assistant = createAssistant({ apiKey: "k", fetchImpl, model: "m" }, q.store);
    const result = await assistant.suggestFields({
      categoryKeys: CATEGORY_KEYS,
      fieldsNeeded: ["amount"],
      ownerUserId: "u",
      text: "spent two thousand",
    });
    assert.equal(result, null);
    assert.equal(q.finished.at(-1).outcome, "failure");
  }
});

test("a broken quota store never throws into the bot", async () => {
  const assistant = createAssistant(
    { apiKey: "k", fetchImpl: fakeFetch(GOOD_REPLY), model: "m" },
    {
      async claim() {
        throw new Error("db down");
      },
      async finish() {},
    },
  );
  assert.equal(await assistant.answer({ ownerUserId: "u", question: "hi" }), null);
});

// --- handler integration -----------------------------------------------------

const CONNECTION = {
  aiAssistEnabled: true,
  defaultCurrency: "NGN",
  id: "conn-1",
  ownerUserId: "user-1",
  workspaceId: "workspace-1",
};

function botHarness({ assistant, connection = CONNECTION } = {}) {
  const sent = [];
  const drafts = [];
  const aiSwitch = [];
  const state = { connection: connection ? { ...connection } : null };
  return {
    aiSwitch,
    deps: {
      assistant,
      now: () => NOW,
      sendMessage: async (chatId, text) => sent.push({ chatId, text }),
      store: {
        claimEvent: async () => "new",
        consumeLinkCode: async () => "invalid",
        countReviewableDrafts: async () => 0,
        disconnect: async () => false,
        finishEvent: async () => {},
        findConnection: async () => state.connection,
        insertDraft: async (draft) => {
          drafts.push(draft);
          return { duplicate: false };
        },
        setAiAssist: async (userId, enabled) => {
          aiSwitch.push({ enabled, userId });
          state.connection.aiAssistEnabled = enabled;
          return true;
        },
      },
    },
    drafts,
    sent,
  };
}

function fakeAssistant({ enabled = true, suggestion = null, answer = null } = {}) {
  const calls = { answer: [], suggest: [] };
  return {
    answer: async (input) => {
      calls.answer.push(input);
      return answer;
    },
    calls,
    enabled,
    suggestFields: async (input) => {
      calls.suggest.push(input);
      return suggestion;
    },
  };
}

function incoming(text, id = 1) {
  return {
    message: {
      chat: { id: 555, type: "private" },
      from: { id: 777 },
      message_id: id,
      text,
    },
    update_id: id,
  };
}

test("a question is answered by the assistant and saves no draft", async () => {
  const assistant = fakeAssistant({ answer: "Open the Drafts screen in the app." });
  const h = botHarness({ assistant });
  await handleTelegramUpdate(incoming("how do I review things?"), h.deps);
  assert.equal(h.sent[0].text, "Open the Drafts screen in the app.");
  assert.equal(h.drafts.length, 0);
  assert.equal(assistant.calls.answer[0].question, "how do I review things?");
});

test("without an assistant, small talk gets guidance and still saves no junk draft", async () => {
  const h = botHarness();
  await handleTelegramUpdate(incoming("hello there"), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.notATransaction);
  assert.equal(h.drafts.length, 0);
});

test("if the assistant returns nothing, the user still gets the deterministic guidance", async () => {
  const h = botHarness({ assistant: fakeAssistant({ answer: null }) });
  await handleTelegramUpdate(incoming("hello there"), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.notATransaction);
});

test("the AI fills only what the rules missed, and the reply says so", async () => {
  const assistant = fakeAssistant({ suggestion: { category_key: "food" } });
  const h = botHarness({ assistant });
  await handleTelegramUpdate(incoming("spent 2500 at the market"), h.deps);

  assert.deepEqual(assistant.calls.suggest[0].fieldsNeeded, ["category_key"]);
  assert.equal(assistant.calls.suggest[0].text, "spent 2500 at the market");
  const [draft] = h.drafts;
  assert.equal(draft.extracted_fields.category_key.value, "food");
  assert.equal(draft.lifecycle, "needs_review");
  assert.match(h.sent[0].text, /The AI assistant suggested: category_key/);
});

test("a complete message never calls the AI", async () => {
  const assistant = fakeAssistant({ suggestion: { category_key: "health" } });
  const h = botHarness({ assistant });
  await handleTelegramUpdate(incoming("spent 2500 on lunch"), h.deps);
  assert.equal(assistant.calls.suggest.length, 0);
  assert.equal(h.drafts[0].extracted_fields.category_key.value, "food");
});

test("when the AI fails the draft is saved exactly as the rules read it", async () => {
  const assistant = fakeAssistant({ suggestion: null });
  const h = botHarness({ assistant });
  await handleTelegramUpdate(incoming("spent 2500 at the market"), h.deps);
  assert.equal(h.drafts[0].parser_version, "deterministic-v1");
  assert.equal(h.drafts[0].extracted_fields.category_key.value, null);
  assert.doesNotMatch(h.sent[0].text, /AI assistant/);
});

test("/ai off stops every AI call for that chat and /ai on restores it", async () => {
  const assistant = fakeAssistant({ answer: "x", suggestion: { category_key: "food" } });
  const h = botHarness({ assistant });

  await handleTelegramUpdate(incoming("/ai off", 1), h.deps);
  assert.deepEqual(h.aiSwitch, [{ enabled: false, userId: "777" }]);
  assert.equal(h.sent.at(-1).text, MESSAGES.aiOff);

  await handleTelegramUpdate(incoming("spent 2500 at the market", 2), h.deps);
  await handleTelegramUpdate(incoming("hello there", 3), h.deps);
  await handleTelegramUpdate(incoming("/ask how do I link?", 4), h.deps);
  assert.equal(assistant.calls.suggest.length, 0);
  assert.equal(assistant.calls.answer.length, 0);
  assert.equal(h.sent.at(-1).text, MESSAGES.aiDisabledForChat);

  await handleTelegramUpdate(incoming("/ai on", 5), h.deps);
  assert.equal(h.sent.at(-1).text, MESSAGES.aiOn);
  await handleTelegramUpdate(incoming("/ask how do I link?", 6), h.deps);
  assert.equal(assistant.calls.answer.length, 1);
});

test("/ask and /ai explain themselves when used wrongly or before linking", async () => {
  const h = botHarness({ assistant: fakeAssistant() });
  await handleTelegramUpdate(incoming("/ask", 1), h.deps);
  assert.equal(h.sent.at(-1).text, MESSAGES.askUsage);
  await handleTelegramUpdate(incoming("/ai maybe", 2), h.deps);
  assert.equal(h.sent.at(-1).text, MESSAGES.aiUsage);

  const unlinked = botHarness({ assistant: fakeAssistant(), connection: null });
  await handleTelegramUpdate(incoming("/ask what is this", 1), unlinked.deps);
  assert.equal(unlinked.sent.at(-1).text, MESSAGES.notLinked);
});

test("/ask says plainly when the assistant is not set up", async () => {
  const h = botHarness({ assistant: fakeAssistant({ enabled: false }) });
  await handleTelegramUpdate(incoming("/ask how do I link?"), h.deps);
  assert.equal(h.sent[0].text, MESSAGES.aiUnavailable);
});

// --- migration + entrypoint hygiene ------------------------------------------

test("AI usage tables and functions are service_role only", async () => {
  const sql = await readFile(
    new URL("../../supabase/migrations/20261101000700_ai_assistant_usage.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter table public\.ai_usage enable row level security/);
  assert.match(sql, /revoke all on public\.ai_usage from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /grant execute on function public\.claim_ai_quota\(uuid, text, text, integer, integer\)\s+to service_role/);
  assert.match(sql, /grant execute on function public\.finish_ai_usage\(uuid, text, integer, integer\)\s+to service_role/);
  assert.equal((sql.match(/security definer\s+set search_path = ''/g) ?? []).length, 2);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /'circuit_open'/);
  assert.match(sql, /'user_limited'/);
  assert.match(sql, /'global_limited'/);
  assert.match(sql, /ai_assist_enabled boolean not null default true/);
});

test("the Gemini key is read from the function environment only", async () => {
  const entry = await readFile(
    new URL("../../supabase/functions/telegram-webhook/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(entry, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(entry, /Deno\.env\.get\("GEMINI_MODEL"\)/);
  assert.doesNotMatch(entry, /EXPO_PUBLIC/);
  assert.doesNotMatch(entry, /console\.\w+\([^)]*(apiKey|GEMINI_API_KEY)/);

  const client = await readFile(
    new URL("../../src/features/assistant/gemini.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(client, /\?key=/);
  assert.doesNotMatch(client, /console\./);
});
