# Finance Tracker Implementation Status

## Current checkpoint

**Batch:** 5 — secure App Lock and shared capture surfaces

**Branch:** `master`

**Design direction:** Obsidian Thread

## Completed through this checkpoint

### Foundation, shell, and Home

- Added the complete ten-stage frontend plan aligned to `PLAN_BACKEND.md`.
- Replaced the generic blue design source with the binding black/white/graphite
  Obsidian Thread system.
- Added spacing, radius, typography, motion, and restrained signal-color tokens.
- Loaded the bundled Space Mono font and changed the app/splash chrome to
  dark-first.
- Rebuilt the bottom navigation as a five-destination orbit: Home, Ledger,
  Goals, Insights, and Profile.
- Added reduced-motion behavior for the orbit indicator and animated signal
  threads.
- Rebuilt Home around the current-month net position, income/outflow totals,
  recent ledger movement, sync state, and inline transaction capture.
- Preserved the existing amount, date, note, category, optimistic-save, and
  offline-queue behavior.
- Added frontend fixture mode and a mock signed-in session for backend-
  independent UI work.
- Added Nigerian naira to the available currencies without forcing it as the
  default.
- Made Supabase auth and Zustand persistence safe during Expo web static
  rendering.

### Shared finance primitives

- Added a single selected-currency formatter for whole, fractional, negative,
  and compact values; removed the remaining VND-specific screen formatting.
- Added reusable dark-first primitives for:
  - page headings
  - segmented controls
  - period navigation
  - summary rails
  - loading, empty, error, and retry states
  - accessible ledger entry rows with category, amount, date, and local status

### Ledger

- Replaced the old Calendar screen with a full Ledger destination.
- Added list and calendar modes with Monday-first calendar layout.
- Added month navigation and real net, income, and outflow totals.
- Added search across notes, categories, transaction type, and amount.
- Added All, Income, Outflow, and Pending filters.
- Added date-grouped virtualized list rendering for the primary ledger view.
- Added local/pending markers for optimistic and offline transaction IDs.
- Added locale-safe day labels and prevented adjacent-month cells from acting
  like loaded dates.
- Added selected-day detail, pull-to-refresh, retry, loading, filtered-empty,
  and no-transaction states.
- Kept the interface monochrome; semantic color is limited to thin entry and
  day signals.

### Insights

- Replaced the old card-and-donut screen with a restrained analytical ledger.
- Added month/year period switching and navigation.
- Added real income, outflow, and net totals using the selected currency.
- Added Outflow/Income analysis switching.
- Replaced fabricated trend multipliers with values derived directly from the
  active transaction set:
  - weekly buckets for month view
  - monthly buckets for year view
- Added a live prior-period comparison with an explicit no-baseline state.
- Added exact transaction counts, accessible trend values, a thin thread-like
  trend treatment, and a ranked category ledger.
- Added an evidence-based readout for the largest category and net movement;
  no warning or claim is invented when data is insufficient.
- Limited category color to a three-pixel distribution rail and one-pixel row
  signals.

### Goals and forms

- Rebuilt Goals as a vertical plan ledger with restrained one-pixel identity
  signals and two-pixel progress rails.
- Preserved create, edit, contribute, complete, reopen, and confirmed-delete
  behavior.
- Added active/completed filters, dated and undated states, overdue status,
  exact progress, remaining amount, pull-to-refresh, retry, and empty states.
- Stopped summing unlike currencies: the headline reserved-capital figure is
  explicitly scoped to the currently selected currency, while each goal keeps
  and displays its own original currency.
- Added realistic mutable goal fixtures so create/update/contribute/delete can
  be reviewed without a live Goals table.
- Added shared Obsidian Thread primitives for bottom sheets, labeled fields,
  and primary/quiet/destructive actions.
- Rebuilt the goal editor and contribution sheet with the shared dark form
  system; goal color is limited to a thin thread and progress signal.

### Profile and settings

- Rebuilt Profile as a dark personal-workspace control center with identity,
  base currency, workspace scope, automation readiness, privacy, security, and
  session controls.
- Removed the legacy full-screen color/gradient picker so the binding
  black/white/graphite system cannot be replaced by a generic blue theme.
- Kept currency selection functional and clarified that it changes display
  formatting rather than converting historical values.
- Added honest Telegram `Not linked` and WhatsApp `Deferred` states instead of
  pretending that an unavailable backend flow is connected.
- Added notification preference controls with an explicit frontend-preview
  disclaimer until Backend Stage 9 persists them.
- Added data-control readiness for user-scoped transactions, private receipts,
  review-before-apply, export, retention, and deletion without presenting
  unfinished controls as active.
