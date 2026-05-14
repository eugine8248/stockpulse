# Project Requirements — stockpulse

**Date:** 2026-05-14
**Mode:** Auto
**Author:** Requirements Gatherer (auto-mode decisions documented)

---

## 1. Project Purpose
A personalised stock dashboard for tracking a watchlist of tickers in real-time
with custom price/percent-change alerts. Localhost-first; deployable later.

### Success criteria
- User can add a ticker to their watchlist and see its price update within 5 s
- User can set a price-threshold or %-change alert and get notified when it triggers
- Dashboard renders at 60 fps with 50 tickers in the watchlist

---

## 2. Target Users
Single-user-per-instance by default (you, the operator). Email/password auth
included for multi-device or shared-instance use. Designed for active traders,
crypto/equity hobbyists, finance-curious devs.

---

## 3. Target Platforms
Modern web browsers (Chrome / Firefox / Safari / Edge — last 2 versions),
desktop-first. Mobile browser views are read-only acceptable; ticker management
on mobile is best-effort.

---

## 4. Core Features

### Must-Have (v1)
| | Feature | Notes |
|---|---------|-------|
| ✅ | **Watchlist** | Add/remove tickers (search by symbol); reorder by drag |
| ✅ | **Real-time prices** | Backend polls Yahoo Finance every 5 s, pushes via WebSocket; clients update instantly. Polling cadence is per-watchlist (not per-client) |
| ✅ | **Per-ticker card** | Symbol · Company name · Current price · Day change ($) · Day change (%) · Sparkline (intraday) · Volume |
| ✅ | **Detail view** | Click a card → modal with full intraday chart (Recharts) · 1d / 5d / 1mo / 3mo / 1y range chips · key stats (open, high, low, prev close, market cap, P/E) |
| ✅ | **Custom alerts** | Per ticker: price-above / price-below threshold; %-change-above / %-change-below (intraday). Alert evaluated on every poll cycle. |
| ✅ | **Alert notifications** | Three channels: in-app toast, persistent alert-history pane, browser Notification API (with permission prompt) |
| ✅ | **Auth** | Email/password (JWT). On first launch, no users exist → "create the admin user" flow. Optional `NO_AUTH=true` env for single-user local mode. |
| ✅ | **Dark theme default + light toggle** | Markets/finance feel calls for dark default |
| ✅ | **Settings page** | API source selector (Yahoo default / Polygon with key), poll interval, theme, alert sound on/off |

### Nice-to-Have (v2 backlog)
- Multi-watchlist (group tickers into named lists)
- Backtesting alerts against historical data
- Email/SMS alerts (via SMTP or Twilio)
- Portfolio tracking (cost basis, P&L)
- Export to CSV / Google Sheets
- Crypto support
- Light/dark theme follows OS preference

### Out of Scope (v1)
- Order placement / brokerage integration
- News feed (could be v2)
- Native mobile apps

---

## 5. Tech Stack

### Frontend
- **React 18 + Vite + TypeScript + TailwindCSS**
- **React Router v6** for routing (`/login`, `/`, `/settings`, `/alerts`)
- **Recharts** for sparklines + intraday line chart
- **TanStack Query** for REST queries
- **Zustand** for client state (current watchlist sort, selected ticker, theme)
- **React-hook-form + Zod** for forms (login, add-ticker, alert-create)
- **lucide-react** icons
- WebSocket client (native `WebSocket` API) — pushes prices into TanStack Query cache

### Backend
- **Node.js 20 LTS + Express + TypeScript**
- **ws** for WebSocket server
- **Prisma** ORM
- **JWT + bcryptjs**
- **node-fetch** (or native `fetch` in Node 20) for Yahoo / Polygon calls
- Background poller (single setInterval loop per ticker set) — reuses one HTTP connection

### Database
- **SQLite** via Prisma — file at `/data/stockpulse.db` inside the container,
  bind-mounted to host so data persists across restarts

### Containerization
- **Docker + docker-compose** with two services:
  - `app` — combined web + api (Vite-built static served by Express)
  - SQLite is a volume-mounted file, no separate DB service needed
- One-command run: `docker compose up -d`
- Default port: 3000 (Express + static; WebSocket on `/ws`)

---

## 6. Phases
Default: `Discovery → Design → Build → QA → Deploy`

---

