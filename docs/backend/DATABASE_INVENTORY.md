# Database Inventory

## Inventory boundary

The repository contains one manually applied SQL file,
`supabase/001_create_goals.sql`. There is not yet a standard Supabase
`migrations/` directory, Storage bucket declaration, Edge Function, seed file,
or generated database type file from a linked project. This inventory therefore
describes the schema declared in source control, not unverified production
state.

## Extensions and functions

| Object | Purpose |
| --- | --- |
| `pgcrypto` | Supplies `gen_random_uuid()` defaults. |
| `public.handle_row_updated_at()` | Sets `updated_at` before transaction updates. |
| `public.handle_goal_write()` | Sets `updated_at` and keeps goal status/completion time consistent. |

Both functions currently run as invoker-context PL/pgSQL functions. A later
security migration must pin a safe `search_path` before any function receives
elevated privileges.

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
| `created_at` | `timestamptz` | Required UTC timestamp. |
| `updated_at` | `timestamptz` | Required UTC timestamp, maintained by trigger. |

Indexes:

- `(user_id, transaction_date desc)`
- `(user_id, type, transaction_date desc)`
- `(user_id, category_id, transaction_date desc)`

RLS is enabled. Separate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies all
require `auth.uid() = user_id`; update and insert also enforce the owner in
`WITH CHECK`.

Known gaps: no idempotency key, workspace, account, currency, lifecycle, source,
soft-delete timestamp, revision, or audit trail.

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

- Transactions: direct PostgREST reads/writes, React Query cache, monthly
  AsyncStorage replica, and an AsyncStorage pending-operation queue.
- Goals: direct PostgREST reads/writes and React Query cache; no offline queue.
- Authentication/profile: Supabase Auth SDK and user metadata.
- App Lock: Expo SecureStore on native devices only.
