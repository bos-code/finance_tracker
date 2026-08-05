# Backend Stage 5 checkpoint

## Status

Backend Stage 5 is implemented on `backend-stage-5-parser` and remains isolated from `master` in draft pull request #14.

The implementation is complete in code and preview mode. Live database execution remains intentionally blocked until secure Supabase project access is available.

## Delivered

### Deterministic parsing

- Nigerian compact amounts: `5k`, `2.5k`, `350k`, `1m`
- income and expenditure classification
- explicit and default currency detection
- relative, ISO, and day-month-year dates
- semantic category matching
- merchant and description extraction
- field-level confidence and parser reasons
- review-first output whenever a required field is missing or below the confidence threshold

### Persisted review drafts

- workspace- and owner-scoped `transaction_drafts`
- duplicate source-message protection
- 30-day expiry
- parser version and overall confidence
- correction and pending-confirmation states
- immutable confirmed history linked to the resulting transaction
- owner/workspace RLS and unconfirmed-only deletion

### Client workflow

- natural-language capture screen
- review queue with confidence and missing-field indicators
- editable amount, type, currency, date, category, merchant, and description
- separate ready-to-save queue
- online-only permanent finalization
- stable per-draft idempotency keys
- manual exchange-rate requirement for cross-currency transactions
- preview fixtures and React Query hooks

### Reliability and safety

- no draft automatically enters the ledger
- incomplete, expired, cross-owner, or cross-workspace drafts cannot finalize
- confirmed drafts cannot be edited or deleted
- retrying a transaction write cannot create a duplicate ledger entry
- retrying after a lost confirmation response resolves the already-linked draft
- private credentials and service-role values are not committed

## Migration order

Apply in this exact order:

1. `20260803000100_current_schema_baseline.sql`
2. `20260803000200_transaction_reliability.sql`
3. `20260803000300_workspace_currency_foundation.sql`
4. `20260803000400_secure_receipt_storage.sql`
5. `20260805000500_transaction_review_drafts.sql`

Deploy `receipt-orphan-cleanup` only after Stage 4 has been verified.

## Live verification matrix

Do not merge Stage 5 into `master` until all checks below pass against a development Supabase project.

### Connection and schema

- Auth health endpoint responds
- PostgREST health endpoint responds
- all five migrations appear in migration history
- expected tables, RPCs, indexes, triggers, policies, and private receipt bucket exist

### Two-user isolation

Using User A and User B in separate sessions:

- User A cannot read or mutate User B workspaces, accounts, transactions, receipts, or drafts
- User B cannot discover User A draft IDs through list or direct lookup
- a draft cannot link to another owner's transaction
- a draft cannot link to a transaction from another workspace

### Draft lifecycle

- duplicate provider message returns the original draft
- incomplete parse remains `needs_review`
- corrected complete parse becomes `pending_confirmation`
- expired draft cannot become ready or confirmed
- only `pending_confirmation` can become `confirmed`
- confirmed draft requires a live, non-deleted transaction owned by the same user and workspace
- confirmed history rejects further updates and deletion

### Transaction reliability

- repeated finalization with the same draft ID creates one transaction
- lost-response retry returns the same transaction and confirmed draft
- revision conflict is surfaced without overwriting newer data
- reconnect replay preserves order and reconciles temporary transaction IDs

### Currency

- same-currency draft stores exchange rate `1`
- cross-currency draft requires an explicit positive manual rate
- base amount is derived from the supplied rate
- historical base currency and base amount do not change after workspace currency changes

### Receipts

- bucket remains private
- signed URLs expire
- User A cannot view User B receipt objects or metadata
- duplicate hash on the same transaction is rejected
- deletion removes Storage before metadata
- stale orphan cleanup does not touch completed uploads

## Merge gate

The pull request may move from draft to review only when:

- TypeScript passes
- lint has no errors
- backend tests pass
- preview and normal web exports pass
- all live verification checks above pass on development Supabase
- migration rollback/forward-repair notes have been recorded

Production migration must remain a separate authorized release action.
