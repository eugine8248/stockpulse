# stockpulse — UI polish report (framedeck design-system port)

Date: 2026-05-18

## Token diff summary

The dark-only `#0e1116` slate palette is now part of a twin theme: warm
cream in light mode, cool slate in dark — both driven by a CSS-variable
layer that responds to `[data-theme]` on `<html>`. Stockpulse's blue accent
`#5b8def` was retired in favor of framedeck's burnt-orange `#d97757` / vivid
`#f08252`, making it a visual sister to taskpulse + framedeck.

| Token              | Before          | After (light)   | After (dark)        |
| ------------------ | --------------- | --------------- | ------------------- |
| `--c-bg`           | #0e1116 (dark only) | #faf6f0 (cream) | #14171d (cool slate) |
| `--c-surface`      | #161a21         | #ffffff         | #1c2027             |
| `--c-surface-muted`| #1d222b         | #f3eee5         | #262a32             |
| `--c-border-soft`  | #1f242d         | #e9e1d2         | #303540             |
| `--c-border`       | #262c36         | #d8cdb8         | #424857             |
| `--c-text`         | #e6e9ef         | #28231d         | #e8ecf2             |
| `--c-text-2`       | #8b95a5         | #5c554a         | #b4bac4             |
| `--c-text-muted`   | #5a6374         | #8b8275         | #7a818b             |
| `--c-accent`       | #5b8def (blue)  | #d97757 (orange)| #f08252 (warm orange) |
| `--c-success`      | #5fcf95         | #5a9d8a         | #6dbaa3             |
| `--c-warning`      | #e8a86a         | #d4a44a         | #e2b76b             |
| `--c-error`        | #ff7a72         | #c45a4a         | #d97564             |

Legacy stockpulse Tailwind names (`elevated`, `textMuted`, `textFaint`,
`accentHover`, `up`, `down`, `error`) all kept as theme-aware aliases.

## Component-by-component changes

- **`client/tailwind.config.js`** — replaced the static dark-mode color map
  with `var(--c-...)` references. Added framedeck's shadow ramp + radius
  scale + JetBrains Mono fallback chain.
- **`client/src/index.css`** — rewrote on the framedeck template. Added
  `.btn` / `.input` / `.pill` / `.surface` / `.tabstrip` component utilities
  + signal-tinted pills (`pill-buy` / `pill-watch` / `pill-hold` /
  `pill-sell`). The dark-only scrollbar override was replaced with a
  theme-aware one driven by CSS variables.
- **`client/index.html`** — added FOUC-free `<script>` in `<head>` that
  reads `localStorage['stockpulse.theme']`, applies `data-theme` + `.dark`
  before React mounts. theme-color meta switched to cream `#faf6f0`. Dropped
  the hard-coded `class="dark"` on `<html>` since the init script picks the
  right theme based on stored preference (with system-fallback).
- **`client/src/App.tsx`** — theme effect now sets BOTH `data-theme="dark"`
  AND the legacy `.dark` class. Loading state uses the new tokens.
- **`client/src/store/index.ts`** — added an `initialTheme()` helper that
  falls back to system preference instead of hard-coded `'dark'`, matching
  the index.html init logic.
- **`client/src/components/TopBar.tsx`** — restyled to framedeck's IDE
  idiom: orange-square checkmark logo + "stockpulse" wordmark, new bar-chart
  glyph for the watchlist nav button, surface-muted hover, theme-toggle
  with Sun/Moon icons.
- **`client/src/components/StatusBar.tsx`** — soft-bordered footer with a
  dot-tinted connection indicator (success/warning/error variants), all
  monospace text.
- **`client/src/components/AlertToast.tsx`** — toasts are now `.surface`
  cards with an accent-colored left border (4 px), monospace timestamp.
- **`client/src/components/TickerCard.tsx`** — `.surface` card with hover
  shadow-md + accent border. Sparkline reads live CSS variables for
  `--c-success` / `--c-error` so the chart re-themes when dark mode
  toggles. Remove-X button moved to a smaller round badge.
- **`client/src/components/AddTickerCard.tsx`** — dashed border, accent on
  hover, expands inline to the symbol search.
- **`client/src/components/SymbolSearch.tsx`** — uses `.input`,
  surface-muted result hover.
- **`client/src/components/TickerDetailModal.tsx`** — restyled to the
  framedeck panel idiom (`.surface`, soft-bordered, monospace meta, the
  range picker uses the `.tabstrip` utility, stat grid uses uppercase
  muted labels). Cleaned up the alerts section header.
