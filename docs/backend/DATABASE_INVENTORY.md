# Database Inventory

## Inventory boundary

The repository contains an ordered baseline plus additive Stage 2 and Stage 3
migrations under `supabase/migrations/`. The older
`supabase/001_create_goals.sql` remains historical and is not the authoritative
installation path. There is no linked-project schema dump or local PostgreSQL
runtime in this workspace, so this inventory describes source-controlled
schema rather than claiming unverified production state.

## Extensions and functions

| Object | Purpose |
| --- | --- |
| `pgcrypto` | Supplies `gen_random_uuid()` defaults. |
| `handle_row_updated_at()` | Maintains generic `updated_at` fields. |
| `handle_goal_write()` | Maintains goal update/completion timestamps. |
| `handle_transaction_write()` | Advances transaction revision and maintains update/deletion timestamps. |
| `is_workspace_member(uuid)` | RLS-safe authenticated membership check. |
| `is_workspace_owner(uuid)` | RLS-safe authenticated ownership check. |
| `bootstrap_finance_user(uuid,jsonb,boolean)` | Idempotently provisions profile, personal workspace, owner membership, and default Cash account. |
| `handle_new_finance_user()` | Runs provisioning after an `auth.users` insert. |
| `handle_finance_user_metadata_update()` | Keeps the durable profile name aligned with later Auth metadata updates. |
| `handle_transaction_scope()` | Resolves legacy scope, validates account/workspace identity, and calculates base amounts. |
| `mutate_transaction(...)` | Authenticated, idempotent create/update/soft-delete RPC with revision, scope, and currency controls. |
| `set_personal_workspace_currency(uuid,text)` | Atomically changes the current base and default-account currency without changing history. |

Security-definer functions pin an empty `search_path`, check `auth.uid()` where
they are client-callable, and revoke default public execution. Only the two
intended client RPCs and RLS membership helpers are granted to `authenticated`.

## Workspace foundation

| Table | Key fields and invariants |
| --- | --- |
| `currencies` | ISO-style three-letter primary key, unique numeric code, name, symbol, and minor unit. Seeded for EUR, GBP, JPY, KRW, NGN, USD, and VND. |
| `country_currency_defaults` | Two-letter country primary key and FK to `currencies`; includes current 2026 Bulgaria/EUR and official euro-microstate mappings. |
| `profiles` | One row per Auth user with name and stable signup country, locale, and timezone context. |
| `workspaces` | Owner, name, `personal`/`business` type, default currency, and detection source. A partial unique index permits one personal workspace per owner. |
| `workspace_members` | Composite workspace/user primary key and `owner`/`member` role. |
| `financial_accounts` | Workspace/owner, account type, currency, opening balance, default/archive state. Composite uniqueness supports scoped transaction FKs; a partial unique index permits one active default per workspace. |

All six tables use RLS. Currency references are readable; user and finance data
are visible only through self or workspace membership. Account mutations are
restricted to workspace owners.

## `public.transactions`

| Column group | Rules |
| --- | --- |
| Identity | UUID primary key; required `user_id`, `workspace_id`, and `account_id`. The workspace/account pair is enforced by a composite FK. |
| Original value | Positive `amount`, ISO-backed `currency_code`, type, non-blank category ID, note, and local calendar date. |
| Reporting value | ISO-backed `base_currency_code`, positive `exchange_rate`, and positive `base_amount`, calculated as rounded amount × rate. |
| Reliability | Optional legacy-compatible idempotency key, controlled lifecycle/source, positive revision, deletion timestamp, and UTC timestamps. |

New rows must capture the workspace's current reporting currency. A later
manual workspace-currency change does not modify existing base currency,
exchange rate, or base amount. Active transaction indexes cover workspace/date
and account/date; the prior owner indexes remain available during migration.

RLS reads by workspace membership and requires the authenticated row owner plus
membership for direct compatibility writes. The Stage 3 client writes through
`mutate_transaction(...)`; legacy policies remain temporarily for installed
Stage 1/2 clients.

## `public.transaction_mutations`

Server-owned idempotency journal keyed by `(user_id, idempotency_key)`. It
stores the operation, canonical request payload, resulting transaction ID, and
result snapshot. An exact retry replays the first committed result; reuse of a
key with different input is a conflict. RLS is enabled with no direct client
policies.

## `public.goals`

Goals retain their original owner, type, positive target amount, non-negative
saved amount, explicit three-letter currency, dates, notes, icon, signal color,
status, and completion invariants. Stage 3 adds a required workspace FK and a
workspace/status/target-date index. Reads use workspace membership; writes
require the authenticated row owner and membership.

Known gap: goal contributions are not yet an append-only ledger, so concurrent
`saved_amount` updates can still overwrite one another. Built-in transaction
category IDs also remain app-defined until the shared parser/category stage.

## Auth metadata in use

- `full_name`, `country_code`, `locale`, and `timezone`: captured at signup and
  copied into the durable profile boundary.
- `currency_code` and `currency_detection_source`: used only to provision the
  initial workspace base; later changes use the workspace RPC.
- `currency`: older display preference retained as a compatibility mirror.
- `theme`: legacy preference read for compatibility; Obsidian Thread is fixed.
- `app_lock_enabled` and `app_lock_pin`: legacy remote values are cleared.
  Current device PINs live only in native SecureStore.

## Storage, Realtime, and Edge Functions

| Capability | Current state |
| --- | --- |
| Storage buckets and policies | None declared; private receipts are Stage 4. |
| Edge Functions | None present. |
| Realtime publication/subscriptions | None configured in source. |
| Scheduled jobs and webhooks | None present. |

## Client data paths

- Workspace: Supabase workspace/profile/account read, React context, and a
  versioned user-scoped AsyncStorage replica.
- Transactions: workspace-scoped PostgREST reads, RPC writes, React Query,
  user/workspace/month cache, and a durable user-scoped pending-operation queue.
- Goals: workspace-scoped direct PostgREST reads/writes and React Query; no
  offline mutation queue yet.
- Authentication: Supabase Auth SDK plus durable profile/workspace bootstrap.
- App Lock: Expo SecureStore on native devices only.
