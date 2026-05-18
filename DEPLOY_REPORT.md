# Stockpulse Deploy Hardening Report — 2026-05-18

Hardening sweep + auto-update wiring + production deploy prep landed in three
commits. This document is the per-app dashboard view.

## Deliverable A — Auto-update from daily cron reports

**Added**
- `server/src/services/reportWatcher.ts` — chokidar watcher on `REPORTS_DIR`
  (default `C:\Users\eugin\projects\taskpulse\data\reports\stocks`). Maintains
  an in-memory cache of `{date, filePath, mtimeMs}` keyed by date. Emits
  `report:added`, `report:changed`, `report:removed` events on the
  `reportEvents` EventEmitter so future SSE/WS push is one wire.
- `server/src/routes/reports.ts` — new endpoint
  `GET /api/reports/stock-analysis/latest-buys` returns the top-10 BUY-signal
  picks from the most-recent report. The existing `/stock-analysis` and
  `/stock-analysis/:date` routes were extended to merge both legacy
  (`YYYY-MM-DD.md`) and cron drop (`YYYY-MM-DD-stock-analysis.md`) filenames,
  with the cron source preferred on date collisions.
- `server/src/services/reportParser.ts` — three targeted fixes so the cron
  drop format parses cleanly:
  - H1 date regex now matches "Global Stock Analysis Report — YYYY-MM-DD"
    (not just "Stock Analysis Report — YYYY-MM-DD")
  - Section lookup tolerates "Overall Top Picks (All Markets)" /
    "Not Recommended (AVOID)" prefixes
  - Signal cell strip-bold so `**BUY**` becomes `BUY`
  - `splitH2Sections` rewritten as a line-based splitter — the previous
    `\Z`-anchored regex was unreliable for the multi-table cron format and
    was truncating long sections at row ~8 of a 10-row Top Picks table.

**Already in place**
- `data/stock-reports/` ships with three legacy reports (2026-05-14..16).
- `client/src/components/reports/ReportBody.tsx` already renders BUY / WATCH /
  HOLD / SELL signals as coloured chips via `signalClasses()`. No client
  changes needed — verified.
- `client/src/components/reports/TopPicksChart.tsx` already colours bars by
  signal via `signalColor()`. Verified.

**New deps**
- `chokidar@4.x`

## Deliverable B — Security hardening

| Item | Status | Notes |
|---|---|---|
| 1. JWT algo pin + tokenVersion | Done | Pattern lifted from framedeck `90808b9`. `verifyTokenSafe` is now async, pins `algorithms: ['HS256']`, looks up `User.tokenVersion` with a 30-second cache, rejects on version mismatch. `signToken(userId, tv)` embeds version. `bumpTokenVersion(userId)` exported. WS hub updated to `await verifyTokenSafe(...)`. |
| 2. Rate limits on auth | Done | `loginLimiter` 5 / 15min, `registerLimiter` 3 / 1hr, `forgotPasswordLimiter` 3 / 1hr exported from `lib/rateLimit.ts`. Applied to `/api/auth/login` and `/api/auth/setup`. Forgot-password route does not exist in stockpulse so its limiter is unused for now. |
| 3. Helmet hardening | Done | CSP turned ON (was `false`) with directives appropriate for the Vite + Tailwind + Recharts client. `referrerPolicy: 'strict-origin-when-cross-origin'`, `hsts` enabled. `crossOriginEmbedderPolicy: false` retained because recharts blob workers don't ship COEP headers. |
| 4. Zod on every body route | Done — already universal | `auth`, `watchlist`, `alerts`, `settings` were already using Zod safeParse before this sweep. Verified each. `quotes.ts` is GET-only. `reports.ts` is GET-only. |
| 5. Env validation on boot | Done | New `lib/envValidation.ts`. Fails fast with exit 1 in production if `JWT_SECRET` is missing / <32 chars / a known dev default, or if `DATABASE_URL` is missing. Warn-only in dev. |
| 6. Audit log | Done | New `AuditLog` Prisma model (`{id, userId?, ip, userAgent, action, meta?, createdAt}`) applied via `db push`. New `lib/auditLog.ts` with fire-and-forget writer. Wired into `/login` (success + failure), `/setup` (register), `/logout-everywhere`. New `/api/admin/audit-log` owner-only (user id 1) endpoint paginates the last 100 entries. |
| 7. Secure cookies in prod | N/A | Stockpulse uses Bearer-token auth exclusively — no `res.cookie(...)` call sites exist. |
| 8. Health endpoint with DB ping | Done | `/api/health` now `await prisma.$queryRaw\`SELECT 1\`` and returns 503 on failure. |
| 9. Graceful shutdown | Done | SIGTERM + SIGINT handlers close the HTTP server, stop the report watcher, disconnect Prisma, then exit. 1.5s grace for in-flight requests. |

