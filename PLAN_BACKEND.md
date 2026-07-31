# Finance Tracker Backend Implementation Plan

## Purpose

This document defines the backend implementation plan for Finance Tracker. The work is divided into ten stages. Each stage must be completed, tested, reviewed, and committed before the next stage begins.

The backend must support the existing mobile app while preparing the product for location-aware currency, receipt storage, Telegram automation, controlled AI assistance, reliable offline synchronization, and future WhatsApp integration.

This plan does not include payment processing, subscriptions, monetization, or business billing.

---

## Core priorities

The implementation must protect the following priorities throughout all ten stages:

1. **User experience:** Every backend decision must reduce user effort, prevent confusing states, and provide understandable recovery paths.
2. **Data integrity:** Financial records must never be duplicated, silently lost, incorrectly reassigned, or saved with unverified values.
3. **Security and privacy:** Financial information, receipts, bot connections, tokens, and personal data must be protected by default.
4. **Reliability:** The application must remain useful when AI, Telegram, network access, or a third-party service is unavailable.
5. **Low operating cost:** Deterministic logic and local processing must be used before paid or limited external services.
6. **Maintainability:** Shared business logic must not be duplicated across the mobile app, Telegram, and future channels.
7. **Observability:** Failures must be traceable through logs, statuses, retries, and audit records.
8. **Backward compatibility:** Existing users and transactions must continue working during migrations.

---

## Target backend stack

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Supabase scheduled jobs where required
- TypeScript
- Zod for validation
- Telegram Bot API
- Gemini Flash-Lite as the controlled AI fallback
- Deterministic TypeScript parsing before AI
- Private receipt storage with signed URLs

The mobile application, Telegram bot, and future integrations must use the same backend and the same transaction rules.

---

# Stage 1 — Audit, contracts, and backend foundation

## Goal

Establish a reliable baseline before introducing new backend features.

## Work

- Audit the current database schema, migrations, Supabase client usage, transaction service, goals service, authentication flow, offline queue, cache behavior, and error handling.
- Document all existing tables, columns, indexes, constraints, RLS policies, storage buckets, and Edge Functions.
- Define canonical backend types for users, transactions, goals, categories, accounts, currencies, attachments, drafts, bot connections, and AI usage.
- Define one standard API response shape for success, validation errors, authentication errors, permission errors, conflicts, rate limits, and server failures.
- Define transaction lifecycle states:
  - `draft`
  - `pending_confirmation`
  - `confirmed`
  - `needs_review`
  - `reversed`
  - `deleted`
- Define supported transaction sources:
  - `mobile_app`
  - `telegram`
  - `whatsapp`
  - `web_dashboard`
  - `import`
  - `system`
- Add environment separation for local, development, preview, and production.
- Create a migration and rollback strategy.

## UX requirements

- Backend errors must produce user-friendly messages instead of empty screens.
- No database failure may be presented as “no transactions.”
- Existing user data must remain visible during the migration process.
- The app must be able to distinguish empty data, offline data, loading, and actual failure.

## Deliverables

- Backend architecture document.
- Database inventory.
- Canonical TypeScript contracts.
- Error-code catalogue.
- Migration checklist.
- Baseline automated tests for current critical behavior.

## Completion gate

Stage 1 is complete when the existing backend behavior is documented, critical transaction flows are testable, and no new feature depends on undocumented behavior.

## Suggested commit

`docs: define backend architecture and contracts`

---

# Stage 2 — Repair transaction reliability and offline synchronization

## Goal

Make transaction creation, editing, deletion, caching, and synchronization trustworthy before adding bots or AI.

## Work

- Replace temporary offline IDs safely when the server creates the permanent transaction.
- Update all queued operations that reference a temporary ID.
- Prevent duplicate cache insertion during synchronization.
- Apply optimistic offline updates to the local cache immediately.
- Apply optimistic offline deletes consistently.
- Add idempotency keys to transaction mutations.
- Ensure retried requests cannot create duplicate records.
- Add explicit sync states:
  - `local_only`
  - `queued`
  - `syncing`
  - `synced`
  - `failed`
  - `conflict`