- **`client/src/components/IntradayChart.tsx`** — reads live CSS variables
  via `getComputedStyle(document.documentElement)` on mount + theme
  change. Line color is now `--c-accent`, axes + grid stroke use `--c-
  border-soft` / `--c-text-muted`, tooltip uses `--c-surface` background.
- **`client/src/components/AlertEditor.tsx`** — each alert is a pill-style
  row with a left-border colored by severity (green for "above",
  red for "below"), framedeck-style toggle + delete buttons.
- **`client/src/components/WatchlistGrid.tsx`** — framedeck-style empty
  state (📈 emoji + h2 + subtitle + inline AddTickerCard).
- **`client/src/routes/DashboardPage.tsx`** — heading + subtitle row that
  reads ticker count.
- **`client/src/routes/AlertsPage.tsx`** — `.tabstrip` for active/history,
  surface panels.
- **`client/src/routes/ReportsPage.tsx`** — surface panels everywhere,
  framedeck-style empty state with 📊 emoji.
- **`client/src/components/reports/ReportNav.tsx`** — `.surface` card,
  pill-style date-position counter, `.btn-secondary` arrows.
- **`client/src/components/reports/TopPicksChart.tsx`** — reads live CSS
  variables for all colors. BUY threshold reference line + axis text adapt
  to theme.
- **`client/src/components/reports/ReportBody.tsx`** — replaced ad-hoc
  signal chips with the new `.pill .pill-buy/watch/hold/sell` classes, all
  sections wrap in `.surface`.
- **`client/src/routes/SettingsPage.tsx`** — sections wrapped in `.surface
  p-5`, appearance toggle uses the `.tabstrip` utility, all inputs use the
  `.input` utility.
- **`client/src/routes/LoginPage.tsx` / `SetupPage.tsx`** — both match the
  framedeck SignInPage layout: 400/420-px centered surface, orange-square
  logo + wordmark, `.label` / `.input` everywhere, full-width primary
  button at the bottom.

## Dark mode

Tested by toggling `data-theme="dark"` on `<html>` (TopBar Sun/Moon).
All surfaces, borders, accents, signal pills, sparklines, intraday chart,
and TopPicks bar chart re-render correctly because every color resolves
to a CSS variable that responds to the attribute.

Visual summary (text-only):
- **Light mode** reads as a clean cream "morning paper": warm bg, tan
  borders, dark charcoal text, burnt-orange accent on the topbar logo /
  active nav / primary buttons. The signal pills (BUY/WATCH/HOLD/SELL) use
  the framedeck pill palette so they feel like the same kind-tinted
  language as the kanban statuses next door in taskpulse.
- **Dark mode** is a low-saturation cool slate (almost-black blue-gray)
  with soft slate borders, cool near-white text, and the more vivid
  `#f08252` accent that pops against the cool ground. Sparklines stay
  visually muted (the `.4 → 0` alpha gradient still works) but the line
  color shifts to a richer success/error in dark.

Recharts components needed a small dance — they take SVG attributes as
hex/rgb values, not CSS variable references — so each chart now reads the
resolved values from `getComputedStyle(document.documentElement)` on mount
and re-reads them when the `theme` zustand state changes. Result: chart
colors transition cleanly on dark-mode toggle without remounting.

## Bundle delta

| Artifact | Before (est) | After    | Delta (raw) | After gzip |
| -------- | ------------ | -------- | ----------- | ---------- |
| CSS      | ~10 KB       | 20.5 KB  | +10 KB      | 4.69 KB    |
| JS       | ~648 KB      | 653.7 KB | ~+5 KB      | 187.0 KB   |

Total raw delta: **~+15 KB**, well under the +30 KB cap. No new
runtime dependencies were added. The JS bump is just the small
`getComputedStyle` probes in `TickerCard` / `IntradayChart` /
`TopPicksChart` (theme-aware chart colors).

## Known gaps

- Stockpulse has no LandingPage, OAuth, or marketing-style top bar — the
  framedeck SignInPage has a Google OAuth button + divider that I omitted
  for the same reason as taskpulse. The form-only layout still tracks
  framedeck's spacing / surface / btn-primary conventions.
- Sparkline + intraday + TopPicks charts use a `useState + useEffect` to
  resolve CSS variables once per theme change. This is the minimal
  zero-deps approach since Recharts' SVG attributes don't accept CSS
  variable references directly. If we ever wanted live currentColor binding
  on every render, switching to a custom SVG layer (or `@nivo/...` which
  supports CSS-var theming natively) would let us drop the probe — but
  that's well outside the +30 KB cap and not worth the churn.
- The TickerDetailModal stats grid is unbordered between cells —
  intentional, framedeck uses a similar minimal-grid pattern in its film
  template section. If denser readability matters, a divider style could be
  added in a follow-up without touching the design tokens.
