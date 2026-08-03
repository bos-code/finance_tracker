# Finance Tracker Frontend Implementation Plan

## Purpose

Build the mobile experience for Finance Tracker from the current Expo application into a reliable, premium personal-finance product. The frontend must remain independently buildable with typed adapters and realistic fixtures while the backend stages in `PLAN_BACKEND.md` are implemented.

This is an implementation plan, not a visual mood board. Every stage includes reachable states, backend dependencies, and a completion gate.

## Product outcome

Finance Tracker should help a person answer four questions quickly:

1. What is my current financial position?
2. What changed recently?
3. What needs my attention?
4. What should I do next?

The release supports personal workspaces, income and expense tracking, offline synchronization, accounts and currency, goals, private receipts, Telegram-assisted capture, reviewable parser/OCR drafts, and clear privacy/security controls.

## Final design direction — Obsidian Thread

The agreed interface is premium, mature, calm, and architectural. It should feel like an executive ledger brought to life, not a generic fintech template.

### Visual principles

- Use a deep, near-black mineral background with quiet layered surfaces.
- Let black, white, and graphite carry the interface. Use extra color only as a thin signal: animated thread lines, faded wave traces, edge stripes, hairline borders, and financial status.
- Make balances and financial figures the strongest visual elements.
- Use vertical rules, ledger rows, and deliberate spacing instead of piles of floating cards.
- Keep one coherent radius system and a restrained elevation system.
- Prefer visible labels and plain language over icon-only mystery controls.
- Avoid default blue/indigo gradients, glass-heavy chrome, excessive glow, bento dashboards, playful bubbles, and ornamental charts.
- Build all light/dark-sensitive primitives from tokens. The initial release is intentionally dark-first.

### Motion principles

- Motion explains hierarchy, state change, and navigation; it is never constant decoration.
- Animate at most one or two primary elements on a screen.
- Use Reanimated transforms and opacity for the orbit navigator, balance transitions, sheets, and state changes.
- Provide an immediate reduced-motion path.
- Keep press feedback short and tactile, and never block interaction while an animation finishes.
- Keep custom gestures away from system back/swipe regions.

### Navigation concept

- A five-destination bottom orbit: Home, Ledger, Goals, Insights, Profile.
- The selected destination is marked by a moving ivory orbit indicator with a fine colored signal edge on a shallow arc.
- Every destination retains a persistent text label and a minimum 44-point touch target.
- Transaction capture remains a prominent Home action, not a hidden navigation mode.

## Information architecture

| Destination | Primary job | Core content |
|---|---|---|
| Home | Understand now and act | Living balance, income/spend pulse, recent activity, sync state, quick capture |
| Ledger | Find and inspect money movement | Calendar/list modes, filters, search, transaction detail, receipt access |
| Goals | Plan forward | Goal progress, contributions, deadlines, completion state |
| Insights | Understand patterns | Period totals, category breakdown, trend, attention items |
| Profile | Configure and protect | Workspace, accounts, currency, connections, notifications, privacy, app lock |

## Shared frontend architecture

### Layers

1. **Route layer** — Expo Router wrappers and typed tab/stack navigation.
2. **Screen layer** — composition, loading/error/empty/review states, and view-specific interaction.
3. **Feature layer** — transactions, accounts, goals, receipts, drafts, connections, notifications, security.
4. **Data adapter layer** — typed interfaces with Supabase implementations and fixture implementations.
5. **State layer** — TanStack Query for server state; Zustand only for durable local preferences and small UI state.
6. **Primitive layer** — tokens, typography, icons, buttons, rows, fields, sheets, banners, skeletons, and feedback.

### Required data adapters

- `SessionAdapter`
- `ProfileAdapter`
- `WorkspaceAdapter`
- `AccountAdapter`
- `TransactionAdapter`
- `OfflineSyncAdapter`
- `GoalAdapter`
- `ReceiptAdapter`
- `DraftAdapter`
- `ConnectionAdapter`
- `NotificationPreferenceAdapter`

Each adapter must expose typed success and typed failure results. Screens must not parse raw Supabase errors or raw webhook payloads.

### Universal state model

Every data-bearing surface must deliberately support:

- initial loading
- pull-to-refresh or explicit retry
- useful empty state
- populated state
- recoverable error
- offline with cached data
- pending local write
- syncing
- sync conflict or failed write
- permission denied
- awaiting review where applicable

## Stage 1 — Design foundation, contracts, and fixtures

### Goal

Create the stable visual and data foundations so frontend work can continue without waiting for backend implementation.

### Work

- Establish Obsidian Thread color, spacing, radius, typography, elevation, and motion tokens.
- Build an internal icon wrapper over the installed React Native icon package.
- Build shared primitives: screen, section label, ledger row, amount, status chip, button, icon button, field, sheet, banner, skeleton, empty state, and error state.
- Define the adapter interfaces and frontend domain models.
- Add realistic fixture adapters for users, accounts, transactions, goals, receipts, drafts, and connections.
- Add a single runtime switch between fixture and Supabase adapters.
- Map backend error codes to user-facing messages and recovery actions.
- Document route names and screen ownership.

