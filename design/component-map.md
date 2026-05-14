# Component Map — stockpulse

All colors reference Tailwind tokens defined in `tailwind.config.js`. Dark theme is default.

## Layout shell

### `AppLayout`
- Renders TopBar + main slot + StatusBar
- Subscribes to WebSocket on mount, manages connection state in Zustand
- Wraps router outlet

### `TopBar` (h-14, sticky)
- Logo (left) — `stockpulse` wordmark in mono accent
- Add-ticker button (next to logo on desktop, drawer on mobile)
- Connection dot + label (center-right)
- Bell icon (alerts count badge if > 0) — opens `/alerts` route
- Settings cog → `/settings`
- Theme toggle (small)

### `StatusBar` (h-7, sticky bottom)
- Connection status / poll interval / ticker count / active alert count
- Compact, monospace, faint text

## Watchlist

### `WatchlistGrid`
- CSS grid, responsive: 5 cols ≥ 1280px, 4 ≥ 1024, 3 ≥ 768, 2 ≥ 640, 1 below
- Renders one `TickerCard` per item plus an `AddTickerCard` at the end
- Drag-reorder via `@dnd-kit/sortable`

### `TickerCard`
- Symbol (large, mono) · company name (small, muted)
- Current price (large, mono)
- Day change (signed, colored green/red, with up/down arrow glyph)
- Sparkline (full-width, 40px tall, Recharts AreaChart)
- Volume in compact form (e.g. "38.2M")
- Click → opens detail modal
- Long-press / right-click → contextual menu (Add alert, Remove from watchlist, Reorder)
- Loading skeleton variant: animated shimmer

### `AddTickerCard`
- Same dimensions as TickerCard, dashed border, "+" + label
- Click → opens search popover

### `SymbolSearch`
- Inline autocomplete dropdown
- Hits `/api/symbols/search?q=...` debounced 200ms
- Keyboard arrows + Enter to pick
- Shows recent recents above suggestions

## Detail modal

### `TickerDetailModal`
- Opens on card click; URL routes to `/ticker/:symbol` for deep-linking
- Header: symbol + company + current price + day-change pill
- `RangeChips`: 1d/5d/1mo/3mo/1y selector
- `IntradayChart`: Recharts LineChart, theme-aware grid + axes, hover tooltip
- `KeyStatsGrid`: 6-cell grid (Open, High, Low, Prev Close, Market Cap, P/E)
- `AlertsForTicker`: list of alerts on this symbol with edit/delete
- "Remove from watchlist" destructive action (bottom)
- Esc to close

### `AlertEditor`
- Type selector (4 options as radio cards)
- Threshold input (number or % depending on type)
- Channels: In-app (always on), Browser notification (toggle, prompts permission first time)
- Sound toggle
- Save / Cancel

## Alert pages

### `AlertsPage` (route `/alerts`)
- Two tabs: Active / History
- **Active tab:** table — Symbol · Type · Threshold · Created · Channels · Actions (toggle / edit / delete)
- **History tab:** reverse-chronological list — Symbol · Type · Triggered at · Observed value · "Mark seen" / "Delete"

### `AlertToast`
- Slide-in from top-right when alert fires
- Symbol + condition + observed value
- Click → opens that ticker's detail
- Auto-dismiss after 8s; can stack up to 4

## Settings

### `SettingsPage`
- Tabs: Account / Data Source / Notifications / Appearance
- **Account:** display name, email, change password, delete account
- **Data Source:** Yahoo (default radio) / Polygon (radio + key input + "Test" button)
- **Notifications:** poll interval (slider 2–60s, default 5s), browser notification permission status, alert sound on/off
- **Appearance:** theme (Dark / Light / System)

## Auth

### `LoginPage` (route `/login`)
- Centered card on dark bg
- Email + password inputs (react-hook-form + Zod)
- "Sign in" primary button
- Link to "Forgot password?" (v2)
- Friendly error rendering (invalid creds, etc.)

### `SetupPage` (route `/setup`)
- Shown when no users exist in DB
- "Welcome to stockpulse — create your admin account"
- Email + password (with strength indicator) + confirm password
- "Create account" → auto-logs in → redirects to `/`

## Form / control primitives

### `Button`
- Variants: `primary` (accent #5b8def, white text), `secondary` (panel bg, border), `ghost` (transparent, muted text), `danger` (red bg)
- States: default, hover, pressed, disabled, loading (spinner replaces text)
- Sizes: sm (h-7), md (h-9 default), lg (h-11)

### `Input` / `Textarea` / `Select`
- Background: surface (#161a21 dark), border (#262c36), focus ring accent
- Mono variant for symbols + numbers

### `Toggle`
- Track 32×16, knob 12×12 with smooth slide
- Off: muted; On: accent

### `Dialog` / `Modal`
- Backdrop blur-sm + dark overlay
- Centered card with subtle shadow
- Close X top-right + Esc close

### `Toast` host
- Top-right, stacking
- 4 variants: info (blue), success (green), warning (amber), error (red), alert (accent for stockpulse alerts specifically)

### `Badge`
- For ticker change pills, alert counts, status chips
- Up/down arrow glyph + value, color-coded by direction

## Visual tokens (Tailwind config)

```js
colors: {
  bg:        '#0e1116',
  surface:   '#161a21',
  elevated:  '#1d222b',
  border:    '#262c36',
  borderSoft:'#1f242d',
  text:      '#e6e9ef',
  textMuted: '#8b95a5',
  textFaint: '#5a6374',
  accent:    '#5b8def',
  accentHover:'#6d9bf7',
  up:        '#5fcf95',
  down:      '#f0716a',
  warning:   '#e8a86a',
  error:     '#ff7a72',
  // light theme variants under `theme.extend.colors.light.*`
}
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Consolas', 'monospace'],
}
```

## Loading / empty states

- **Empty watchlist:** centered illustration + "Add your first ticker" with prominent search
- **Skeleton card:** animated shimmer matching TickerCard dimensions while initial load
- **Stale data overlay:** subtle amber strip at top with "Reconnecting..." text + retry button