- Preserve failed operations instead of silently removing them from the queue.
- Add retry counts, last error, and next retry time.
- Define conflict handling for edits made on multiple devices.
- Improve offline authentication restoration using the last valid local session while clearly indicating offline status.

## UX requirements

- A transaction entered offline must appear immediately.
- Users must see whether an item is pending synchronization.
- Failed synchronization must show a clear retry action.
- No duplicate transaction should appear after reconnection.
- A failed update must not look successful.
- Users must never lose a transaction because the app closed during synchronization.

## Deliverables

- Reliable offline queue.
- Temporary-ID reconciliation.
- Idempotent mutation layer.
- Sync status model.
- Transaction synchronization tests.
- Failure and retry tests.

## Completion gate

Stage 2 is complete when create, update, and delete operations survive offline use, reconnect correctly, avoid duplication, and expose failures clearly.

## Suggested commit

`fix: stabilize transaction sync and offline queue`

---

# Stage 3 — Profiles, workspaces, accounts, and currency foundation

## Goal

Prepare the backend for personal and business finance without forcing business features into the current user experience.

## Work

- Introduce `profiles` if the current user metadata is insufficient.
- Introduce `workspaces`.
- Automatically create one `Personal Finance` workspace for every existing and new user.
- Introduce `workspace_members` with owner and future collaborator roles.
- Introduce `financial_accounts` for Cash, Bank, Savings, Mobile Money, Card, and custom accounts.
- Attach transactions, goals, categories, and future budgets to a workspace.
- Add `country_code`, `locale`, `timezone`, `default_currency`, and `currency_detection_source` to the appropriate profile or workspace.
- Store ISO 4217 currency codes instead of relying on symbols.
- Add currency fields to every transaction:
  - `currency_code`
  - `base_currency_code`
  - `base_amount`
  - `exchange_rate`
- Backfill existing users and transactions safely.
- Add a country-to-default-currency mapping service.
- Allow manual currency override and preserve the choice.
- Do not automatically switch currency when the user travels.

## UX requirements

- Currency is suggested from device region, then confirmed by the user.
- Nigerian users should receive NGN as the initial suggestion.
- Users can change currency without losing historical records.
- Existing transactions continue to display correctly after migration.
- The current app can continue showing one personal workspace until workspace switching is introduced later.

## Deliverables

- Workspace schema.
- Account schema.
- Currency schema and mapping.
- Backfill migration.
- Currency validation and formatting contracts.
- RLS policies for workspace-scoped access.

## Completion gate

Stage 3 is complete when every transaction belongs to a valid workspace, currency is stored explicitly, existing data is migrated, and users remain isolated through RLS.

## Suggested commit

`feat: add workspace account and currency foundation`

---

# Stage 4 — Receipt and document storage

## Goal

Allow financial proof to be stored securely and attached to transactions.

## Work

- Create a private Supabase Storage bucket for transaction receipts.
- Support PDF, JPEG, PNG, and WebP files.
- Define file-size and page-count limits.
- Add `transaction_attachments` with:
  - owner and workspace references
  - transaction reference
  - storage path
  - original filename
  - MIME type
  - file size
  - file hash
  - upload source
  - provider media identifiers
  - processing status
  - timestamps
- Support multiple attachments per transaction.
- Generate short-lived signed URLs for private viewing.
- Add upload, retry, delete, and orphan-cleanup workflows.
- Prevent one user from accessing another user’s files.
- Compute hashes to detect duplicate uploads.
- Preserve original documents.
- Add processing states for future OCR:
  - `uploaded`
  - `extracting_text`
  - `processed`
  - `failed`
  - `needs_review`

## UX requirements

- Upload progress must be visible.
- Failed uploads must be retryable.
- A transaction must still save when an optional receipt upload fails.
- Users must know whether a receipt is private and securely stored.
- Deleting a receipt must require clear confirmation.
- Unsupported formats must produce a useful message before upload.

## Deliverables

- Private receipt bucket.
- Attachment schema and RLS.
- Signed URL service.
- Upload validation.
- Orphan cleanup process.
- Storage security tests.

## Completion gate

Stage 4 is complete when users can safely attach, view, retry, and delete receipt files without exposing private documents or blocking transaction entry.