### Backend alignment

Matches Backend Stage 1 contracts, naming, identifiers, timestamps, error taxonomy, and environment separation.

### Completion gate

Stage 1 is complete when a developer can render all primitives and all universal states without a working network or Supabase project.

## Stage 2 — Entry, onboarding, session, and app lock

### Goal

Make entry into the product trustworthy, clear, and recoverable.

### Work

- Redesign sign up, sign in, password reset, and update-password flows.
- Add a short value-led onboarding sequence.
- Add session restoring, expired-session, and unavailable-service states.
- Keep PIN and biometrics behind the authenticated session boundary.
- Replace insecure PIN persistence with the backend/security-approved local secret approach.
- Add biometric unavailable, failed, locked-out, and fallback-to-PIN states.
- Add accessible keyboard handling, focus order, validation, and inline errors.

### Backend alignment

Consumes Backend Stages 1, 3, and 10 session/profile/security contracts.

### Completion gate

Stage 2 is complete when a user can enter, recover access, lock, unlock, and sign out with every failure state represented.

## Stage 3 — App shell and orbit navigation

### Goal

Ship the architectural frame that makes every core destination easy to reach.

### Work

- Implement the five-destination orbit tab bar.
- Preserve native navigation state, long-press behavior, back behavior, and accessibility selection state.
- Add safe-area-aware spacing on small and large phones.
- Add a quiet offline/sync status line that does not cover content.
- Add reduced-motion behavior for the orbit indicator.
- Use persistent text labels and large touch targets.
- Ensure keyboard and modal layers do not collide with the tab bar.

### Backend alignment

Uses the shared sync-status vocabulary defined in Backend Stage 2.

### Completion gate

Stage 3 is complete when all five destinations are reachable by touch, screen reader, and predictable back navigation on iOS, Android, and web preview.

## Stage 4 — Home and transaction capture

### Goal

Turn Home into a living financial position and make transaction capture fast, explicit, and offline-safe.

### Work

- Add the living balance hero with account/workspace scope and last-updated state.
- Show period income, spend, and net movement without decorative chart clutter.
- Show recent ledger activity with pending/sync-failed markers.
- Add a clear income/expense capture entry point.
- Redesign amount, category, date, note, account, and optional receipt inputs.
- Keep the custom number pad, with locale-aware formatting and decimal rules.
- Add optimistic save, queued-offline, synced, failed, retry, and duplicate-prevention behavior.
- Make destructive transaction changes confirmable and recoverable.
- Add transaction detail and edit surfaces.

### Backend alignment

Consumes Backend Stage 2 transaction/idempotency/offline contracts and Backend Stage 3 workspace/account/currency contracts.

### Completion gate

Stage 4 is complete when create, edit, delete, restore, retry, and offline reconciliation work without duplicate or lost transactions.

## Stage 5 — Ledger and calendar

### Goal

Provide a dense, legible record of money movement that is fast to browse and search.

### Work

- Rename the user-facing Calendar destination to Ledger while retaining calendar and list modes.
- Add month navigation, day grouping, totals, and transaction counts.
- Add search and filters for type, category, account, receipt, status, and date range.
- Use virtualized lists for long histories.
- Add stable empty, loading, error, offline-cache, and end-of-list states.
- Add receipt and draft indicators to ledger rows.
- Maintain local dates without UTC date shifts.

### Backend alignment

Consumes Backend Stages 2–5 query, account, receipt, and draft contracts.

### Completion gate

Stage 5 is complete when a user can locate and inspect a transaction reliably across long histories and offline cache states.

## Stage 6 — Insights

### Goal

Explain spending patterns without turning the product into a decorative analytics dashboard.

### Work

- Add period switching and account/workspace scope.
- Show revenue, expenditure, net movement, and comparison to the prior period.
- Show category distribution with accessible labels and exact values.
- Add a restrained trend visualization and a ranked category ledger.
- Add attention items such as unusual spend, large transactions, and goal risk only when evidence exists.
- Add insufficient-data explanations instead of empty charts.
- Respect reduced motion and avoid animated chart loops.

### Backend alignment

Consumes Backend Stages 2, 3, and 9 aggregation/realtime data. Advanced warnings remain preference-controlled.

### Completion gate

Stage 6 is complete when every visual has an equivalent readable value and period calculations match transaction totals.

## Stage 7 — Goals

### Goal

Make goals feel deliberate and motivating without gamification noise.

### Work

- Redesign the goals overview as a vertical plan ledger.
- Support create, edit, archive, complete, restore, and delete flows.
- Support amount, currency, due date, notes, icon, and restrained color identity.
- Add contributions and transaction-linking when the backend contract is available.
- Show progress, remaining amount, pace, deadline, and completion state.
- Add offline/read-only messaging until goal offline queues are supported.
- Add useful empty and overdue states.

### Backend alignment

Consumes Backend Stage 3 workspace/currency changes and existing goal APIs; future contribution links use explicit contracts rather than frontend inference.

### Completion gate

Stage 7 is complete when goal totals and statuses remain correct across create/edit/complete/archive operations.

