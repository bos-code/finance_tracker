import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCountdown,
  formatLinkCode,
  isPlausibleLinkCode,
  linkCodeSecondsRemaining,
  normalizeLinkCode,
  telegramStartUrl,
} from "../../src/features/channels/telegram-link.ts";

test("link codes normalize regardless of case and separators", () => {
  assert.equal(normalizeLinkCode("k7m2-9qxa"), "K7M29QXA");
  assert.equal(normalizeLinkCode(" k7m2 9qxa "), "K7M29QXA");
  assert.equal(formatLinkCode("k7m29qxa"), "K7M2-9QXA");
});

test("plausibility matches the server alphabet (no I, O, 0, or 1)", () => {
  assert.equal(isPlausibleLinkCode("K7M2-9QXA"), true);
  assert.equal(isPlausibleLinkCode("K7M2-9QX"), false);
  assert.equal(isPlausibleLinkCode("K7M2-9QXAA"), false);
  for (const ambiguous of ["I", "O", "0", "1"]) {
    assert.equal(isPlausibleLinkCode(`K7M2-9QX${ambiguous}`), false, ambiguous);
  }
  assert.equal(isPlausibleLinkCode("spent 2500 on lunch"), false);
});

test("the countdown never goes negative and formats as m:ss", () => {
  const now = Date.parse("2026-10-22T10:00:00.000Z");
  assert.equal(linkCodeSecondsRemaining("2026-10-22T10:10:00.000Z", now), 600);
  assert.equal(linkCodeSecondsRemaining("2026-10-22T09:59:00.000Z", now), 0);
  assert.equal(linkCodeSecondsRemaining("not-a-date", now), 0);
  assert.equal(formatCountdown(600), "10:00");
  assert.equal(formatCountdown(65), "1:05");
  assert.equal(formatCountdown(-3), "0:00");
});

test("the deep link only exists for a valid bot username and code", () => {
  assert.equal(
    telegramStartUrl("@FinanceTrackerBot", "K7M2-9QXA"),
    "https://t.me/FinanceTrackerBot?start=K7M29QXA",
  );
  assert.equal(telegramStartUrl(undefined, "K7M2-9QXA"), null);
  assert.equal(telegramStartUrl("", "K7M2-9QXA"), null);
  assert.equal(telegramStartUrl("bad name!", "K7M2-9QXA"), null);
  assert.equal(telegramStartUrl("FinanceTrackerBot", "nope"), null);
});
