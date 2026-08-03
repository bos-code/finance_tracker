# Finance Tracker Design System — Obsidian Thread

**Status:** Binding frontend direction

**Updated:** 2026-08-03

## Product character

Finance Tracker is an executive personal ledger: mature, calm, architectural,
and quietly alive. It must not look like a generic fintech dashboard, a toy,
or a template full of interchangeable cards.

## Color rule

Black, white, and graphite carry the interface. Extra color is a signal, never
the body of the UI.

| Role | Token | Value |
|---|---|---|
| Canvas | `canvas` | `#070707` |
| Raised canvas | `canvasRaised` | `#0B0B0B` |
| Surface | `surface` | `#111111` |
| Raised surface | `surfaceRaised` | `#181818` |
| Primary text | `text` | `#F2F2F0` |
| Muted text | `textMuted` | `#A1A19D` |
| Quiet text | `textQuiet` | `#6F6F6B` |
| Line | `line` | `#292927` |
| Strong line | `lineStrong` | `#40403C` |

### Signal colors

Signal colors may appear only as:

- one- or two-pixel thread lines
- faded wave/orbit traces
- short stripes and edge rails
- hairline focus or selection borders
- small nodes and connection points
- income, expense, warning, and sync status marks

They must not fill large cards, navigation chrome, page backgrounds, or primary
buttons.

| Signal | Value | Purpose |
|---|---|---|
| Amber | `#D99A61` | warm trace / connection node |
| Violet | `#8E82C9` | orbit / selection edge |
| Cyan | `#63A6B3` | information / secondary trace |
| Moss | `#7E9E78` | tertiary trace |
| Income | `#78B68C` | positive financial meaning |
| Expense | `#C77B70` | negative financial meaning |

## Composition

- Prefer vertical rails, ledger rows, section rules, and strong whitespace.
- Use one dominant work surface per view instead of a mosaic of cards.
- Let financial figures own the hierarchy.
- Use asymmetry deliberately, with a stable reading order.
- Use one radius family: 10, 16, 24–28, and fully round only where structural.
- Use borders before shadows. Elevation must be rare and quiet.
- Background imagery, when introduced, must be monochrome, low-contrast, and
  subordinate to data.

## Typography

- Display: editorial serif (`Georgia` / platform serif fallback).
- Body: platform sans for legibility.
- Ledger/numeric metadata: bundled `SpaceMono`.
- Use uppercase monospaced labels sparingly for coordinates, status, periods,
  and system information.
- Never use typography as decoration at the cost of readable amounts.

## Navigation

- Five destinations: Home, Ledger, Goals, Insights, Profile.
- The selected destination uses a moving ivory orbit with a thin violet edge.
- Text labels stay visible.
- Touch targets are at least 44 points.
- The orbit moves on transform only and snaps when reduced motion is enabled.

## Motion

- Motion serves feedback, orientation, or continuity.
- One ambient signal-thread layer may move slowly on a screen when it does not
  compete with data.
- At most one additional functional motion element may run on the same view.
- Use transform and opacity only for continuous animation.
- Navigation motion is critically damped; finance UI does not bounce.
- Respect reduced motion by stopping ambient loops and snapping navigation.

## Component rules

### Buttons

- Primary: ivory fill, near-black text, 52–56 point height.
- Secondary: graphite surface with a one-pixel line.
- Destructive: monochrome body with a small expense-colored signal, not a large
  red fill.
- Every press has immediate visual and accessible feedback.

### Ledger rows

- Use horizontal structure, exact values, and one semantic edge mark.
- Avoid oversized category tiles.
- Pending, syncing, failed, and review states must be visible in text as well as
  color.

### Forms and sheets

- Keep labels visible.
- Use a single work surface with internal rules.
- Bottom sheets share the graphite palette and safe-area padding.
- Errors are specific and recoverable.

## Forbidden patterns

- Default blue/indigo fintech gradients
- Color-filled dashboard cards
- Bento grids for core financial work
- Excess glass, glow, blur, and floating shadows
- Decorative chart loops or bouncing finance UI
- Icon-only navigation without labels
- Emoji as product icons
- Dense rounded-chip clouds
- Silent OCR/AI changes to confirmed data
- Hidden offline, pending, or failed states

## Delivery checklist

- [ ] Monochrome hierarchy remains legible with signal colors removed
- [ ] Signal colors occupy only small traces or semantic marks
- [ ] Text contrast meets WCAG AA
- [ ] All controls have visible focus/pressed/selected states
- [ ] All touch targets are at least 44 points
- [ ] Reduced motion stops thread loops and snaps the orbit
- [ ] No content is hidden behind the bottom navigator
- [ ] Loading, empty, error, offline, syncing, and review states are reachable
- [ ] Long histories use virtualized lists
- [ ] TypeScript, lint, and production bundle checks pass