## 7. Design Preferences
**Dark default, modern finance aesthetic** — think Bloomberg / Robinhood lite.
- Background: deep slate (`#0e1116`), surface (`#161a21`), elevated (`#1d222b`)
- Primary text: `#e6e9ef`, secondary `#8b95a5`, faint `#5a6374`
- Accent (data-positive / up): `#5fcf95` (green)
- Accent (data-negative / down): `#f0716a` (red)
- Accent (UI primary): `#5b8def` (cool blue) — buttons, selection
- Borders: `#262c36`
- Font: Inter for UI, JetBrains Mono for prices/symbols

Light theme is a toggleable variant with mirrored brightness; same accent hues.

---

## 8. Connectivity
Online for price polling. Offline mode shows last cached prices with a "stale"
indicator; alerts pause.

---

## 9. File System Access
None on client side. Server writes SQLite file + small log file.

---

## 10. OS Integration
- Browser Notification API (with explicit permission flow)
- Optional sound for alert (small WAV played via Web Audio API)

---

## 11. Auto-Update
Web app — users get latest deployed version. No app-side update mechanism.

---

## 12. Local Database

SQLite. Schema:

| Table | Purpose |
|-------|---------|
| `users` | id, email, password_hash, name, created_at |
| `watchlist_items` | id, user_id, symbol, sort_order, added_at |
| `alerts` | id, user_id, symbol, type (price_above/price_below/pct_change_above/pct_change_below), threshold (real), enabled (bool), notify_channels (JSON), created_at |
| `alert_events` | id, alert_id, triggered_at, observed_value, message — alert history |
| `app_settings` | key (PK), value — singleton config (per-user later if multi-user matters) |

Indexes on `watchlist_items.user_id`, `alerts.user_id`, `alerts.symbol`.

---

## 13. External APIs

### Yahoo Finance (default, no key)
- `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1m&range=1d` — intraday + current price
- `https://query2.finance.yahoo.com/v7/finance/quote?symbols={CSV}` — batched current quote (reduces requests for big watchlists)
- Add `User-Agent: Mozilla/5.0` header to avoid 403

### Polygon.io (optional, requires user key)
- `https://api.polygon.io/v2/last/trade/{SYMBOL}?apiKey=...`
- WebSocket streaming available on paid tiers — v1 uses REST polling only

User picks data source in Settings; Polygon key stored encrypted in
`app_settings.polygon_key` (encrypted with derived key from JWT secret).

---

## 14. Authentication
- **Email/password:** bcryptjs hashed; JWT 7-day expiry in `localStorage`
- **First-launch flow:** no users exist → "Create admin account" page on first visit
- **NO_AUTH mode:** if env `NO_AUTH=true`, all routes treat user as id=1 (auto-create on first request); skip login page entirely
- WebSocket auth: client sends JWT in initial connection message; server validates before subscribing to ticker updates

---

## 15. Deployment & Distribution
- **Local first:** `docker compose up -d` runs everything; visit `http://localhost:3000`
- **GitHub:** push source to `eugine8248/stockpulse` after Build complete
- **Production:** YOU will provide deploy instructions later
- README documents env vars (`JWT_SECRET`, optional `POLYGON_API_KEY`, `NO_AUTH`, `POLL_INTERVAL_MS`)

---

## 16. Performance Constraints

| | Target |
|---|---|
| Watchlist size | up to **50 tickers** smoothly |
| Poll cadence | **5 s** (configurable 2–60 s) |
| Yahoo request batching | Up to 50 symbols per `quote?symbols=` call |
| Alert eval per poll | < 50 ms even with 200 active alerts |
| Page load | < 1.5 s on cached repeat visit |
| WebSocket latency client→render | < 200 ms |

---

## Engineering Notes Surfaced for Downstream Specialists

- **Polling architecture:** ONE backend setInterval loop per active user-set; broadcasts via WebSocket rooms (one room per user_id). Clients subscribe to their own room on connect. New ticker added → immediate one-shot poll for it, then folded into the next batch.
- **Alert evaluation:** runs after each poll. Loads `alerts WHERE enabled=true AND symbol IN (last_poll_symbols)`. For each alert that crosses threshold (and wasn't already triggered in last N minutes — debounce), insert `alert_events` row + emit WebSocket message + send Notification API push.
- **Yahoo rate limits:** unofficial API, not documented. Pragmatic ceiling: 2 polls/sec per IP. With 5s cadence and batched quote, we can support hundreds of tickers per instance.
- **NO_AUTH mode:** for personal use behind firewall — simplest UX, no login. README documents the security caveat.
- **Sparkline data:** the chart endpoint returns 1-min bars for 1d. Cache per-symbol on backend with 60s TTL to reduce repeat work; clients pull via REST on demand.
- **Browser Notifications:** request permission lazily on first alert-create, not on first page load (avoids the bad-UX immediate prompt).