## Suggested commit

`feat: add secure transaction receipt storage`

---

# Stage 5 — Shared transaction parsing and draft engine

## Goal

Create one backend service that can convert messages from any channel into safe transaction drafts.

## Work

- Build a deterministic TypeScript parser for common transaction phrases.
- Support Nigerian shorthand such as `5k`, `2.5k`, `350k`, and `1m`.
- Detect income and expense keywords.
- Detect explicit currency symbols and ISO currency codes.
- Parse dates such as today, yesterday, last Friday, and explicit dates.
- Match known category keywords.
- Extract descriptions and merchant names where possible.
- Assign a confidence score to every extracted field.
- Validate every parsed result with Zod.
- Create `transaction_drafts` with field-level confidence and missing fields.
- Never save an uncertain result directly as a confirmed transaction.
- Add duplicate-message protection using source channel and source message ID.
- Create a review workflow for incomplete drafts.

## UX requirements

- Simple messages should feel instant.
- The user should only be asked about fields that are missing or uncertain.
- A failed parser must not discard the original message.
- Drafts must appear in the app as `Needs Review`.
- Users must be able to correct amount, type, date, category, account, currency, and description.
- The original source text must be available for context during correction.

## Deliverables

- Shared parsing service.
- Category dictionary.
- Amount and date parser.
- Draft transaction schema.
- Field-confidence model.
- Parser test suite with common Nigerian finance phrases.

## Completion gate

Stage 5 is complete when common messages are parsed without AI, uncertain messages become reviewable drafts, and no unconfirmed financial record is silently finalized.

## Suggested commit

`feat: add transaction parser and review drafts`

---

# Stage 6 — Controlled AI fallback with Gemini Flash-Lite

## Goal

Use AI only when deterministic parsing is insufficient, while keeping the product functional without AI.

## Work

- Add Gemini Flash-Lite through a server-only Edge Function.
- Never expose the Gemini API key to the mobile app or Telegram client.
- Send only the minimum text required for extraction.
- Require strict structured JSON output.
- Validate every AI response with Zod.
- Add confidence thresholds.
- Use AI only when deterministic parser confidence is below the accepted threshold.
- Add project-wide and per-user safety limits.
- Track AI usage by user, feature, model, token count, success, failure, and estimated cost.
- Add timeout, retry, and circuit-breaker behavior.
- Disable AI automatically when limits are reached or the provider is unavailable.
- Fall back to deterministic logic.
- Save incomplete results as `Needs Review` drafts.
- Do not implement subscriptions or payment restrictions.

## UX requirements

- Users do not need to know which internal parser handled a successful transaction.
- When AI is unavailable, the bot and app must continue working.
- When a draft requires attention, the reason must be clear.
- AI must never fabricate a missing amount or date.
- User confirmation remains mandatory for ambiguous transactions.
- Sensitive account history must not be sent to the AI unless strictly required for a specific approved feature.

## Deliverables

- Gemini integration.
- AI usage tables.
- Limit enforcement.
- Structured-output validation.
- AI fallback and circuit breaker.
- Privacy filtering.
- AI failure tests.

## Completion gate

Stage 6 is complete when AI improves ambiguous parsing but its failure, exhaustion, or removal cannot stop users from recording transactions.

## Suggested commit

`feat: add controlled AI parsing fallback`

---

# Stage 7 — Telegram bot foundation and secure account linking

## Goal

Create one shared Telegram bot that safely connects each Telegram user to the correct Finance Tracker account.

## Work

- Create one Finance Tracker Telegram bot through BotFather.
- Implement a Telegram webhook using a Supabase Edge Function.
- Verify the Telegram webhook secret.
- Add `channel_connections` for Telegram and future channels.
- Add one-time account-link codes.
- Hash link codes before storage.
- Expire codes after a short period.
- Invalidate codes immediately after successful use.
- Store Telegram user ID and chat ID securely.
- Add disconnect and revoke operations.
- Add webhook event persistence for debugging and idempotency.
- Prevent duplicate processing of retried Telegram updates.
- Add basic bot commands:
  - `/start`
  - `/link`
  - `/help`
  - `/status`
  - `/disconnect`
