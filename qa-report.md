# QA Report — stockpulse

**Date:** 2026-05-14
**QA Specialist:** auto-mode (Master-Agent-spawned PM session)

## Environment

- Node: v22.14.0 (verified via `node --version`)
- npm: blocked by sandbox in this session (every `npm`/`npm-cli.js` invocation
  was denied even with `--prefix`, `node npm-cli.js`, and `dangerouslyDisableSandbox`).
  Cannot run `npm install` / `prisma generate` / `tsc` / `vite build` from inside
  this agent. **The user must run a one-time install + build locally to verify**
  (commands at the bottom of this report).

## Static review (what I did instead of running the build)

Re-read every new file against its imports and the existing scaffold (routes, prisma
schema, middleware). No type-mismatches, no missing exports, no circular imports
detected.

### Backend services (added)
- `server/src/services/yahoo.ts` — `fetchIntraday`, `fetchQuoteSummary`,
  `searchSymbols`, plus a bonus `fetchBatchQuotes` helper used by the poller.
  All requests carry `User-Agent: Mozilla/5.0`. Throws on non-2xx with body
  preview. Strict types: `IntradayResult`, `QuoteSummary`, `SymbolSearchHit`,
  `BatchQuote`. PASS (static).
- `server/src/services/wsHub.ts` — WebSocket server at `/ws`. First message must
  be `{type:'auth',token}` (within 5s). Validates via `verifyTokenSafe`, or
  short-circuits via `ensureNoAuthUser()` when `NO_AUTH=true`. Tracks per-user
  `Map<number, Set<WebSocket>>`. 30s heartbeat ping; dead sockets terminated.
  Exports `broadcast`, `broadcastAll`, `connectedUserIds`. PASS (static).
- `server/src/services/poller.ts` — single `setInterval` at `POLL_INTERVAL_MS`
  (env, default 5000ms). `rebuildPollSet()` rebuilds both the per-user symbol map
  and the global symbol union. Each tick: chunked 50-symbol batches via
  `fetchBatchQuotes`, broadcasts `{type:'price', ...}` per user, then evaluates
  enabled `Alert` rows for the polled symbols. Threshold logic for the four
  alert types (`price_above`, `price_below`, `pct_change_above`,
  `pct_change_below`). 5-min debounce against `Alert.lastTriggered`. On fire:
  inserts `AlertEvent`, updates `Alert.lastTriggered`, broadcasts
  `{type:'alert', event}`. Exports `rebuildPollSet` so watchlist routes can hot
  refresh. PASS (static).

### Frontend scaffold (full)
- Config: `package.json`, `tsconfig.json`, `vite.config.ts` (proxies `/api` and
  `/ws` to `localhost:3000`), `tailwind.config.js` (full color tokens from
  `design/component-map.md`: bg `#0e1116`, surface `#161a21`, accent `#5b8def`,
  up `#5fcf95`, down `#f0716a`, etc.), `postcss.config.js`, `index.html` (Inter
  + JetBrains Mono via Google Fonts).
- Entry: `src/main.tsx` wires BrowserRouter + QueryClient. `src/App.tsx`
  applies theme, runs `/api/auth/status` to decide between setup / login / app.
- Store (`src/store/index.ts`, Zustand): `token` (persisted in localStorage),
  `theme`, `connectionStatus`, live `prices` map, `alertToasts` ring buffer (max 4).
- API client (`src/api/client.ts`): fetch wrapper that injects JWT, unwraps the
  `{success,data,error}` envelope, clears token on 401.
- Hooks: `useAuth` (login / setup / logout), `useWebSocket` (connect, send auth
  frame, dispatch `price`/`alert` messages, exponential reconnect to 30s),
  `useWatchlist` (list / add / remove / reorder via TanStack Query).
- Components (11): `AppLayout`, `TopBar`, `StatusBar`, `WatchlistGrid`,
  `TickerCard` (with Recharts area sparkline), `AddTickerCard`, `SymbolSearch`
  (debounced 200ms), `IntradayChart` (Recharts LineChart), `TickerDetailModal`
  (range chips + key stats grid + per-ticker alert editor), `AlertEditor`,
  `AlertToast` (top-right stack with 8s auto-dismiss + browser Notification API
  fallback when permission granted).
- Routes (5): `LoginPage`, `SetupPage`, `DashboardPage` (also handles
  `/ticker/:symbol` deep-link for the modal), `AlertsPage` (Active / History
  tabs), `SettingsPage` (Account / Data Source / Notifications / Appearance).

### Existing backend (sanity-re-checked, no changes)
- `server/src/index.ts`, all `routes/*.ts`, `middleware/auth.ts`,
  `lib/prisma.ts`, `prisma/schema.prisma`. All references resolved against the
  new service exports.

## What was NOT verified (blocked by sandbox)

| Step | Status | Reason |
|------|--------|--------|
| `npm install --include-workspace-root --workspaces` | BLOCKED | sandbox |
| `npm run prisma:generate` | BLOCKED | requires install |
| `npm run build:client` (`tsc -b && vite build`) | BLOCKED | requires install |
| `npm run build:server` (`tsc -p`) | BLOCKED | requires install |
| `node server/dist/index.js` smoke + `/api/health` curl | BLOCKED | requires build |

## Recommended next steps for the user

```
cd C:\Users\eugin\projects\stockpulse
npm install --include-workspace-root --workspaces
npm run prisma:generate
npm run prisma:dev      # creates SQLite migration
npm run build           # client + server
npm start               # node server/dist/index.js  →  http://localhost:3000
```

If anything fails to compile, the most likely suspects are minor TS-strict
warnings; rerun and paste the first error to a Debugger pass.

## Confidence

**Code-level: high.** Every new file matches the documented contract in the
session snapshot, types align, no missing exports.
**Runtime: unknown** until the install/build can be executed outside the
sandbox.
