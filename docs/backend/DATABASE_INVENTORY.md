# Database Inventory

## Inventory boundary

The repository now contains a timestamped current-schema baseline and an
additive Stage 2 reliability migration under `supabase/migrations/`. The older
`supabase/001_create_goals.sql` is retained as history and is no longer the
authoritative installation path. There is still no linked-project schema dump,
Storage bucket declaration, Edge Function, or seed file. This inventory
describes source-controlled schema, not unverified production state.

## Extensions and functions

| Object | Purpose |
| --- | --- |
| `pgcrypto` | Supplies `gen_random_uuid()` defaults. |
| `public.handle_row_updated_at()` | Sets `updated_at` before transaction updates. |
| `public.handle_goal_write()` | Sets `updated_at` and keeps goal status/completion time consistent. |
| `public.handle_transaction_write()` | Advances transaction revision and maintains update/deletion timestamps. |
| `public.mutate_transaction(...)` | Authenticated, idempotent create/update/soft-delete boundary with optimistic revision checks. |

The transaction mutation function is `SECURITY DEFINER`, pins an empty
`search_path`, checks `auth.uid()` explicitly, and is executable only by the
authenticated role. Goal helper hardening remains a later migration task.

## `public.transactions`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()`. |
| `user_id` | `uuid` | Required FK to `auth.users(id)`, cascade on user deletion. |
| `type` | `text` | `Expenditure` or `Revenue`. |
| `amount` | `numeric(12,2)` | Required and greater than zero. |
| `note` | `text` | Required, defaults to an empty string. |
| `category_id` | `text` | Required non-blank identifier; no category FK yet. |
| `transaction_date` | `date` | Required local calendar date. |
| `idempotency_key` | `text` | Optional on migrated legacy rows; unique per user when present. |
| `lifecycle` | `text` | Required controlled lifecycle; defaults to `confirmed`. |
| `source` | `text` | Required controlled source; defaults to `mobile_app`. |
| `revision` | `bigint` | Positive optimistic-concurrency revision, advanced by trigger. |
| `deleted_at` | `timestamptz` | Required only when lifecycle is `deleted`. |
| `created_at` | `timestamptz` | Required UTC timestamp. |
| `updated_at` | `timestamptz` | Required UTC timestamp, maintained by trigger. |

Indexes:

- `(user_id, transaction_date desc)`
- `(user_id, type, transaction_date desc)`
- `(user_id, category_id, transaction_date desc)`
- partial `(user_id, transaction_date desc)` for non-deleted rows
- unique `(user_id, idempotency_key)`

RLS is enabled and all direct access remains owner-scoped with
`auth.uid() = user_id`. The Stage 2 client writes through
`public.mutate_transaction(...)`; owner-only legacy write policies remain for
an explicit installed-client compatibility window.

Known gaps: no workspace, account, explicit transaction currency, or general
audit trail beyond the mutation journal.

## `public.transaction_mutations`

Server-owned idempotency journal keyed by `(user_id, idempotency_key)`. It stores
the operation, canonical request payload, resulting transaction ID, and result
snapshot so an exact retried request returns the first committed result while a
key reused for different input becomes a conflict. RLS is enabled with no
direct client policies; only the guarded mutation function accesses it.

## `public.goals`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()`. |
| `user_id` | `uuid` | Required FK to `auth.users(id)`, cascade on user deletion. |
| `title` | `text` | Required non-blank title. |
| `goal_type` | `text` | `saving` or `item`; defaults to `saving`. |
| `target_amount` | `numeric(12,2)` | Required and greater than zero. |
| `saved_amount` | `numeric(12,2)` | Non-negative; defaults to zero. |
| `currency_code` | `text` | Exactly three characters; defaults to `USD`. |
| `target_date` | `date` | Optional. |
| `notes` | `text` | Optional. |
| `icon_name` | `text` | Required non-blank icon key. |
| `color` | `text` | Six-digit hexadecimal value. |
| `status` | `text` | `active` or `completed`. |
| `completed_at` | `timestamptz` | Must agree with status. |
| `created_at` | `timestamptz` | Required UTC timestamp. |
| `updated_at` | `timestamptz` | Required UTC timestamp, maintained by trigger. |

Indexes:

- `(user_id)`
- `(user_id, status, target_date)`
- `(user_id, created_at desc)`

RLS is enabled with the same four owner-only policies as transactions.

Known gaps: no workspace and no atomic contribution ledger; simultaneous
`saved_amount` updates can overwrite one another until a database function or
contribution table is introduced.

## Auth metadata in use

- `full_name`: set at sign-up and profile update.
- `currency`: legacy preference ID such as `usd`, not yet an ISO-backed profile
  column.
- `theme`: legacy preference still read for backward compatibility although
  Obsidian Thread is the fixed product theme.
- `app_lock_enabled` and `app_lock_pin`: legacy remote values are cleared on
  session restoration. New PINs are never sent to Supabase.

## Storage, Realtime, and Edge Functions

| Capability | Current state |
| --- | --- |
| Storage buckets | None declared. |
| Storage policies | None declared. |
| Edge Functions | None present. |
| Realtime publication/subscriptions | None configured in source. |
| Scheduled jobs | None present. |
| Webhooks | None present. |

## Client data paths

- Transactions: direct owner-scoped PostgREST reads, idempotent RPC writes,
  React Query cache, monthly AsyncStorage replica, and a versioned/user-scoped
  AsyncStorage pending-operation queue with retry and conflict metadata.
- Goals: direct PostgREST reads/writes and React Query cache; no offline queue.
- Authentication/profile: Supabase Auth SDK and user metadata.
- App Lock: Expo SecureStore on native devices only.
