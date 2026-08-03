# Finance Tracker

A mobile-first personal finance app built with Expo, React Native, and Supabase.

This project includes authenticated ledger flows, offline-first transaction
entry, savings goals, evidence-based analytics, and device security through a
secure PIN and optional biometrics.

## What the App Does

- Sign up, sign in, sign out, and reset passwords with Supabase Auth
- Capture `Revenue` and `Expenditure` transactions with category, note, amount, and date
- Browse, search, and filter transactions in list or calendar mode
- View monthly/yearly cashflow trends and category breakdowns
- Create and manage savings or item-based goals
- Queue transaction changes offline and sync them automatically when the device reconnects
- Confirm a region-suggested base currency at signup and change it later
  without relabelling historical transactions
- Protect the native app with a SecureStore-backed 4-digit PIN and optional
  biometrics

## Tech Stack

- `Expo 54`
- `React 19` + `React Native 0.81`
- `expo-router`
- `NativeWind` + Tailwind CSS
- `@supabase/supabase-js`
- `@tanstack/react-query`
- `Zustand`
- `AsyncStorage`
- `expo-local-authentication`
- `expo-secure-store`
- `expo-image-picker`

## App Structure

```text
src/
  app/                      Expo Router entrypoints and route wrappers
  screens/                  Screen-level UI
    auth/
    dashboard/
    goals/
    profile/
  components/
    auth/
    common/
    feedback/
    navigation/
    ui/
  context/                  Auth, workspace, offline, and app-lock providers
  contracts/                Canonical backend and current database contracts
  features/                 Feature-owned domain logic
  hooks/                    Shared hooks for auth, goals, transactions, network
  services/
    api/
    offline/
    supabase/
  store/                    Zustand app store
  theme/                    Tokens and global styles
  types/                    Domain and navigation types
  utils/                    Date, formatting, validation helpers
  assets/                   Fonts and icons
supabase/
  migrations/               Ordered baseline and forward schema changes
docs/backend/               Architecture, inventory, errors, and migrations
tests/backend/              Executable contract, SQL, error, and analytics tests
```

## Main Screens

- `Home`: create income and expense transactions
- `Ledger`: inspect, search, and filter all financial movement
- `Goals`: track savings targets and item purchase goals
- `Insights`: review real trends, comparisons, and category distribution
- `Profile`: manage identity, currency, privacy readiness, password, and app lock

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

If you do not use `pnpm`, `npm install` also works.

### 2. Create your environment file

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_ENV=local
EXPO_PUBLIC_UI_PREVIEW=0
```

Notes:

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are required at startup.
- `EXPO_PUBLIC_APP_ENV` must be `local`, `development`, `preview`, or
  `production`.
- The canonical client tables are `public.transactions` and `public.goals`.
- Never expose a service-role, Telegram, webhook, or AI secret through an
  `EXPO_PUBLIC_*` variable.

### UI preview mode

The redesigned frontend can run against local fixtures while backend stages are
still in progress. Copy `.env.preview.example` to `.env.local`, then start the
app normally. Preview mode uses a mock signed-in user and realistic monthly
transactions; it does not write to Supabase.

Do not enable `EXPO_PUBLIC_UI_PREVIEW` in a production build.

### 3. Set up Supabase

Apply the ordered SQL files in [supabase/migrations](supabase/migrations) to a
development Supabase project first. If the older manual baseline was already
applied, reconcile migration history before running the captured baseline; do
not blindly recreate production objects.

The current migrations create or update:

- `public.transactions`
- `public.goals`
- `public.currencies` and `public.country_currency_defaults`
- `public.profiles`
- `public.workspaces` and `public.workspace_members`
- `public.financial_accounts`
- update triggers for timestamps, goal completion state, and transaction revision
- workspace-scoped RLS policies
- an authenticated idempotent, workspace-aware transaction mutation RPC and
  server-only mutation journal
- an atomic personal-workspace currency update RPC

The Stage 3 app uses the mutation RPC. Owner-only legacy write policies remain
temporarily so an older installed build is not broken by the schema rollout;
remove them only after an explicit minimum-version cutover.

Read [the migration playbook](docs/backend/MIGRATION_PLAYBOOK.md) before
changing a deployed schema. The repository migrations are additive, but their
live application still requires schema-history reconciliation and two-user RLS
verification.

### 4. Add the password reset redirect

This app uses the Expo scheme `financetracker`, so password reset links should be allowed to return to:

```text
financetracker://update-password
```

Add that URL to your Supabase Auth redirect settings.

### 5. Start the app

```bash
pnpm start
```

Useful commands:

```bash
pnpm android
pnpm web
pnpm lint
pnpm test:backend
```

`pnpm ios` is available in `package.json`, but it requires macOS.

## Offline Behavior

Offline support currently focuses on transactions.

- New transactions can be created while offline
- Offline creates, updates, and deletes are serialized in a versioned,
  user-scoped queue
- Cached workspace and monthly transaction data are used when the network is unavailable
- Pending operations use stable idempotency keys, retry metadata, and
  exponential backoff
- Temporary IDs and dependent queued edits are remapped after server creation
- Pending operations sync after app restoration and reconnection
- The global banner and ledger show queued, syncing, failed, and conflict states

Goals are currently fetched and written directly through Supabase and do not use the offline queue.

## Data Notes

- Transaction dates are stored as local `YYYY-MM-DD` strings to avoid UTC date-shift bugs
- Every transaction stores its original currency plus the workspace reporting
  currency, conversion rate, and base amount captured at write time
- Changing the workspace currency does not rewrite historical transactions;
  mixed-base summaries include only records compatible with the selected base
- Goal completion timestamps are managed by the database trigger
- Some profile preferences are still hydrated from Supabase Auth user metadata
- Database/provider errors are normalized and are never returned as an empty
  transaction list

## Build Profiles

The repo includes EAS build profiles in [eas.json](eas.json):

- `development`
- `preview`
- `production`

## Current Quality Bar

- TypeScript is enabled across the app and Supabase uses a current-schema type
  contract
- ESLint is configured through Expo
- React Query handles remote caching and mutation invalidation
- The zero-dependency Node test suite covers canonical contracts, safe errors,
  SQL/RLS/idempotency invariants, offline queue compaction, retry behavior, and
  transaction analytics

## Implementation Plans

- `PLAN_FRONTEND.md` defines the complete frontend stages, reachable states,
  adapter boundaries, and backend dependencies.
- `PLAN_BACKEND.md` defines the matching Supabase/Postgres, Edge Function,
  Telegram, receipt, parser, realtime, and security stages.
- `IMPLEMENTATION_STATUS.md` records the latest pushed checkpoint and exact next
  batch.
- `docs/backend/ARCHITECTURE.md` and `docs/backend/DATABASE_INVENTORY.md` define
  the implemented backend baseline.
