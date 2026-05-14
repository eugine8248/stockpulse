# UX Flow — stockpulse

## Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/login` | none | Email/password sign-in. Skipped in NO_AUTH mode. |
| `/setup` | none | First-launch admin creation (no users exist yet) |
| `/` | auth | **Dashboard** — watchlist grid, the home view |
| `/ticker/:symbol` | auth | Ticker detail modal route (deep-linkable) |
| `/alerts` | auth | Active alerts + alert history |
| `/settings` | auth | API source, poll interval, theme, account |

## Dashboard layout

```
┌─────────────────────────────────────────────────────────────┐
│ TopBar  [stockpulse] [Add ticker]      [○ live] [bell] [⚙] │
├─────────────────────────────────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐         │
│  │ AAPL  │ │ MSFT  │ │ NVDA  │ │ GOOGL │ │ +     │         │
│  │ 198.4 │ │ 423.1 │ │ 882.7 │ │ 175.6 │ │ Add   │         │
│  │ ▲2.1% │ │ ▲0.4% │ │ ▼1.2% │ │ ▲0.8% │ │       │         │
│  │ /\/\__│ │ _/\__/│ │ \/\__\│ │ /\__/\│ │       │         │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘         │
│  [more cards…]                                              │
├─────────────────────────────────────────────────────────────┤
│ StatusBar  ● connected · 5s poll · 12 tickers · 3 alerts   │
└─────────────────────────────────────────────────────────────┘
```

## Ticker detail (modal opens on card click)

```
┌─ AAPL · Apple Inc. ───────────────────── × ┐
│ $198.42 ▲ +4.13 (+2.13%)        Vol 38.2M │
│ ┌──────────────────────────────────────┐  │
│ │  intraday line chart (1d default)    │  │
│ └──────────────────────────────────────┘  │
│ [1d] [5d] [1mo] [3mo] [1y]                │
│                                            │
│ Open 196.10  High 199.20  Low 195.40      │
│ Prev 194.29  Mkt Cap $3.1T  P/E 28.4      │
│                                            │
│ Alerts on this ticker:                    │
│  • Price above $200      [edit][delete]   │
│  • -2% intraday change   [edit][delete]   │
│  [+ Add alert]                            │
└────────────────────────────────────────────┘
```

## Alert lifecycle

1. User clicks card → detail modal → "Add alert"
2. Pick type: price-above / price-below / pct-change-above / pct-change-below
3. Enter threshold + (optional) channels (in-app default ON, browser-notification opt-in)
4. Save → backend stores in `alerts` table → poller now watches it
5. Threshold crossed → backend writes `alert_events` row, broadcasts WebSocket message
6. Client receives → toast appears, bell badge increments, browser notification fires (if permitted), optional sound

## Add-ticker flow

1. User clicks `+ Add` card OR top-bar "Add ticker" button
2. Inline search input opens (autocomplete via `/api/symbols/search?q=...`)
3. User picks → ticker added to watchlist, immediate one-shot poll fetches initial data, card renders
4. Drag-to-reorder among existing cards (persists `sort_order`)

## Connection states (top-bar dot)

| State | Color | Meaning |
|-------|-------|---------|
| connected | green | WebSocket open, prices live |
| reconnecting | amber | Lost connection, retrying with exponential backoff |
| stale | red | No update in last 30s × poll-interval; showing cached data |
| paused | grey | Browser tab inactive — poll throttled to 1/min |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus add-ticker search |
| `g h` | Go to dashboard |
| `g a` | Go to alerts |
| `g s` | Go to settings |
| `t` | Toggle theme |
| `Esc` | Close any modal |
| `?` | Show shortcut reference |
