# Telegram webhook

One shared Telegram bot for every Finance Tracker user. Each Telegram identity is
linked to exactly one account through a short-lived, single-use code created in
the app (Profile → Connections → Telegram).

## What it does

- `/start <code>`, `/link <code>`: link this chat to the account that created the code.
- `/status`, `/help`, `/disconnect`.
- Any other private text message is parsed by the same deterministic parser the
  app uses and saved as a **draft** (`source = telegram`). Drafts appear in the
  app's Drafts review screen; nothing becomes a transaction without review.
- Photos and documents get a polite "coming soon" reply (Backend Stage 8).

Non-private chats, bot senders, and unsupported updates are ignored. Retried
updates are de-duplicated by `update_id`; chats are limited to 30 updates per
minute; failed link attempts are limited to 5 per 15 minutes per Telegram user.

## Deployment requirements

1. Apply migration `20261022000600_telegram_channel_connections.sql`.
2. Create a bot with [@BotFather](https://t.me/BotFather) and note its token and username.
3. Set these Edge Function secrets (never as `EXPO_PUBLIC_*`):
   - `TELEGRAM_BOT_TOKEN` – the BotFather token.
   - `TELEGRAM_WEBHOOK_SECRET` – a long random value using only `A-Z a-z 0-9 _ -`.
4. Deploy with JWT verification **off** (`--no-verify-jwt`). Telegram cannot send a
   Supabase JWT; the secret header is the credential and is checked in constant time.
5. Point Telegram at the function (run once, locally, with your real values):

   ```bash
   curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://<project-ref>.supabase.co/functions/v1/telegram-webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message"]'
   ```

6. Set `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` (without `@`) in the app's EAS
   environments so the app can offer an "Open Telegram" button.

## Source layout

`handler.ts` holds all behaviour behind injected dependencies and is covered by
`tests/backend/telegram-webhook.test.mjs`. `index.ts` only wires the Bot API and
Supabase service role. The parser and draft builder are imported from `src/` so
the app and the bot can never disagree about how text becomes a draft.
