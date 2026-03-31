# Finance Tracker

A mobile-first personal finance app built with Expo, React Native, and Supabase.

This project includes authenticated budgeting flows, offline-first transaction entry, savings goals, monthly analytics, and profile-level security features like PIN and biometric app lock.

## What the App Does

- Sign up, sign in, sign out, and reset passwords with Supabase Auth
- Capture `Revenue` and `Expenditure` transactions with category, note, amount, and date
- Browse transactions by day and month in the calendar view
- View monthly summaries and category breakdowns on the stats screen
- Create and manage savings or item-based goals
- Queue transaction changes offline and sync them automatically when the device reconnects
- Customize theme and currency locally from the profile screen
- Protect the app with a 4-digit PIN and optional biometrics

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
```

## Main Screens

- `Home`: create income and expense transactions
- `Calendar`: inspect day-by-day activity and monthly totals
- `Goals`: track savings targets and item purchase goals
- `Stats`: review revenue, expenditure, and category distribution
- `Profile`: manage name, theme, currency, password, and app lock

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

# Optional table overrides
EXPO_PUBLIC_TRANSACTIONS_TABLE=transactions
EXPO_PUBLIC_GOALS_TABLE=goals
```

Notes:

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are required at startup
- `EXPO_PUBLIC_TRANSACTIONS_TABLE` and `EXPO_PUBLIC_GOALS_TABLE` can be either `table_name` or `public.table_name`

### 3. Set up Supabase

Run the SQL in [supabase/001_create_goals.sql](supabase/001_create_goals.sql) inside the Supabase SQL Editor.

That migration creates:

- `public.transactions`
- `public.goals`
- update triggers for timestamps and goal completion state
- row-level security policies scoped to the authenticated user

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
- Some account and preference fields are hydrated from Supabase Auth user metadata

## Build Profiles

The repo includes EAS build profiles in [eas.json](eas.json):

- `development`
- `preview`
- `production`

## Current Quality Bar

- TypeScript is enabled across the app
- ESLint is configured through Expo
- React Query handles remote caching and mutation invalidation

There is no automated test suite configured in this repo yet, so `pnpm lint` is the main built-in verification step today.
