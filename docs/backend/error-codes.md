# Error Code Catalogue

Source of truth: [`src/types/contracts/errors.ts`](../../src/types/contracts/errors.ts).
This document is the human-readable index; keep both in sync when adding a code.

Every backend failure — Supabase/PostgREST errors, Edge Function errors,
parser failures, AI fallback failures, Telegram webhook errors — must be
translated into one of these codes before it reaches a client. Per
PLAN_BACKEND.md's UX requirements: **no database failure may be presented
as "no transactions," and no raw backend error message may reach the
user.** `ERROR_CODE_MESSAGE` in `errors.ts` is the only approved source of
user-facing copy for backend failures.

| Code | Category | HTTP status | User-facing message |
|---|---|---|---|
| `validation_failed` | validation | 400 | Some of this information doesn't look right. Please check and try again. |
| `missing_field` | validation | 400 | Please fill in the missing information. |
| `invalid_field` | validation | 400 | One of the fields entered isn't valid. |
| `unsupported_file_type` | validation | 400 | That file type isn't supported. Try a PDF, JPEG, PNG, or WebP. |
| `file_too_large` | validation | 413 | That file is too large to upload. |
| `unauthenticated` | authentication | 401 | Please sign in to continue. |
| `session_expired` | authentication | 401 | Your session has expired. Please sign in again. |
| `invalid_credentials` | authentication | 401 | That email and password combination doesn't match our records. |
| `forbidden` | permission | 403 | You don't have permission to do that. |
| `not_owner` | permission | 403 | This item doesn't belong to your account. |
| `workspace_access_denied` | permission | 403 | You don't have access to this workspace. |
| `conflict` | conflict | 409 | This was already updated elsewhere. Please refresh and try again. |
| `already_exists` | conflict | 409 | This already exists. |
| `duplicate_request` | conflict | 409 | This was already submitted. |
| `stale_update` | conflict | 409 | This record changed since you last loaded it. |
| `rate_limited` | rate_limit | 429 | You're doing that a bit too fast. Please wait a moment and try again. |
| `quota_exceeded` | rate_limit | 429 | You've reached today's limit for this action. |
| `ai_limit_reached` | rate_limit | 429 | Smart parsing is temporarily unavailable, but you can still enter this manually. |
| `not_found` | not_found | 404 | We couldn't find that. |
| `server_error` | server | 500 | Something went wrong on our end. Please try again. |
| `upstream_unavailable` | server | 502 | A service we depend on is temporarily unavailable. Please try again shortly. |
| `timeout` | server | 504 | That took too long to respond. Please try again. |
| `offline` | offline | — (client-only) | You're offline. This will be saved and synced automatically once you're back online. |
| `sync_failed` | offline | — (client-only) | This couldn't sync yet. It's safe on your device and will retry automatically. |

## Mapping current Supabase/PostgREST errors

The transaction and goal services already special-case one PostgREST
condition (`isMissingTransactionsTableError` / `isMissingGoalsTableError`,
matching Postgres code `42P01` and PostgREST code `PGRST205`) to gracefully
degrade instead of surfacing a raw error. That pattern — detect a known
raw error shape, then produce a catalogued `AppError` — is the model for
all future error mapping:

| Raw signal | Maps to |
|---|---|
| PostgREST/Postgres `42501` (RLS denial) | `forbidden` |
| PostgREST `23505` (unique violation) | `already_exists` |
| Supabase Auth `invalid_grant` / bad password | `invalid_credentials` |
| Supabase Auth expired JWT | `session_expired` |
| `fetch` throws / `TypeError: Network request failed` | `offline` (client-side) or `upstream_unavailable` (server-side) |
| Gemini Flash-Lite timeout or 5xx (Stage 6) | `upstream_unavailable`, then fall back to deterministic parsing |
| Per-user/project AI budget exceeded (Stage 6) | `ai_limit_reached` |

This mapping table will grow as later stages introduce new failure modes
(Telegram webhook signature failures, storage upload failures, etc.) — add
rows here and codes to `errors.ts` together rather than inventing ad hoc
error strings at the call site.
