# Telegram webhook

One shared Telegram bot for every Finance Tracker user. Each Telegram identity is
linked to exactly one account through a short-lived, single-use code created in
the app (Profile → Connections → Telegram).

## What it does

- `/start <code>`, `/link <code>`: link this chat to the account that created the code.
- `/status`, `/help`, `/disconnect`.
- `/drafts`: shows up to five waiting drafts, each with its own Save and Discard buttons.
- `/ask <question>` and plain questions: short help about using Finance Tracker (needs the Gemini assistant, below).
- `/ai on|off`: per-chat consent switch. **Off by default**: nothing is sent to the AI provider
  until the user sends `/ai on`.
- Any other private text message is parsed by the same deterministic parser the
  app uses and saved as a **draft** (`source = telegram`). The bot replies with every value it
  read and **Save** / **Discard** buttons. Tapping Save is the review: it creates the
  transaction and confirms the draft in one database step (`telegram_confirm_draft`), reusing the
  app's own rules (`src/features/drafts/chat-confirmation.ts`) and the same idempotency key as the
  in-app flow, so tapping twice, or confirming in the app too, can never save it twice. A draft
  that is missing a value, or is in a foreign currency with no exchange rate, offers only
  Discard and points to the app. Uncertain values are listed under "Please double-check".
- **Receipt photos** (a photo, or a JPEG/PNG/WebP image file, up to 8 MB): the bot downloads it,
  checks from its bytes that it really is an image, and keeps it in the private
  `transaction-receipts` bucket under the owner's own folder (`draft_receipts` holds the record).
  If AI assistance is on for the chat, Gemini reads the total, date, shop and category; anything
  typed in the caption wins over what the photo says. Every value the AI read is flagged
  "Please double-check", and nothing is saved until the person taps Save. When the draft is
  confirmed, from the bot or from the app, a database trigger attaches the photo to the new
  transaction so it shows up like any other receipt. Discarding the draft removes the photo, and
  `receipt-orphan-cleanup` removes photos from drafts that were deleted elsewhere or have expired.
  With AI off, a photo needs a caption (for example "spent 2500 on groceries") and is attached to that
  draft; without one the bot explains instead of guessing. PDFs, voice notes and video are declined.

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
  draft always needs a human check: the chat message names each AI-suggested value under
  "Please double-check", and nothing is saved until the person taps Save (or reviews it in the app).
- Answers short "how do I use this?" questions. It is told it cannot see account data and must
  not give financial advice.
- Only what the user sent to the bot is sent to Google: their text, or a receipt photo they sent
  while AI assistance was on, plus a fixed list of category names. The `/ai on` consent message says
  so. Photos are never sent when the chat has not opted in.
  No ids, balances, or history.
- Every call is reserved against per-user and project-wide daily limits (`claim_ai_quota`) and
  logged with token counts in `ai_usage`. Five failures with no success in five minutes opens a
  circuit breaker. If Gemini is unavailable, limited, or returns something unusable, draft
  parsing silently keeps the built-in rules' result. `/ask` has no rules-based answer, so it
  replies that the assistant is unavailable and points to `/help`.

Non-private chats, bot senders, and unsupported updates are ignored. Retried
updates are de-duplicated by `update_id`; chats are limited to 30 updates per
minute; failed link attempts are limited to 5 per 15 minutes per Telegram user.

## Deployment requirements

1. Apply migrations `20261022000600_telegram_channel_connections.sql`,
   `20261101000800_telegram_draft_confirmation.sql` (Save / Discard buttons) and
   `20261102000900_telegram_receipt_photos.sql` (receipt photos).
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
     -d 'allowed_updates=["message","callback_query"]'
   ```

   `callback_query` is what delivers Save / Discard taps. A webhook registered earlier with only
   `["message"]` is widened automatically the first time the function runs after a deploy
   (`ensureButtonTapsAllowed` in `index.ts`).
6. Set `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` (without `@`) in the app's EAS
   environments so the app can offer an "Open Telegram" button.

## Source layout

`handler.ts` holds all behaviour behind injected dependencies and is covered by
`tests/backend/telegram-webhook.test.mjs`. `index.ts` only wires the Bot API and
Supabase service role. The parser and draft builder are imported from `src/` so
the app and the bot can never disagree about how text becomes a draft.
