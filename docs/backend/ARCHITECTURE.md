# Backend Architecture

## Status

This document records the implemented backend through Stage 4. It describes
the existing backend and the decisions that govern Stages 5–10 in
`PLAN_BACKEND.md`.

## Architectural decisions

| Concern | Decision | Reason |
| --- | --- | --- |
| Service shape | Supabase backend-as-a-service plus feature-first TypeScript Edge Functions | Preserves the working mobile integration while giving Telegram, parsing, receipts, and scheduled work trusted server boundaries. |
| Database | Supabase PostgreSQL | The current schema, RLS, Auth identities, and client all depend on Postgres; H2 is not part of this architecture. |
| Client boundary | Typed Supabase client, transaction mutation RPC, and React Query | Reads are workspace-scoped through RLS; financial writes cross one idempotent, revision-aware database boundary. |
| Authentication | Supabase Auth JWT plus database RLS | The mobile SDK manages session refresh and `auth.uid()` is the final row-isolation boundary. |
| Realtime | Supabase Postgres Changes/Broadcast in Stage 9 | Realtime is valuable after mutation idempotency and workspace scoping are stable. |
| Errors | `BackendError` plus the canonical `ApiResult` envelope | Provider details stay internal and every user-facing failure has a stable code, message, and retry policy. |
| Structure | Feature-first | Transaction parsing, attachments, connections, and notifications keep their business rules beside their tests instead of in a generic controller folder. |

## Current request path

1. Expo restores a Supabase session from platform storage.
2. React Query invokes the transaction or goal service.
3. The typed Supabase client sends the current JWT to PostgREST.
4. The Workspace provider restores or fetches the signed-in user's personal
   workspace, membership boundary, default account, and base currency.
5. PostgreSQL RLS limits reads by workspace membership; transaction writes use
   `mutate_transaction` with explicit authenticated identity and membership
   checks.
6. Successful monthly transaction reads warm a user/workspace/month AsyncStorage
   cache.
7. Offline transaction writes create a local record and a versioned,
   user-scoped pending operation for later synchronization.
8. The database mutation journal makes create, update, and soft-delete retries
   idempotent; revision checks surface cross-device conflicts.
9. A receipt upload validates bytes and PDF bounds locally, registers an owned
   metadata path, uploads the bytes to the private bucket, then seals the row as
   uploaded. Viewing uses a 60-second signed URL.

Direct table reads remain appropriate for current workspace-scoped data. The
Stage 3 client writes through the database RPC. Existing owner-scoped write
policies remain temporarily for installed-client compatibility and must be
revoked only after a minimum-version cutover. Trusted work that
requires service-role access, provider secrets, webhook verification, AI calls,
file validation, or broader cross-row orchestration belongs in a Supabase Edge
Function.

## Source-of-truth hierarchy

1. Timestamped files under `supabase/migrations/` are authoritative for new
   environments and forward schema changes.
2. `src/contracts/database.ts` mirrors the deployed public schema.
3. `src/contracts/backend.ts` defines mobile/Edge Function domain contracts,
   lifecycle values, sources, sync states, and API results.
4. Feature services translate provider errors and records at the boundary.
5. React Query owns remote cache state; AsyncStorage is only an offline replica
   and operation journal.

No UI type, fixture, Telegram payload, or local cache may independently invent
a transaction lifecycle value or backend error code.

## Canonical workspace and transaction model

Each Auth user owns one current `Personal Finance` workspace with an owner
membership and default Cash account. The workspace holds the confirmed base
currency; profiles hold stable signup-region context. Manual currency changes
update the workspace and default account atomically but do not mutate prior
financial rows.

The Stage 2–3 migrations preserve owner, type, amount, note, category, and local
calendar date, and add:

- lifecycle: `draft`, `pending_confirmation`, `confirmed`, `needs_review`,
  `reversed`, `deleted`
- source: `mobile_app`, `telegram`, `whatsapp`, `web_dashboard`, `import`,
  `system`
- scope: `workspace_id` and `account_id`
- money identity: `currency_code`, `base_currency_code`, `base_amount`, and
  `exchange_rate`
- synchronization: `local_only`, `queued`, `syncing`, `synced`, `failed`,
  `conflict`

Synchronization state remains device-local because it describes a particular
replica. Scope, currencies, lifecycle, source, revision, deletion time, and
idempotency identity are database-backed. New transaction rows capture the
workspace base at write time; later workspace-currency changes preserve those
historical values. The repository cannot claim a remote project has these
objects until the timestamped migrations are applied there.

## Security boundaries

- The Expo app receives only the Supabase URL and anonymous/publishable key.
- Service-role keys, Telegram secrets, webhook secrets, and Gemini keys are
  server-only Edge Function secrets.
- Every financial table must enable RLS before any client can access it.
- Compatibility policies never widen ownership: legacy transaction writes are
  still restricted to `auth.uid() = user_id` during the cutover window.
- Edge Functions validate the bearer token unless a webhook has its own signed
  provider boundary.
- App Lock remains device-local in the operating-system secure store and is
  not a backend credential.
- Receipt objects use a private bucket, authenticated owner-path policies, and
  60-second signed URLs. Client code receives no service-role secret.
- Receipt deletion removes Storage first, then crosses a guarded metadata RPC;
  a server-only bounded cleanup function handles stale upload records in the
  same order.

## Environment model

| Environment | `EXPO_PUBLIC_APP_ENV` | Backend | Purpose |
| --- | --- | --- | --- |
| Local | `local` | Local Supabase | Migration and integration development |
| Development | `development` | Shared development project | Team device testing |
| Preview | `preview` | Fixtures or isolated preview project | UI/review builds without production data |
| Production | `production` | Production Supabase project | Released app |

Each deployed environment has independent Supabase projects, Auth users,
Storage objects, Edge Function secrets, and Telegram webhook configuration.
Production data is never copied into preview tests.

## Stage boundaries

- Stage 2 makes mutations idempotent and the offline journal reliable.
- Stage 3 adds profiles, personal workspaces, accounts, and explicit currency.
- Stage 4 adds private receipt storage, retry/delete recovery, and cleanup.
- Stages 5–6 add deterministic parsing and controlled AI fallback.
- Stages 7–8 add Telegram linking and finance flows.
- Stage 9 adds Realtime, notifications, and OCR assistance.
- Stage 10 completes audit logging, rate limiting, security tests, deployment,
  and rollback documentation.