- Removed the dead export button and non-functional language selector.
- Preserved profile-name update, device photo preview, app-lock entry, change
  password, and confirmed logout; profile mutations now work in fixture mode
  without calling Supabase.

### Onboarding and identity

- Replaced the legacy single blue `Moneyme` splash with a three-step Obsidian
  Thread onboarding flow covering position, offline-safe capture, and privacy.
- Persisted onboarding completion so returning users are routed directly to
  their signed-in ledger or the identity screen; storage failure cannot trap the
  launch flow.
- Rebuilt sign in and account creation with the shared dark shell, labeled
  fields, password visibility controls, keyboard focus order, inline validation,
  recoverable service errors, and an eight-character creation minimum.
- Made sign-in state deterministic immediately after a successful Supabase
  response instead of relying only on a later auth event.
- Made account creation distinguish an active session from required email
  confirmation; protected tabs are no longer entered when Supabase returns no
  session.
- Rebuilt password recovery with an account-enumeration-safe response and a
  time-limited deep-link boundary.
- Rebuilt password update with inline expired-link/error handling, confirmation,
  an explicit success state, and clean-session return to sign in.
- Added fixture-safe recovery, name, and password mutations without external
  Supabase writes.

### Security and shared capture surfaces

- Moved the four-digit App Lock PIN out of Zustand/AsyncStorage and into the
  native operating-system secure store through Expo SecureStore.
- Added a user-scoped secure-storage key and a one-time migration path for valid
  legacy device PINs; new PIN values are no longer included in general app
  preference persistence.
- Delayed lock readiness until both authentication and secure storage finish
  restoring, preventing startup races from discarding a legacy credential.
- Kept biometric unlock as a convenience path with the PIN as the fallback;
  unsupported or unenrolled devices receive an explicit unavailable state.
- Intentionally disabled App Lock on web, where the native secure store is not
  present, instead of falling back to insecure browser persistence.
- Made logout delete the current user's device-local secure PIN before the
  session is cleared.
- Rebuilt the App Lock gate, lock screen, setup/update panel, and PIN/amount
  keypad in the Obsidian Thread system.
- Rebuilt the date calendar, category editor, and save/error feedback surfaces
  so transaction and goal capture no longer opens bright legacy UI.
- Limited category and status colour to icon signals, hairlines, restrained
  ripples, and semantic success/error states.
- Added accessibility state and labels to calendar dates, category choices,
  colour and icon choices, month navigation, and keypad actions.

## Verification at this checkpoint

- `pnpm exec tsc --noEmit` — passed.
- `pnpm lint` — passed with zero errors and zero warnings.
- Expo fixture-mode production web export — passed; all 16 routes bundled.
- Expo normal production web export with non-secret placeholder Supabase values
  — passed; all 16 routes bundled.
- Goals fixture-mode and normal production exports after the Goals redesign —
  passed; all 16 routes bundled.
- Profile fixture-mode and normal production exports after the settings redesign
  — passed; all 16 routes bundled.
- Entry/auth fixture-mode and normal production exports — passed; all 16 routes
  bundled, with expected onboarding, recovery, and new-password content in the
  static fixture output.
- Security/shared-surface fixture-mode and normal production exports — passed;
  all 16 routes bundled after the SecureStore migration and shared UI rebuild.
- Static fixture output contains the expected Ledger, Insights, and Goals route
  headings, search/plan affordances, state copy, and orbit navigation.
- Automated screenshot inspection is still unavailable because the workspace
  blocks the browser verifier's local daemon socket. This is an environment
  limitation and is not counted as a visual pass.

## Existing product behavior preserved

- Supabase authentication and storage configuration
- transaction creation and React Query invalidation
- offline transaction queue and reconnect synchronization
- custom amount pad, calendar, note editor, category editor, and save feedback
- native App Lock and biometrics, now backed by the operating-system secure
  store rather than general app preferences

## Not yet redesigned or implemented

- Backend persistence for workspace, account, connection, privacy, and
  notification settings
- receipt vault, review drafts, Telegram connection UI, and OCR review UI
- new backend schemas, contracts, Edge Functions, storage policies, bot flows,
  and production hardening described in `PLAN_BACKEND.md`

## Exact next batch

1. Begin Backend Stage 1 by inventorying the current Supabase migrations, Edge
   Functions, client models, and environment contracts against
   `PLAN_BACKEND.md`.
2. Add the authoritative database/API contract without breaking the existing
   transaction flow, then verify local types and migrations.
3. Commit and push the verified backend-contract batch before moving to
   transaction reliability and idempotency.

## Backend clarification

The backend is Supabase: PostgreSQL, Auth, Storage, Realtime, and TypeScript/Deno
Edge Functions. There is no H2 backend in the current architecture.