## Stage 8 — Receipt vault and review drafts

### Goal

Provide a private, layered receipt experience and a safe review boundary for parsed or extracted data.

### Work

- Add image/PDF selection and camera entry where supported.
- Validate supported file type and size before upload.
- Show local preview, uploading, processing, ready, failed, and deleted states.
- Use signed/private URLs and never persist a public storage URL.
- Add a receipt vault grouped by time and linked transaction.
- Add receipt detail with metadata and delete/unlink controls.
- Add a review sheet comparing extracted merchant, amount, date, category, and note with current values.
- Never apply OCR/parser fields before explicit confirmation.
- Keep original files intact when extraction fails.

### Backend alignment

Consumes Backend Stage 4 storage and Backend Stages 5, 6, and 9 draft/parser/AI/OCR contracts.

### Completion gate

Stage 8 is complete when upload, retry, inspect, review, attach, unlink, and delete are private, understandable, and recoverable.

## Stage 9 — Currency, connections, notifications, and realtime

### Goal

Give users control over regional defaults, automation connections, and the amount of attention the app requests.

### Work

- Suggest currency once from device region, explain the suggestion, and require confirmation.
- Preserve the chosen currency during travel and allow a manual override.
- Add workspace and account settings.
- Add Telegram connection status, secure linking code flow, expiration, disconnect, and reconnect states.
- Show Telegram-created transactions and drafts in the same ledger/review surfaces.
- Add a disabled/coming-later WhatsApp connection row without implying the Cloud API is active.
- Add notification preferences for confirmations, failures, large transactions, budget warnings, summaries, and goals.
- Apply realtime cache updates or targeted invalidation without duplicate rows.
- Show channel/AI/OCR outages as degraded features, not total app failures.

### Backend alignment

Consumes Backend Stages 3 and 7–9. WhatsApp implementation remains deferred as specified by Backend Stage 10.

### Completion gate

Stage 9 is complete when region/currency choice is stable, Telegram linking is secure, realtime updates do not duplicate data, and notification preferences are honored.

## Stage 10 — Accessibility, performance, testing, and release

### Goal

Make the complete experience dependable enough to release.

### Work

- Verify screen-reader names, roles, state, order, and dynamic announcements.
- Verify contrast, text scaling, reduced motion, keyboard behavior, and minimum touch targets.
- Profile list rendering, screen transitions, large histories, image previews, and startup.
- Keep animations on transform/opacity and remove avoidable React re-renders.
- Add unit tests for formatters, adapters, state mapping, and validation.
- Add component tests for core states and transaction/receipt review flows.
- Add end-to-end tests for auth, transaction offline sync, goals, receipt upload/review, Telegram linking, and account deletion/privacy controls.
- Add visual regression references for the five core destinations and critical modal/sheet states.
- Add monitoring boundaries that avoid leaking financial or receipt content.
- Document frontend environment setup, fixture mode, Supabase mode, build, rollback, and known limitations.

### Backend alignment

Completes the frontend side of Backend Stage 10 security, monitoring, test, deployment, retention, and rollback requirements.

### Completion gate

Stage 10 is complete when critical flows pass on supported platforms, no sensitive data appears in logs, accessible/reduced-motion paths work, and release/rollback instructions are reproducible.

## Frontend-to-backend delivery map

| Frontend stage | Depends on backend stage | Can start with fixtures? |
|---|---:|---:|
| 1. Foundation/contracts | 1 | Yes |
| 2. Entry/security | 1, 3, 10 | Yes |
| 3. Shell/navigation | 2 status vocabulary | Yes |
| 4. Home/transactions | 2, 3 | Yes |
| 5. Ledger/calendar | 2–5 | Yes |
| 6. Insights | 2, 3, 9 | Yes |
| 7. Goals | 3 + current goal API | Yes |
| 8. Receipts/drafts | 4–6, 9 | Yes |
| 9. Currency/connections/realtime | 3, 7–9 | Yes |
| 10. Release hardening | 10 | Partly |

## Release scope

### Included

- Supabase authentication, profile, personal workspace, accounts, and explicit currency
- Transaction CRUD and reliable offline synchronization
- Calendar/list ledger, insights, and goals
- Private PDF/image receipt storage
- Deterministic parser and review drafts
- Controlled server-side Gemini Flash-Lite fallback
- Shared Telegram bot with secure user linking
- Telegram transaction and receipt workflows
- Realtime updates, notification preferences, and reviewable OCR assistance
- App lock, biometrics, privacy controls, security hardening, monitoring, and tests

### Deferred

- WhatsApp Cloud API implementation
- User-owned bot/business-number infrastructure
- Payments, subscriptions, monetization, paid AI tiers, and team billing
- Tax filing, investments, bank aggregation, and a full web dashboard

## Definition of frontend completion

The frontend is complete for this release when all five destinations and every critical modal/sheet state are implemented; transaction writes survive offline/reconnect without duplication; currency remains user-controlled; receipts stay private; parser/OCR/AI output is reviewable; Telegram activity appears consistently; accessibility and reduced-motion paths work; critical automated and visual checks pass; and backend outages degrade only the affected feature.
