# Finance Tracker — Android deployment

## Application identity

- Expo project ID: `d500d2e5-f29e-4a40-99ed-5caa918eab29`
- Android package: `com.johndera.financetracker`
- Production build output: Android App Bundle (`.aab`)
- Internal install build output: Android package (`.apk`)

Do not change the Android package after the first Google Play release.

## Required EAS environment variables

Configure these in the EAS `production` environment before building:

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_UI_PREVIEW=0`
- `EXPO_PUBLIC_SUPABASE_URL=<production Supabase URL>`
- `EXPO_PUBLIC_SUPABASE_KEY=<production Supabase anon/publishable key>`

Do not commit service-role keys, database passwords, Telegram bot tokens, AI provider keys, or Google Play service-account JSON to the repository.

## Preflight

```bash
npm ci
npm run lint
npm run test:backend
npx expo-doctor
```

The backend connection test must pass against the intended production Supabase project before a production release.

## Build an APK for device testing

```bash
npx eas-cli@latest build -p android --profile production-apk
```

Install the generated APK on a physical Android device and verify authentication, transactions, budgets, persistence, network/offline behavior, and app relaunch.

## Build the Play Store AAB

```bash
npx eas-cli@latest build -p android --profile production
```

## Submit to Google Play

After the Play Console app exists and its service account is configured:

```bash
npx eas-cli@latest submit -p android --profile production
```

Start with the Google Play internal testing track before promoting the same release through closed/open testing or production.
