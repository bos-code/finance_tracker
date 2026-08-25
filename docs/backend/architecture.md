# Backend Architecture — Stage 1 Baseline

Companion to [PLAN_BACKEND.md](../../PLAN_BACKEND.md). This document is the
Stage 1 deliverable: it records what the backend actually is today, the
contracts every later stage builds against, and the gaps a later stage must
close. See also [database-inventory.md](database-inventory.md),
[migration-checklist.md](migration-checklist.md), and
[error-codes.md](error-codes.md).

Audited: 2026-07-31.

## 1. System overview

There is no custom backend server. The mobile app (Expo/React Native)
talks directly to Supabase:

```
Expo app (iOS/Android/Web)
  ├─ Supabase Auth        (email/password, session in AsyncStorage)
  ├─ Supabase Postgres    (public.transactions, public.goals — direct client queries, RLS-enforced)
  └─ AsyncStorage          (local cache: monthly transaction cache, offline pending-op queue, app lock, theme/currency, app store)
```

No Supabase Storage bucket, no Edge Function, and no server-side code of
any kind exists yet. `src/services/api/http-client.ts` is unused scaffold
pointing at a placeholder external API (`example.api.company.com`) — left
in place but not wired into anything; do not build against it, it predates
the Supabase integration.

## 2. Current module map

| Layer | Files | Notes |
|---|---|---|
| Supabase client | `src/lib/supabase.ts` | Single client instance, AsyncStorage-backed session persistence, auto refresh |
| Auth | `src/context/auth-context.tsx`, `src/services/supabase/auth-service.ts`, `src/hooks/use-auth.ts` | Email/password only. `full_name`/`theme`/`currency` live in `user_metadata`, not a `profiles` table |
| Transactions | `src/services/supabase/transaction-service.ts`, `src/hooks/use-transactions.ts` | Direct Supabase CRUD + pure analytics functions (`calcMonthSummary`, `calcDailyTotals`, `calcCategoryBreakdown`) + offline branch |
| Goals | `src/services/supabase/goal-service.ts`, `src/hooks/use-goals.ts` | Direct Supabase CRUD only — **no offline support at all** |
| Offline queue | `src/services/offline/offline-store.ts`, `pending-op.ts`, `sync-service.ts`, `src/context/offline-context.tsx` | Transactions only; see findings below |
| App lock (PIN/biometrics) | `src/context/app-lock-context.tsx` | 100% local, never synced to Supabase (by design — legacy remote fields are actively scrubbed) |
| Local preferences | `src/store/use-app-store.ts` (Zustand + AsyncStorage) | Theme, currency preset, selected account id (unused elsewhere), app lock state |
| Canonical contracts | `src/types/contracts/*` | **New in this stage** — see §4 |
| Environment config | `src/config/env.ts`, `.env.example` | **New in this stage** — see §6 |

## 3. Audit findings

Findings are ranked by relevance to Stage 2 (transaction reliability), since
that's the next stage. None of these are fixed in this stage — Stage 1 is
audit-and-document only, per the execution rules. They are recorded here so
Stage 2 starts from a known list instead of rediscovering them.

### 3.1 Two independent, disagreeing optimistic-update paths (High — feeds Stage 2)

`createTransaction(data, isOnline=false)` in `transaction-service.ts`
writes an optimistic record directly into the **AsyncStorage month cache**
(via `patchCachedMonth`) with an id shaped `local_<timestamp>_<random>`,
and separately queues a `PendingCreate` op carrying that same id as
`tempId`.

Independently, `useCreateTransaction()`'s React Query `onMutate` in
`use-transactions.ts` writes its **own** optimistic record straight into
the **React Query cache** with a differently-shaped id, `opt_<timestamp>`,
and no relation to the AsyncStorage-cache record or the queued op at all.

