# Migration & Rollback Strategy

## Current state

The only schema change applied so far is
[`supabase/001_create_goals.sql`](../../supabase/001_create_goals.sql), run by hand
in the Supabase SQL Editor (per README instructions). There is no Supabase
CLI project (`supabase/config.toml`), so there is no CLI-tracked migration
history and no automated way to reproduce the schema on a fresh project
today. `supabase/001_create_goals.sql` stays exactly where it is — it is
the historical baseline and should be treated as already applied and
read-only.

## Going forward

All schema changes from Stage 2 onward are new files in
[`supabase/migrations/`](../../supabase/migrations/), one file per logical
change, using the Supabase CLI naming convention:

```
supabase/migrations/<YYYYMMDDHHMMSS>_<short_description>.sql
```

Example: `supabase/migrations/20260815120000_add_transaction_currency_fields.sql`.

Adopting the Supabase CLI itself (`supabase link`, `supabase db push`,
`supabase migration new`) is an action item, not yet done — see
[Action items](#action-items). Until then, migration files in this folder are
applied the same way `001_create_goals.sql` was: reviewed, then run by hand
in the Supabase SQL Editor for each environment, in filename order.

### Rules for every migration file

1. **One concern per file.** Don't bundle an unrelated table change into a
   currency migration.
2. **Idempotent DDL.** Use `create table if not exists`, `create index if
   not exists`, `drop policy if exists` + `create policy`, matching the
   style already established in `001_create_goals.sql`. A migration that
   fails partway and is re-run must not error out on objects it already
   created.
3. **RLS is not optional.** Any new table holding user or workspace data
   must enable RLS and add scoped policies in the same migration that
   creates the table — never ship a table with data in it before RLS
   exists.
4. **Backfill in the same migration, in batches if the table is large.**
   New NOT NULL columns on `transactions` (e.g. Stage 3's currency fields)
   must ship with a default and a backfill statement so existing rows
   never fail the constraint.
5. **Write the rollback alongside the forward migration**, as a comment
   block at the bottom of the same file or a sibling
   `<timestamp>_<description>_rollback.sql`. A rollback for an additive
   change (new nullable column, new table) is usually just `drop column`
   / `drop table`; write it anyway so it's ready if the migration needs
   to be reverted under pressure.
6. **Never edit a migration file that has been applied anywhere.** If a
   mistake is found, write a new migration that corrects it.
7. **Test against a non-production project first.** See
   [Environments](#environments) below.

### Backward compatibility requirement

Per PLAN_BACKEND.md's core priorities, existing users and transactions must
keep working during and after every migration. Concretely:

- New columns on `transactions`/`goals` must be nullable or have a safe
  default — never a bare `NOT NULL` with no default against a table that
  already has rows.
- Renames are two migrations, not one: add the new column/table, backfill
  and dual-write from the app for one release, then drop the old one in a
  later migration once nothing reads it.
- RLS policy changes must be tested to confirm existing users can still
  read/write their own rows before the migration is applied anywhere real.

## Environments

Four environments are defined in [`src/config/env.ts`](../../src/config/env.ts)
and `eas.json`: `local`, `development`, `preview`, `production`. Today they
all point at the same single Supabase project, because that's the only one
that exists. That is acceptable for pre-release solo development but is a
real risk once Stage 2 onward starts writing migrations that touch
production-shaped data.

**Action item:** create at least one additional Supabase project (e.g.
`finance-tracker-dev`) before Stage 3 starts altering the schema
non-trivially, and:

- Point `local`/`development`/`preview` env vars at the non-production
  project.
- Apply every migration there first, verify the app still works end to
  end, then apply to production.
- Set `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_KEY` per environment
  via EAS's environment variables (`eas env:create --environment
  development ...`), never hardcoded into `eas.json` — those two values
  are not secret-sensitive (anon key is public by design) but keeping them
  environment-scoped prevents a preview build from accidentally writing to
  production data.

## Rollback strategy

- **Schema rollback**: run the paired rollback statements for every
  migration applied after the last known-good point, in reverse
  filename order.
- **Data rollback**: this project has no automated backups configured yet
  (Stage 10 adds backup/restore documentation). Until then, rely on
  Supabase's built-in point-in-time recovery / daily backups (plan-
  dependent) as the last resort — do not treat manual `DELETE`/`UPDATE` in
  the SQL Editor as a rollback mechanism for real user data.
- **App rollback**: because migrations must be backward compatible (see
  above), rolling back the app to a previous build should never require
  rolling back the schema. If it does, the migration violated rule 4/backward
  compatibility and that's a bug in the migration, not a reason to skip
  writing rollback SQL.

## Action items

- [ ] Adopt the Supabase CLI (`supabase init`, `supabase link`) so
  migrations can be applied with `supabase db push` instead of by hand.
- [ ] Provision a non-production Supabase project and wire it to
  `local`/`development`/`preview` environments.
- [ ] Decide on a backup/restore policy (deferred to Stage 10, but worth
  scoping early since it affects how aggressive early migrations can be).
