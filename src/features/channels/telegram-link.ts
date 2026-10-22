/**
 * Pure helpers for the Telegram account-link code. Shared by the mobile app and
 * the telegram-webhook Edge Function so both sides agree on the code format.
 * Keep this file dependency-free: it is also bundled into the Deno runtime.
 */

export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_TTL_MINUTES = 10;

// Mirrors the alphabet in create_channel_link_code (no I, O, 0, or 1).
const LINK_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/** Uppercases and strips separators so "k7m2 9qxa" and "K7M2-9QXA" match. */
export function normalizeLinkCode(input: string): string {
  return input.toLocaleUpperCase("en-US").replace(/[^A-Z0-9]/g, "");
}

export function isPlausibleLinkCode(input: string): boolean {
  return LINK_CODE_PATTERN.test(normalizeLinkCode(input));
}

/** Formats a normalized code for display as XXXX-XXXX. */
export function formatLinkCode(input: string): string {
  const normalized = normalizeLinkCode(input);
  if (normalized.length !== LINK_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function linkCodeSecondsRemaining(
  expiresAt: string,
  nowMs: number = Date.now(),
): number {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return 0;
  return Math.max(0, Math.ceil((expiresMs - nowMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Deep link that opens the bot with the code pre-filled. Telegram allows
 * A-Z, a-z, 0-9, "_" and "-" in the start payload, so the normalized code works.
 */
export function telegramStartUrl(
  botUsername: string | undefined | null,
  code: string,
): string | null {
  const username = botUsername?.trim().replace(/^@/, "");
  if (!username || !/^[A-Za-z0-9_]{5,32}$/.test(username)) return null;
  const normalized = normalizeLinkCode(code);
  if (!LINK_CODE_PATTERN.test(normalized)) return null;
  return `https://t.me/${username}?start=${normalized}`;
}