Both paths run on every offline create. Today the app happens to avoid
visible duplicates because `useTransactions()`'s `queryFn` re-reads
`getTransactionsByMonth`, which for offline reads returns the AsyncStorage
cache — so the React Query optimistic record is transient and gets
overwritten on next fetch. But `sync-service.ts`'s `executeOp` only
reconciles the AsyncStorage cache (swapping `tempId` for the real synced
record); it never touches the React Query cache directly, relying on
`onSettled`'s `invalidateQueries` to eventually refetch. If a refetch is
skipped or delayed, the `opt_` record and the real synced record can both
be visible at once. This is exactly the class of bug Stage 2 ("Prevent
duplicate cache insertion during synchronization", "No duplicate
transaction should appear after reconnection") must close — the fix
should pick **one** source of truth for optimistic offline records (most
likely: React Query cache only, with the AsyncStorage month cache used
purely as the offline-read fallback, not a second write target).

### 3.2 Offline session restoration falls back to signed-out, not cached session (High — feeds Stage 2)

`auth-context.tsx`'s bootstrap always calls `supabaseClient.auth.getUser()`,
which hits the network to revalidate against Supabase. If that call fails
while offline, the `catch` block sets `user` to `null` — i.e. **a user who
opens the app offline is treated as signed out**, even though
`supabase-js` persisted a valid session in AsyncStorage and `onAuthStateChange`
may still fire with a cached session. Stage 2 explicitly calls for
"Improve offline authentication restoration using the last valid local
session while clearly indicating offline status" — this is the exact
mechanism to fix. The `fallbackUser` parameter already threaded through
`syncUserFromSupabase` is unused on the initial boot call (`void
syncUserFromSupabase()` passes no fallback), so there's no
session-recovery path at all on a cold, offline start today.

### 3.3 Goals have zero offline support (Medium — feeds Stage 2 scope decision)

`goal-service.ts` and `use-goals.ts` call Supabase directly with no
`isOnline` branch, no queueing, and no cache. Confirmed by README: "Goals
are currently fetched and written directly through Supabase and do not use
the offline queue." Stage 2's offline work should decide explicitly
whether goals get the same treatment as transactions or stay online-only
for this release — currently that's an unstated gap rather than a decision.

### 3.4 Retried sync ops can double-write (Medium — feeds Stage 2)

`sync-service.ts`'s `syncPendingOps` calls `removePendingOp` only after
`executeOp` resolves. If the app is killed between a successful Supabase
insert and the `removePendingOp` write completing, the create op is
retried on next launch — `createTransaction` will insert a second row
server-side. There is no idempotency key anywhere in the mutation path.
This is precisely Stage 2's "Add idempotency keys to transaction
mutations… Ensure retried requests cannot create duplicate records."

### 3.5 PIN stored in plaintext in persisted local state (Medium — feeds Stage 10, worth Stage 2 awareness)

`appLockPin` is stored as a plain 4-digit string inside the Zustand store,
which is persisted verbatim to AsyncStorage (unencrypted on both iOS and
Android by default). Stage 10 explicitly calls for moving "sensitive local
secrets and PIN-related data away from insecure storage paths" — flagging
here so it isn't missed. The correct fix is `expo-secure-store` (Keychain
/ Keystore-backed), not AsyncStorage.

### 3.6 `category_id` is untyped free text (Low — feeds Stage 5)

`transactions.category_id` is a `text` column with no foreign key,
matched only by convention against the hardcoded `ALL_CATEGORIES` map in
`src/constants/categories.ts`. Nothing prevents a stored `category_id`
that doesn't exist in that map (it would just render with no icon/color).
Fine for the current single-source-of-truth constant list; Stage 5's
category dictionary should decide whether this becomes a real reference
table or stays a validated-at-the-edge free text field.

### 3.7 Dead/conflicting type files removed in this stage