- Add rate limiting and abuse protection.

## UX requirements

- Linking should require only a small number of steps.
- The bot must clearly explain when the account is linked.
- Invalid or expired codes must produce understandable recovery instructions.
- The bot must never expose internal IDs or backend errors.
- Users must be able to disconnect Telegram from the mobile app and from the bot.
- One shared bot must keep every user’s conversation and financial data isolated.

## Deliverables

- Telegram webhook.
- Secure linking flow.
- Channel connection schema.
- Webhook event and idempotency handling.
- Disconnect and revocation flow.
- Bot command foundation.

## Completion gate

Stage 7 is complete when multiple users can safely use one shared Telegram bot without data leakage, duplicate webhook handling, or insecure account linking.

## Suggested commit

`feat: add Telegram account linking and webhook foundation`

---

# Stage 8 — Telegram transaction and receipt experience

## Goal

Allow users to record and retrieve financial information naturally through Telegram.

## Work

- Route Telegram text through the deterministic parser.
- Use Gemini only when the parser requires assistance and limits permit it.
- Present a transaction confirmation summary before final save.
- Add inline actions:
  - Confirm
  - Edit
  - Cancel
  - Choose account
  - Choose category
  - Add receipt
- Save confirmed transactions through the shared transaction service.
- Save unresolved messages as `Needs Review` drafts.
- Allow PDF and image receipt uploads.
- Download Telegram media securely.
- Validate files before storage.
- Attach receipts to a confirmed transaction or draft.
- Add commands and natural-language queries for:
  - recent transactions
  - today’s spending
  - this month’s income
  - this month’s expenses
  - account balance
  - category totals
  - goal progress
- Add safe edit-last and delete-last flows with confirmation.
- Preserve source message IDs and Telegram file IDs.

## UX requirements

- The bot must feel conversational without pretending to be human.
- Confirmation messages must be short, readable, and explicit.
- Users must not be forced to open the app for ordinary successful entries.
- Incomplete transactions must still be captured as drafts.
- Receipt uploads must show progress or a processing acknowledgement.
- Editing and deleting must require clear confirmation.
- Long reports must be summarized instead of flooding the chat.

## Deliverables

- Telegram transaction creation.
- Confirmation workflow.
- Receipt ingestion.
- Financial query commands.
- Draft fallback.
- Edit and delete flows.
- End-to-end Telegram tests.

## Completion gate

Stage 8 is complete when a linked user can create income and expenses, attach proof, query recent financial information, and recover from uncertain messages without losing data.

## Suggested commit

`feat: complete Telegram finance assistant flows`

---

# Stage 9 — Realtime synchronization, notifications, and OCR pipeline

## Goal

Keep the mobile app and Telegram synchronized while adding useful, non-intrusive automation and receipt text extraction.

## Work

- Publish transaction and draft changes through Supabase Realtime or Broadcast.
- Ensure the mobile app can invalidate or update the correct cached queries.
- Add notification preferences.
- Support optional notifications for:
  - transaction confirmation
  - failed sync
  - large transactions
  - budget warnings
  - daily summary
  - weekly summary
  - goal progress
- Add scheduled jobs for summaries and reminders.
- Add delivery logs and retry status.
- Avoid duplicate notifications.
- Add receipt text extraction pipeline.
- Use embedded PDF text when available.
- Use on-device OCR from the mobile app for camera and image receipts where possible.
- Allow backend receipt text submission from trusted clients.
- Store raw extracted text separately from confirmed transaction fields.
- Use deterministic extraction first.
- Use AI only for difficult receipt interpretation.
- Require review before changing a confirmed transaction based on OCR.

## UX requirements

- A Telegram-created transaction should appear in the app quickly.
- Users control all optional notifications.
- The default experience must not be noisy.
- OCR must never silently replace user-entered values.
- Receipt processing failures must not affect the original stored file.
- Users must be able to review extracted merchant, amount, and date.

## Deliverables

- Realtime synchronization contract.
- Notification preference schema.
- Scheduled summary jobs.
- Delivery logs and retries.
- OCR processing statuses.
- Receipt text and review workflow.

## Completion gate

