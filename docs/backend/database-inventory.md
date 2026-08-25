# Database Inventory

Snapshot of everything that exists in the Supabase project today, as defined by
[`supabase/001_create_goals.sql`](../../supabase/001_create_goals.sql) — the only
migration file in the repository. This file is applied manually through the
Supabase SQL Editor (see README) rather than through the Supabase CLI; there is
no CLI-tracked migration history yet. See [migration-checklist.md](migration-checklist.md)
for how that changes going forward.

Last audited: 2026-07-31 (Stage 1).

## Extensions

| Extension | Purpose |
|---|---|
| `pgcrypto` | `gen_random_uuid()` for primary keys |

## Tables

### `public.transactions`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `type` | `text` | NOT NULL, CHECK IN (`'Expenditure'`, `'Revenue'`) |
| `amount` | `numeric(12,2)` | NOT NULL, CHECK `amount > 0` |
| `note` | `text` | NOT NULL, default `''` |
| `category_id` | `text` | NOT NULL, CHECK non-empty after trim — **free text, not a FK** to any category table |
| `transaction_date` | `date` | NOT NULL — local calendar date, deliberately not a timestamp (see comment in migration) |
| `created_at` | `timestamptz` | NOT NULL, default `timezone('utc', now())` |
| `updated_at` | `timestamptz` | NOT NULL, default `timezone('utc', now())`, maintained by `handle_row_updated_at()` trigger |

Not present: `status`/lifecycle column, `source` column, `workspace_id`, `account_id`,
`currency_code`/`base_amount`/`exchange_rate`, soft-delete column. Every row is
implicitly `confirmed` and sourced from `mobile_app`. Deletes are hard deletes.

**Indexes**
- `transactions_user_date_idx` on `(user_id, transaction_date desc)`
- `transactions_user_type_date_idx` on `(user_id, type, transaction_date desc)`
- `transactions_user_category_date_idx` on `(user_id, category_id, transaction_date desc)`

**Trigger**: `transactions_set_updated_at` (before update) → `handle_row_updated_at()`

**RLS**: enabled. Four policies, all `auth.uid() = user_id` (select/insert/update/delete). No workspace or sharing model — access is strictly per-owner.

### `public.goals`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `title` | `text` | NOT NULL, non-empty after trim |
| `goal_type` | `text` | NOT NULL, default `'saving'`, CHECK IN (`'saving'`, `'item'`) |
| `target_amount` | `numeric(12,2)` | NOT NULL, CHECK `> 0` |
| `saved_amount` | `numeric(12,2)` | NOT NULL, default `0`, CHECK `>= 0` |
| `currency_code` | `text` | NOT NULL, default `'USD'`, CHECK `length(trim()) = 3` — only column in the whole schema that already stores an ISO-4217-shaped code |
| `target_date` | `date` | nullable |
| `notes` | `text` | nullable |
| `icon_name` | `text` | NOT NULL, default `'target'`, non-empty |
| `color` | `text` | NOT NULL, default `'#2563eb'`, CHECK matches `^#[0-9A-Fa-f]{6}$` |
| `status` | `text` | NOT NULL, default `'active'`, CHECK IN (`'active'`, `'completed'`) |
| `completed_at` | `timestamptz` | nullable, CHECK consistency with `status` via `goals_completion_state_check` |
| `created_at` | `timestamptz` | NOT NULL, default `timezone('utc', now())` |
| `updated_at` | `timestamptz` | NOT NULL, default `timezone('utc', now())` |

**Indexes**
- `goals_user_id_idx` on `(user_id)`
- `goals_user_status_target_date_idx` on `(user_id, status, target_date)`
- `goals_user_created_at_idx` on `(user_id, created_at desc)`

**Trigger**: `goals_handle_write` (before insert/update) → `handle_goal_write()` — stamps `updated_at`, and auto-manages `completed_at` based on `status` transitions.

**RLS**: enabled. Four policies, all `auth.uid() = user_id`.

## Functions

| Function | Used by |
|---|---|
| `public.handle_row_updated_at()` | `transactions_set_updated_at` trigger |
| `public.handle_goal_write()` | `goals_handle_write` trigger |

## Storage buckets

None. No `supabase.storage` bucket is created anywhere in the repo. Stage 4 introduces the first one (private receipts).

## Edge Functions

None. No `supabase/functions/` directory exists. Stage 6 (Gemini) and Stage 7 (Telegram webhook) introduce the first ones.

## Auth

Supabase Auth (email/password) only. No `profiles` table — the following fields live in `auth.users.user_metadata` instead, written via `supabaseClient.auth.updateUser({ data: ... })`:

| Metadata key | Set by | Consumed by |
|---|---|---|
| `full_name` | sign-up, profile name update | `auth-context.tsx` |
| `theme` | profile screen | `use-app-store.ts` hydration |
| `currency` | profile screen | `use-app-store.ts` hydration (local preset only — not linked to `goals.currency_code` or any transaction field) |
| `app_lock_enabled`, `app_lock_pin` | legacy, no longer written | actively scrubbed on every login by `supabaseClearLegacyAppLockSettings()` — app lock is now 100% local (Zustand + AsyncStorage), never synced |

## Known gaps versus the Stage 1–10 plan

These are absences, not defects — each is scoped to a later stage and listed here so no later stage assumes something exists that doesn't:

- No `profiles`, `workspaces`, `workspace_members`, `financial_accounts` (Stage 3).
- No currency fields on `transactions`; `goals.currency_code` is set but never surfaced or reconciled against a real currency picker tied to a workspace (Stage 3).
- No `transaction_attachments` table or storage bucket (Stage 4).
- No `transaction_drafts` table or parser (Stage 5).
- No AI usage tracking table (Stage 6).
- No `channel_connections` or link-code tables (Stage 7).
- No audit log table of any kind (Stage 10).
- No idempotency-key column or table on any mutation path (Stage 2).
