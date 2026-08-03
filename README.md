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
- Choose the display currency from the profile control center
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
  context/                  Auth, offline, and app-lock providers
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
  001_create_goals.sql      Transactions + goals schema, triggers, and RLS
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

Run the SQL in [supabase/001_create_goals.sql](supabase/001_create_goals.sql) inside the Supabase SQL Editor.

That migration creates:

- `public.transactions`
- `public.goals`
- update triggers for timestamps and goal completion state
- row-level security policies scoped to the authenticated user

The current SQL file predates a standard Supabase migration directory. Read
[the migration playbook](docs/backend/MIGRATION_PLAYBOOK.md) before changing a
deployed schema; Backend Stage 2 will establish timestamped migrations without
dropping current rows.

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
- Offline updates and deletes are queued locally
- Cached monthly transaction data is used when the network is unavailable
- Pending operations sync automatically after the device reconnects
- The global banner shows offline, syncing, and recently-synced states

Goals are currently fetched and written directly through Supabase and do not use the offline queue.

## Data Notes

- Transaction dates are stored as local `YYYY-MM-DD` strings to avoid UTC date-shift bugs
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
  current SQL/RLS invariants, and transaction analytics

## Implementation Plans

- `PLAN_FRONTEND.md` defines the complete frontend stages, reachable states,
  adapter boundaries, and backend dependencies.
- `PLAN_BACKEND.md` defines the matching Supabase/Postgres, Edge Function,
  Telegram, receipt, parser, realtime, and security stages.
- `IMPLEMENTATION_STATUS.md` records the latest pushed checkpoint and exact next
  batch.
- `docs/backend/ARCHITECTURE.md` and `docs/backend/DATABASE_INVENTORY.md` define
  the implemented backend baseline.