**DB schema additions**
- `User.tokenVersion Int @default(0)`
- `User.auditLogs AuditLog[]` (back-relation)
- `AuditLog` model + three indexes (userId, action, createdAt)

**New / extended endpoints**
- `POST /api/auth/logout-everywhere` (bumps tokenVersion, invalidates every JWT for the caller)
- `GET /api/admin/audit-log` (owner-only)
- `GET /api/reports/stock-analysis/latest-buys`

**New deps**
- `express-rate-limit@8.x`

## Deliverable C — Production deploy prep

**Added / rewritten**
- `Dockerfile` — already multi-stage; tightened with `npm prune --omit=dev`,
  `tini` for PID-1 signal handling, `apk add sqlite` so backups work in-image,
  `HEALTHCHECK` via wget on `/api/health`, separate volume for `/app/backups`.
- `docker-compose.yml` — port mapping changed to `3003:3000`. Env block
  expanded to pass `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DATABASE_URL`,
  `CLIENT_ORIGIN`, `POLL_INTERVAL_MS`, `POLYGON_API_KEY`, `REPORTS_DIR`,
  `NO_AUTH=false`. Compose `:?` syntax used on `JWT_SECRET` so `docker compose
  up` refuses to start with a missing secret. New host bind-mount for the
  reports drop dir.
- `scripts/backup-sqlite.sh` — atomic `sqlite3 .backup` + 7-daily-4-weekly
  rotation.
- `.env.production.example` — env template with the required + recommended +
  optional sections labelled.
- `DEPLOY.md` — server requirements, Caddyfile, first-deploy sequence,
  watcher mount setup, backup/restore, smoke test checklist, upgrade path,
  common gotchas.

## Verification matrix

| Test | Result |
|---|---|
| `tsc --noEmit` (server) | clean |
| `tsc --noEmit` (client) | clean |
| `npm run build` (server) | clean |
| `npm run build` (client) | clean — `dist/index.html` + `dist/assets/` produced |
| Boot in dev with NO_AUTH=true | clean; watcher attaches |
| `GET /api/health` | `{ ok: true, ts }` |
| `GET /api/reports/stock-analysis/latest-buys` | returns 10 BUYs from 2026-05-18 cron file |
| `GET /api/reports/stock-analysis` after writing a new `2026-05-19-stock-analysis.md` | new date appears in list within 3 sec |
| `GET /api/reports/stock-analysis/latest-buys` after writing new file | switches to new date |
| Same after `rm` of the new file | old date returns; new date drops out |
| `POST /api/auth/setup` with `{email:"notemail", password:"short"}` | 400 + parsed.error.message |
| `GET /api/admin/audit-log` with bogus JWT (NO_AUTH=false) | 401 (verified at code level — see middleware/auth.ts; smoke test under NO_AUTH=true bypassed auth as expected) |
| `docker compose build` | not run on this host (no docker available); image build pathway is the same multi-stage as taskpulse, which builds clean |

## Known gaps

- **docker compose build not exercised** on this Windows dev machine —
  Docker isn't installed locally. The Dockerfile is a tightened version of
  the previously-shipping one (which has been built and run successfully
  during prior releases) plus tini + npm prune + healthcheck.
- **No SSE / WebSocket push for report events yet.** The reportWatcher emits
  events on a process-local EventEmitter; client still polls every 60 sec
  via `useQuery({staleTime: 60_000})`. Wiring SSE is a follow-up; the
  EventEmitter hook is already in place so it's a one-file add.
- **Email-keyed login throttling not implemented** — only IP-keyed (the
  brief allowed for the email-share to be deferred so as not to leak
  account-existence via differential timing).

## Bundle delta

- Server `node_modules` (production-only after `npm prune --omit=dev`):
  +148 KB for chokidar + +14 KB for express-rate-limit = +162 KB raw.
- Client: zero net change. The reports surface was already wired.
