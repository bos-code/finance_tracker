# Receipt orphan cleanup

This server-only Edge Function removes attachment uploads that have remained in
`pending`, `uploading`, or `failed` state for seven days. It deletes the private
Storage object before deleting its metadata record and processes at most 100
records per invocation.

Deployment requirements:

- set a strong `RECEIPT_CLEANUP_SECRET` Edge Function secret;
- retain the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the
  Edge Function environment;
- invoke with `POST`, a valid deployment authorization token, and the matching
  `x-cleanup-secret` header;
- schedule daily only after the Stage 4 migration and two-user Storage/RLS tests
  pass in development.

Never expose the cleanup secret or service-role key through an
`EXPO_PUBLIC_*` variable.
