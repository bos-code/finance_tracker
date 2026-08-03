# Backend Architecture

## Status

This document is the Stage 1 contract for Finance Tracker. It describes the
existing backend and the decisions that govern Stages 2–10 in
`PLAN_BACKEND.md`.

## Architectural decisions

| Concern | Decision | Reason |
| --- | --- | --- |
| Service shape | Supabase backend-as-a-service plus feature-first TypeScript Edge Functions | Preserves the working mobile integration while giving Telegram, parsing, receipts, and scheduled work trusted server boundaries. |
| Database | Supabase PostgreSQL | The current schema, RLS, Auth identities, and client all depend on Postgres; H2 is not part of this architecture. |
| Client boundary | Typed Supabase client and React Query | Existing reads and mutations remain direct and authenticated, while canonical contracts remove hand-written type drift. |
| Authentication | Supabase Auth JWT plus database RLS | The mobile SDK manages session refresh and `auth.uid()` is the final row-isolation boundary. |
| Realtime | Supabase Postgres Changes/Broadcast in Stage 9 | Realtime is valuable after mutation idempotency and workspace scoping are stable. |
| Errors | `BackendError` plus the canonical `ApiResult` envelope | Provider details stay internal and every user-facing failure has a stable code, message, and retry policy. |
| Structure | Feature-first | Transaction parsing, attachments, connections, and notifications keep their business rules beside their tests instead of in a generic controller folder. |

## Current request path

1. Expo restores a Supabase session from platform storage.
2. React Query invokes the transaction or goal service.
3. The typed Supabase client sends the current JWT to PostgREST.
4. PostgreSQL RLS limits rows with `auth.uid() = user_id`.
5. Successful monthly transaction reads warm a user-and-month AsyncStorage
   cache.
6. Offline transaction writes create a local record and a durable pending
   operation for later synchronization.

Direct table access is appropriate for the current owner-scoped CRUD. Trusted
work that requires service-role access, provider secrets, webhook verification,
AI calls, file validation, or cross-row transactions belongs in a Supabase Edge
Function.

## Source-of-truth hierarchy

1. Timestamped files under `supabase/migrations/` will be authoritative once
   the Stage 2 migration baseline is introduced.
2. `src/contracts/database.ts` mirrors the deployed public schema.
3. `src/contracts/backend.ts` defines mobile/Edge Function domain contracts,
   lifecycle values, sources, sync states, and API results.
4. Feature services translate provider errors and records at the boundary.
5. React Query owns remote cache state; AsyncStorage is only an offline replica
   and operation journal.

No UI type, fixture, Telegram payload, or local cache may independently invent
a transaction lifecycle value or backend error code.

## Canonical transaction model

The deployed table currently supports owner, type, amount, note, category, and
local calendar date. The additive target contract also defines:

- lifecycle: `draft`, `pending_confirmation`, `confirmed`, `needs_review`,
  `reversed`, `deleted`
- source: `mobile_app`, `telegram`, `whatsapp`, `web_dashboard`, `import`,
  `system`
- synchronization: `local_only`, `queued`, `syncing`, `synced`, `failed`,
  `conflict`

Those columns are contracts in Stage 1, not claims that the current database
already contains them. They will be added through additive migrations in the
appropriate stage.

## Security boundaries

- The Expo app receives only the Supabase URL and anonymous/publishable key.
- Service-role keys, Telegram secrets, webhook secrets, and Gemini keys are
  server-only Edge Function secrets.
- Every financial table must enable RLS before any client can access it.
- Edge Functions validate the bearer token unless a webhook has its own signed
  provider boundary.
- App Lock remains device-local in the operating-system secure store and is
  not a backend credential.
- Receipt objects will use a private bucket and short-lived signed URLs.

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
- Stage 4 adds private receipt storage.
- Stages 5–6 add deterministic parsing and controlled AI fallback.
- Stages 7–8 add Telegram linking and finance flows.
- Stage 9 adds Realtime, notifications, and OCR assistance.
- Stage 10 completes audit logging, rate limiting, security tests, deployment,
  and rollback documentation.
