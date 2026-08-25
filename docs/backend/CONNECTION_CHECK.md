# Finance Tracker backend connection check

## Current result

The mobile application is correctly configured to read its public Supabase
configuration from these environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_UI_PREVIEW`

The repository intentionally contains placeholders only. No live Supabase URL,
anon key, project reference, database password, access token, service-role key,
or Edge Function secret is committed.

The Expo application is linked to EAS project
`d500d2e5-f29e-4a40-99ed-5caa918eab29`, but EAS environment variables and
Supabase project access cannot be verified from the GitHub repository.

No Vercel project matching `finance_tracker` or `finance-tracker` is linked in
the connected Vercel account. The application is an Expo/EAS mobile project, so
Vercel is not the source of truth for its production credentials.

## Required access for the live Stage 1–4 migration gate

Provide one of the following secure access paths:

1. Supabase project access through the connected account; or
2. The Supabase project reference plus a Supabase access token; or
3. A local environment containing:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_KEY`
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_DB_PASSWORD` when required by the CLI

Do not commit these values. The public URL and anon key may be placed in EAS
environment variables. Service-role keys, cleanup secrets, Telegram secrets,
and future AI-provider keys must remain server-only Supabase secrets.

## Live verification matrix

Once access is available, run the ordered migrations and verify:

- existing users and transactions survive the baseline migration;
- every user receives exactly one personal workspace and default Cash account;
- two users cannot read or mutate each other's workspace data;
- repeated idempotency keys replay rather than duplicate a transaction;
- revision conflicts are returned instead of silently overwriting data;
- changing the workspace currency does not relabel historical transactions;
- receipt objects and metadata remain private to the owning user/workspace;
- receipt deletion removes the object before guarded metadata deletion;
- offline create, edit, and delete reconcile without duplicates after reconnect;
- the receipt orphan-cleanup function authenticates and processes only eligible
  stale records.
