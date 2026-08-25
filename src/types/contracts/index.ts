/**
 * Canonical backend contracts (PLAN_BACKEND.md Stage 1).
 *
 * These types are the single source of truth for shapes shared across the
 * mobile app, Telegram bot, and any future channel or Edge Function. Many
 * fields describe stages that have not been implemented yet — see each
 * file's header comment and docs/backend/architecture.md for what exists
 * today versus what is planned.
 */

export * from "./response";
export * from "./errors";
export * from "./transaction";
export * from "./goal";
export * from "./category";
export * from "./account";
export * from "./currency";
export * from "./user";
export * from "./attachment";
export * from "./draft";
export * from "./channel-connection";
export * from "./ai-usage";
