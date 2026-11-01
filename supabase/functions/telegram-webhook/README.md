# Telegram webhook

One shared Telegram bot for every Finance Tracker user. Each Telegram identity is
linked to exactly one account through a short-lived, single-use code created in
the app (Profile → Connections → Telegram).

## What it does

- `/start <code>`, `/link <code>`: link this chat to the account that created the code.
- `/status`, `/help`, `/disconnect`.
- `/ask <question>` and plain questions: short help about using Finance Tracker (needs the Gemini assistant, below).
- `/ai on|off`: per-chat switch. When off, this chat's messages are never sent to the AI provider.
- Any other private text message is parsed by the same deterministic parser the
  app uses and saved as a **draft** (`source = telegram`). Drafts appear in the
  app's Drafts review screen; nothing becomes a transaction without review.
- Photos and documents get a polite "coming soon" reply (Backend Stage 8).

## Gemini assistant (optional)

Off by default. It turns on only when both secrets exist:

- `GEMINI_API_KEY` – a Google AI Studio key.
- `GEMINI_MODEL` – the exact model id to call (a Flash-Lite model). It is a secret, not a
  constant, so it can change without a redeploy.
- Optional: `GEMINI_DAILY_USER_LIMIT` (default 30) and `GEMINI_DAILY_GLOBAL_LIMIT` (default 300).

What it does, and what it is not allowed to do:

- Fills in `amount`, `type`, or `category_key` **only** when the built-in parser could not read them.
  Suggestions are checked (the amount must appear in the user's text, the category must be a
  known one) and are stored with a confidence below the review threshold, so an AI-assisted
  draft always still needs a human check in the app.
- Answers short "how do I use this?" questions. It is told it cannot see account data and must
  not give financial advice.
- Only the text the user typed to the bot, plus a fixed list of category names, is sent to Google.
  No ids, balances, or history.
- Every call is reserved against per-user and project-wide daily limits (`claim_ai_quota`) and
  logged with token counts in `ai_usage`. Five failures with no success in five minutes opens a
  circuit breaker. If anything fails the bot silently falls back to its built-in rules.

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
