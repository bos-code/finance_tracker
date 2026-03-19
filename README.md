# Finance Tracker (Expo + NativeWind)

Production-focused React Native financial app scaffold with:

- Expo Router with nested Stack + Tabs + Modal
- NativeWind `4.2.2` with Tailwind + Babel + Metro setup
- Feature-based `src/` architecture
- Typed domain models (transactions, accounts, analytics)
- Data-driven bottom tabs and modular icon system
- Reusable, typed financial table with sorting + pagination

## Scalable Project Architecture

```text
src/
  app/                      # Expo Router route files (thin wrappers only)
  screens/                  # Screen-level UI and page orchestration
    auth/
    dashboard/
    profile/
  components/               # Reusable UI blocks
    common/                 # Primitive app components (button, input)
    feedback/               # Loading, error, empty states
    navigation/             # Legacy navigation components (optional)
    ui/                     # Base layout primitives
  navigation/               # Navigation config, route constants, navigators
  services/                 # External integrations and data access
    api/                    # HTTP client + API modules
    firebase/               # Firebase client + auth service
  hooks/                    # Shared composable hooks
  context/                  # Cross-cutting providers (auth/session)
  state/                    # App-level reducer/store providers
  utils/                    # Pure helper functions (validation, formatting)
  assets/                   # Images, icons, fonts
  theme/                    # Global styles and design tokens
```

## Example Files By Layer

- `screens`: `src/screens/auth/auth-screen.tsx`, `src/screens/dashboard/home-screen.tsx`
- `reusable components`: `src/components/common/app-button.tsx`, `src/components/common/app-input.tsx`
- `navigation`: `src/navigation/bottom-tabs-navigator.tsx`, `src/navigation/route-names.ts`
- `services`: `src/services/api/http-client.ts`, `src/services/firebase/auth-service.ts`
- `hooks`: `src/hooks/use-auth.ts`, `src/hooks/use-async.ts`
- `context/state`: `src/context/auth-context.tsx`, `src/state/app-state-context.tsx`
- `utils/helpers`: `src/utils/validators.ts`, `src/utils/formatters.ts`
- `assets`: `src/assets/icons`, `src/assets/fonts`
- `global styles/theme`: `src/theme/global.css`, `src/theme/colors.ts`, `src/theme/typography.ts`

## Naming Conventions

- Files: kebab-case (`auth-screen.tsx`, `http-client.ts`)
- Components: PascalCase exports (`AuthScreen`, `AppButton`)
- Hooks: `use*` prefix (`useAuth`, `useAsync`)
- Service methods: action-first (`signInRequest`, `firebaseSignOut`)
- Route constants: uppercase keys (`ROUTES.TABS_HOME`)

## Supabase Setup

This app expects a transactions table in Supabase.

- Default table name: `transactions`
- Override via `EXPO_PUBLIC_TRANSACTIONS_TABLE` (supports `transactions` or `public.transactions`)