Stage 9 is complete when app and bot data remain synchronized, notifications are controllable and reliable, and receipt extraction assists users without silently altering financial records.

## Suggested commit

`feat: add realtime automation and receipt processing`

---

# Stage 10 — Security hardening, testing, deployment, and final push

## Goal

Prepare the complete backend for reliable release and leave a clear foundation for the frontend plan and future WhatsApp support.

## Work

- Review every table and storage bucket for RLS coverage.
- Confirm service-role credentials exist only in trusted server environments.
- Move sensitive local secrets and PIN-related data away from insecure storage paths.
- Add audit logs for transaction creation, editing, deletion, restoration, attachment actions, linking, disconnecting, and AI-assisted parsing.
- Add rate limits to public webhook and parsing endpoints.
- Add payload-size limits.
- Add file-type verification beyond filename extensions.
- Add replay protection and idempotency checks.
- Add database constraints and indexes based on observed query patterns.
- Add backup and restore documentation.
- Add data retention rules for raw Telegram messages and webhook payloads.
- Add health checks and structured logs.
- Integrate Sentry or another error-monitoring service where appropriate.
- Run migration tests against a production-like database.
- Run security tests, RLS tests, parser tests, AI fallback tests, storage tests, webhook tests, synchronization tests, and end-to-end Telegram tests.
- Document deployment for Supabase migrations, Storage, Edge Functions, secrets, Telegram webhook registration, and rollback.
- Document known limitations.
- Explicitly exclude WhatsApp, payments, subscriptions, and monetization from this release.
- Prepare the separate frontend implementation plan after backend approval.

## UX requirements

- Backend failures must map to useful and consistent user-facing states.
- Every irreversible action requires confirmation or a recovery path.
- Users must be able to understand whether data is saved, syncing, failed, or awaiting review.
- Privacy controls must be easy to find and execute.
- The system must degrade gracefully when Telegram, AI, OCR, or network access is unavailable.

## Deliverables

- Complete RLS and security review.
- Full automated test suite for critical backend behavior.
- Deployment and rollback guide.
- Monitoring and alerting setup.
- Data retention policy.
- Release checklist.
- Updated backend documentation.
- Final backend implementation commit and push.

## Completion gate

Stage 10 is complete only when all critical tests pass, migrations are reversible, secrets are protected, user data remains isolated, deployment is documented, and the complete backend work has been pushed successfully.

## Suggested commit

`chore: finalize backend security tests and deployment`

---

# Execution rules for all stages

1. Complete only one stage at a time.
2. Review the current repository before implementing each stage.
3. Do not modify unrelated files.
4. Add or update migrations for every schema change.
5. Never edit production data manually when a migration can perform the change safely.
6. Run relevant tests before each stage is considered complete.
7. Record limitations and unresolved risks immediately.
8. Commit each stage separately using a clear commit message.
9. Push only after the stage passes its completion gate.
10. Do not begin the next stage until the previous stage has been reviewed.

---

# Definition of backend completion

The backend is considered complete for this release when:

- Existing transactions remain intact and reliable.
- Offline create, edit, and delete operations synchronize without duplication or loss.
- Every user has a personal workspace and explicit default currency.
- Currency can be suggested from device region and manually changed.
- Transactions and goals are workspace-scoped.
- PDF and image receipts are stored privately.
- Common transaction messages are handled without AI.
- Gemini Flash-Lite is used only as a controlled fallback.
- AI exhaustion or failure produces a review draft instead of blocking the user.
- One shared Telegram bot securely supports multiple users.
- Telegram transactions and receipts synchronize with the mobile app.
- OCR can assist receipt processing without silently changing confirmed data.
- RLS, idempotency, rate limiting, logging, retries, and audit trails are active.
- Payments, subscriptions, monetization, and WhatsApp are not required for this release.

---

# Deferred work

The following items must remain outside this backend release:

- WhatsApp Cloud API implementation.
- User-owned Telegram bots.
- User-owned WhatsApp Business numbers.
- Payment processing.
- Subscriptions.
- Paid AI tiers.
- Team billing.
- Tax filing.
- Investment integrations.
- Bank-account aggregation.
- Full web dashboard.

These can be planned after the core backend and frontend are stable.
