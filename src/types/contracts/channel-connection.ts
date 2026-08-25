/**
 * Canonical channel-connection contract (PLAN_BACKEND.md Stage 7).
 * No `channel_connections` table exists today. This is the target shape
 * for linking a Finance Tracker account to Telegram (and, later,
 * WhatsApp) through one shared bot per channel.
 */

export const ChannelType = {
  Telegram: "telegram",
  WhatsApp: "whatsapp",
} as const;

export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export const ChannelConnectionStatus = {
  PendingLink: "pending_link",
  Linked: "linked",
  Disconnected: "disconnected",
} as const;

export type ChannelConnectionStatus =
  (typeof ChannelConnectionStatus)[keyof typeof ChannelConnectionStatus];

export type ChannelConnection = {
  id: string;
  workspace_id: string;
  user_id: string;
  channel: ChannelType;
  /** Provider chat/user id. Never logged or shown to other users. */
  provider_chat_id: string;
  provider_user_id: string;
  status: ChannelConnectionStatus;
  linked_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One-time account-link code. The plaintext code is shown to the user
 * exactly once and never stored — only its hash is persisted, and it must
 * be invalidated immediately after a successful link or after expiry.
 */
export type ChannelLinkCode = {
  id: string;
  user_id: string;
  workspace_id: string;
  channel: ChannelType;
  code_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};