`src/types/domain/transaction.ts`, `account.ts`, and `analytics.ts` defined
a `Transaction` (with `type: "income"|"expense"|"transfer"`) and `Account`
shape that **do not match** the real, live `Transaction`/`TransactionType`
("Expenditure"/"Revenue") used throughout `transaction-service.ts` and every
screen. Grep confirmed zero imports of any of the three files anywhere in
`src/` — they were unused scaffolding from before the Supabase integration
existed, left behind and actively misleading (a future contributor could
easily import the wrong `Transaction` type and get category/type values
that don't exist in the database). They have been deleted; the canonical
replacement lives in `src/types/contracts/transaction.ts`.
`src/types/domain/goal.ts` was **not** removed — it's live-wired into
`goal-service.ts`, `use-goals.ts`, and `goals-screen.tsx`, and its shape
already matches `public.goals`. It duplicates the new
`src/types/contracts/goal.ts#CurrentGoalRow` shape; reconciling the two
(pointing the service layer at the contracts version) is left for Stage 3,
which touches `goal-service.ts` anyway to add `workspace_id`.

## 4. Canonical contracts

Live in `src/types/contracts/`, re-exported from `src/types/contracts/index.ts`:

- `response.ts` — standard API response envelope (§5)
- `errors.ts` — error code catalogue (§5, full list in [error-codes.md](error-codes.md))
- `transaction.ts` — `TransactionStatus`, `TransactionSource`, `SyncState`, canonical `Transaction`, plus `CurrentTransactionRow` matching today's actual `public.transactions` row
- `goal.ts` — canonical `Goal` (today's shape + `workspace_id`)
- `category.ts`, `account.ts`, `currency.ts`, `user.ts` (profile/workspace), `attachment.ts`, `draft.ts`, `channel-connection.ts`, `ai-usage.ts`

These types describe the **target** shape the whole plan converges on, not
only what's implemented today. Every file's header comment states which
stage introduces which fields, and `CurrentTransactionRow` /
`CurrentGoalRow` type aliases exist specifically so code can reference
"what the database actually has right now" without confusing it with the
target contract. No `zod` schemas exist yet — Zod is in the target stack
per PLAN_BACKEND.md, but nothing consumes runtime validation until Stage 5
(draft parsing) and Stage 6 (AI output validation); adding the dependency
now with nothing to validate would be premature.

## 5. Standard API response shape & error handling

`src/types/contracts/response.ts` defines the envelope every Edge Function
and every service function that crosses a trust boundary should return:

```ts
type ApiResponse<T> = { status: "success"; data: T }
                     | { status: "error"; error: AppError };
```

`AppError` (`errors.ts`) carries a catalogued `ErrorCode`, a user-safe
`message` (defaulted from `ERROR_CODE_MESSAGE`), optional `details`, and an
optional `requestId` for correlating with server logs. Full code list,
categories, HTTP statuses, and the raw-Supabase-error → code mapping are in
[error-codes.md](error-codes.md).

This envelope is **not yet wired into `transaction-service.ts` or
`goal-service.ts`** — those still throw raw Supabase errors, which is why
Stage 1's UX requirement ("No database failure may be presented as 'no
transactions'") isn't fully met today (e.g. `getTransactionsByMonth`
silently returns `[]` on any error, indistinguishable from a genuinely
empty month — see finding 3.1's sibling issue). Migrating the services to
return `ApiResponse<T>` is in scope for Stage 2, since that stage is
already touching every mutation path for idempotency and sync-state work.

## 6. Transaction lifecycle, sources, and sync states

Defined exactly as PLAN_BACKEND.md Stage 1 specifies, in
`src/types/contracts/transaction.ts`:

- **`TransactionStatus`**: `draft`, `pending_confirmation`, `confirmed`,
  `needs_review`, `reversed`, `deleted`. No `status` column exists yet —
  every current row is implicitly `confirmed`.
- **`TransactionSource`**: `mobile_app`, `telegram`, `whatsapp`,
  `web_dashboard`, `import`, `system`. Only `mobile_app` is possible today.
- **`SyncState`** (client-local, not persisted server-side):
  `local_only`, `queued`, `syncing`, `synced`, `failed`, `conflict`. This
  is the model Stage 2 should use to replace the current binary "is it in
  the pending-ops array or not" state.

## 7. Environments

Four environments — `local`, `development`, `preview`, `production` — are
now formalized in `src/config/env.ts` (`EXPO_PUBLIC_APP_ENV`, defaulting
from `__DEV__` when unset) and `eas.json`'s three build profiles. All four
currently resolve to the **same single Supabase project** — there is only
one. This is fine for solo pre-release development but is a named risk;
see [migration-checklist.md § Environments](migration-checklist.md#environments)
for the action item to provision a non-production project before Stage 3's
schema changes get non-trivial. `.env.example` documents every variable a
new environment file needs.

## 8. What this stage changed

- Added `src/types/contracts/*` (canonical types, response envelope, error catalogue).
- Added `src/config/env.ts` and `.env.example`.
- Wired `src/lib/supabase.ts` to `requireEnv()` instead of its own inline check.
- Added `EXPO_PUBLIC_APP_ENV` to each `eas.json` build profile.
- Created `supabase/migrations/` for all future schema changes (existing `supabase/001_create_goals.sql` untouched — see migration-checklist.md).
- Deleted three dead, unused, conflicting type files (`src/types/domain/{transaction,account,analytics}.ts`).
- Added this document, database-inventory.md, migration-checklist.md, error-codes.md.
- Added a baseline automated test suite for current critical pure-function/service behavior (see completion gate below).

## 9. Stage 1 completion gate

> Stage 1 is complete when the existing backend behavior is documented,
> critical transaction flows are testable, and no new feature depends on
> undocumented behavior.

- **Documented**: this file + database-inventory.md cover every table,
  policy, trigger, and service. §3 records every known gap/bug rather than
  leaving it implicit.
- **Testable**: baseline tests cover the pure transaction/goal calculators,
  the offline cache/pending-op store, and the sync-service FIFO/continue-
  on-failure behavior (see test suite for coverage list) — the exact
  surfaces Stage 2 is about to change.
- **No undocumented dependency**: nothing in this stage adds a feature;
  it only documents, types, and tests what exists.

## 10. Carried-forward risks (not fixed this stage)

Everything in §3, plus:

- No environment isolation in practice (single Supabase project).
- No CLI-tracked migrations (manual SQL Editor application).
- `getTransactionsByMonth` and other reads swallow errors into empty
  results rather than surfacing a distinguishable "failed" state — flagged
  in §5, fix belongs to Stage 2 alongside the `ApiResponse<T>` migration.
