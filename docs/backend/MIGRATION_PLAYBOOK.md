# Migration and Rollback Playbook

## Current state

Timestamped migrations now live under `supabase/migrations/`. The baseline
captures the previously manual transaction/goal schema; the following
migrations add transaction reliability and the workspace/account/currency
foundation without dropping existing IDs or rows. This
workspace is not linked to a Supabase project and has no local Supabase CLI or
Postgres runtime, so repository checks are static; apply and integration-test
the migrations in development before production.

## Migration rules

1. Inspect production schema history before assigning a migration as applied.
2. Make financial schema changes additive: add nullable/defaulted columns,
   deploy compatible code, backfill in bounded batches, validate constraints,
   and only remove legacy fields in a later release.
3. Preserve the existing `transactions` and `goals` IDs and rows.
4. Add every foreign key with an explicit delete rule and every query-path
   index with tenant/owner scope first.
5. Enable and test RLS before exposing a new table to the client.
6. Never combine a large backfill, destructive DDL, and application cutover in
   one transaction.
7. Record expected duration, lock risk, verification query, and recovery action
   in the migration header.
8. Run migrations from scratch and against a copy of the prior schema before a
   production push.

## Standard migration header

Every new SQL migration begins with comments covering:

- purpose and owning backend stage
- prerequisites
- backward-compatible app versions
- expected locks and duration
- verification queries
- rollback or forward-recovery procedure

## Rollback strategy

PostgreSQL schema rollback is not assumed to be a blind down migration.

- Before app cutover, a failed additive migration can be transactionally rolled
  back when it contains no concurrent index or long backfill.
- After app cutover, prefer a forward repair that restores compatibility and
  preserves new financial data.
- New columns remain readable by old clients until the compatibility window is
  closed.
- New tables can be detached from clients by policy or feature flag before
  removal.
- Destructive cleanup happens only after backups, validation, and an explicit
  release checkpoint.

## Stage 2 baseline sequence

1. Apply `20260803000100_current_schema_baseline.sql` only after reconciling it
   with the development project's migration history.
2. Apply `20260803000200_transaction_reliability.sql` and verify that existing
   row counts and IDs are unchanged.
3. Deploy the Stage 2 client, which reads the additive fields and writes through
   `mutate_transaction`.
4. Verify create, replay with the same key, offline reconciliation, update,
   revision conflict, and soft delete with two authenticated users.
5. Promote the same ordered migrations and client build through preview before
   production.

## Stage 3 workspace/currency sequence

1. Apply `20260803000300_workspace_currency_foundation.sql` only after the
   Stage 2 reliability migration is verified.
2. Confirm every existing Auth user received one profile, one personal
   workspace, one owner membership, and one active default Cash account.
3. Confirm every existing transaction and goal received a valid workspace;
   every transaction must also receive an account, original/base currency,
   rate `1`, and unchanged base amount.
4. Test signup with detected, manually overridden, and system-default currency
   metadata. Test a later manual currency change and verify historical
   transaction currency/base fields remain byte-for-byte unchanged.
5. Test reads and every allowed write with two users and verify workspace RLS
   isolation before deploying the Stage 3 client.
6. Promote the ordered migrations and app build together through preview, then
   retain the older-client compatibility policies until the minimum-version
   cutover is measured and approved.

## Verification checklist

- [ ] Migration applies to an empty local Postgres database.
- [ ] Migration applies to the previous schema with representative data.
- [ ] Row counts and primary keys are unchanged unless explicitly expected.
- [ ] Two-user RLS isolation tests pass for every operation.
- [ ] Duplicate idempotency-key tests return one financial record.
- [x] App TypeScript, backend tests, lint, and production export pass.
- [ ] Recovery query or forward-fix SQL is reviewed before deployment.
- [ ] Commit and remote tree are verified before beginning the next stage.
