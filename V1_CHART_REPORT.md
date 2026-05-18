# V1 — TradingView chart + daily-cron overlay

Stockpulse now ships with a TradingView-style candle chart and a verdict-marker
overlay sourced from the user's own daily stock-analysis cron. Three commits,
each independently shippable:

- `v1.0.0 — chart core` — Lightweight Charts wrapper, candles + volume,
  timeframe switcher, Yahoo proxy with retry + LRU cache, theme-reactive.
- `v1.1.0 — DailyScore schema + parser + backfill` — Prisma model, tolerant
  markdown parser, idempotent upserts, score endpoint, live watcher hook.
- `v1.2.0 — verdict markers + tooltip + toggle controls + calibration-thin
  indicator` — full visual layer wired to the parsed DailyScore rows.

## Lightweight Charts integration

- **Library:** `lightweight-charts@^5.2.0` — MIT/Apache 2.0, ~45 KB gz from
  TradingView. Added to the client workspace only.
- **Lazy-loaded** via `React.lazy` on the `/ticker/:symbol` route so the
  initial chunk stays at 187 KB gz (budget 350 KB). The chart payload lands
  in its own `TickerChart-*.js` chunk (~58 KB gz).
- **v5 API differences vs v4:**
  - Series construction switched from `addCandlestickSeries()` /
    `addHistogramSeries()` to `addSeries(CandlestickSeries, opts)` /
    `addSeries(HistogramSeries, opts)`.
  - Markers were extracted out of the series API. Instead of
    `series.setMarkers([...])` you now call
    `createSeriesMarkers(series, [])` once and then
    `plugin.setMarkers([...])` to update.
- **Two-pane layout:** the candle series occupies the upper price scale,
  volume is on its own scale `'volume'` with `scaleMargins.top = 0.75` so it
  visually sits in the bottom quarter without colliding with the candles.
- **Theme-reactive:** the chart re-reads `--c-bg`, `--c-surface`,
  `--c-text`, `--c-success`, `--c-error`, `--c-warning`, `--c-accent`,
  `--c-border` + `--c-border-soft` on mount and whenever the
  `useStore(theme)` value changes. Lightweight Charts isn't reactive — we
  destroy + recreate the chart on theme change. The series data is kept in
  React Query, so the re-mount is one frame and feels seamless.

## Yahoo Finance proxy

- **Endpoint:** `GET /api/quotes/:ticker/candles?timeframe=3M` — auth-gated
  via existing `authMiddleware`.
- **Timeframe mapping** (server-side):

  | Timeframe | interval | range |
  |---|---|---|
  | 1D  | `5m`  | `1d`  |
  | 5D  | `15m` | `5d`  |
  | 1M  | `1h`  | `1mo` |
  | 3M  | `1d`  | `3mo` |
  | 6M  | `1d`  | `6mo` |
  | 1Y  | `1d`  | `1y`  |
  | 5Y  | `1wk` | `5y`  |
  | Max | `1mo` | `max` |

- **In-memory LRU cache** keyed `(ticker | interval | range)`, TTL 5 min,
  cap 200 entries. Native `Map` (insertion-order = LRU).
- **Exponential backoff** on Yahoo 429 / 5xx / `ETIMEDOUT`: 0, 1s, 2s, 4s.
  4xx other than 429 fails fast (permanent input errors).
- **UA spoofing:** `Mozilla/5.0` header. Yahoo blocks UA-less requests.
- **Null filtering:** Yahoo emits nulls for missing prints (holidays, gaps);
  these are dropped before the response leaves the server because
  Lightweight Charts rejects null OHLC entries.
- **Ticker validator:** Zod regex `^[A-Z0-9.^=-]{1,12}$` to support `AAPL`,
  `1155.KL`, `^GSPC`, `=F` futures, etc.

Companion endpoints:

- `GET /api/quotes/:ticker/latest` — 10s cache, used by the `/ticker`
  header for live price + change %.
- `GET /api/quotes/:ticker/scores?range=1y` — DailyScore window for the
  verdict-marker overlay (added in v1.1.0).

## DailyScore schema

```
model DailyScore {
  id          Int      @id @default(autoincrement())
  ticker      String   // 'NVDA' | '1155.KL' | '8869.KL' etc.
  date        DateTime
  market      String?
  company     String?
  signal      String   // 'BUY' | 'WATCH' | 'HOLD' | 'AVOID'
  composite   Float
  fundamental Float?
  technical   Float?
  sentiment   Float?
  economyFlow Float?
  keyReason   String?
  flags       String?
  reportPath  String
  ingestedAt  DateTime @default(now())

  @@unique([ticker, date])
  @@index([ticker, date])
  @@index([date, signal])
}
```

Applied via `npx prisma db push --schema=./prisma/schema.prisma`. The
`DATABASE_URL=file:./data/stockpulse.db` env trap is respected because
Prisma resolves the file URL relative to the schema location, putting the
DB at `prisma/data/stockpulse.db` — same path the existing migration uses.

## Parser quirks

The cron format has drifted twice in 14 days. The parser accepts both:

- **Format A** (legacy, 2026-05-17):
  ```
  - **Fundamental:** Score 85 (STRONG). Revenue growing ~77% YoY; ...
  - **Composite: 84.5 — BUY** | *Flags: Earnings risk May 20 ...*
  ```
- **Format B** (current, 2026-05-18):
  ```
  - **Fundamental (85/100):** FY25 net profit RM10.51B (+4.2%) ...
  - **Composite: 80.0 | BUY** | Confidence: HIGH
  - Flags: RSI overbought; May 20 earnings event risk ...
  ```

Key tolerances:

- **Date** — pulled from filename first (`YYYY-MM-DD-stock-analysis.md`),
  falls back to the H1 `# … 2026-05-18` line.
- **Header parser** — accepts the optional `★ BUY` / `★ KLSE TOP PICK`
  suffix on H3 headers and discards it before extracting ticker/company.
- **Composite delimiter** — accepts em-dash, en-dash, pipe, or hyphen.
- **Flag bullet** — accepts italicised inline (`*Flags: …*`) AND the new
  plain-bullet form (`- Flags: …`).
- **Score label** — accepts both `Economy/Flow` and `Economy Flow`.
- **SELL → AVOID** — folded into the canonical 4-signal vocabulary at
  parse time. Reports today don't emit SELL; this is defensive.
- **Malformed blocks** are warned and skipped without failing the file.

KLSE ticker quirk: the cron flips between bare numeric (`5398`) and
suffixed (`5398.KL`) by day. `scoreStore.getScoresForTicker` expands both
variants in the WHERE clause so the verdict overlay stitches the history
together regardless of which form the watchlist uses.

## Backfill summary

`npx tsx scripts/backfill-scores.mjs` against `REPORTS_DIR=taskpulse/data/
reports/stocks` (current cron drop site):

```
[backfill] found 2 files in C:\Users\eugin\projects\taskpulse\data\reports\stocks
  2026-05-17-stock-analysis.md  date=2026-05-17  inserted=35  updated=0  skipped=0
  2026-05-18-stock-analysis.md  date=2026-05-18  inserted=35  updated=0  skipped=0

[backfill] summary:
  files processed:  2/2
  rows inserted:    70
  rows updated:     0
  rows skipped:     0
  warnings:         0
[backfill] DailyScore total rows: 70
```

The plan called for ~14 days of history; only 2 days exist on disk today
(`2026-05-17` and `2026-05-18`). The backfill catches up trivially as
more reports land — the live watcher upserts each new file as it
arrives.

Re-running the script returns `inserted=0, updated=70, skipped=0` —
idempotent.

## Verdict-marker overlay

- **Visual treatment** (Lightweight Charts marker plugin):
  - **BUY**   — `--c-success`  arrowUp **below** the candle
  - **WATCH** — `--c-warning`  circle    **above** the candle
  - **AVOID** — `--c-error`    arrowDown **above** the candle
  - **HOLD**  — no marker (too noisy)
- **Toggle dropdown** (settings cog next to the timeframe switcher):
  - Show verdict markers (default ON if scores exist for this ticker)
  - Only BUY signals
  - Hide WATCH markers
  - Preferences persisted to
    `localStorage["stockpulse.chart.markers.<TICKER>"]`.
- **Hover tooltip** — `subscribeCrosshairMove` watches for the crosshair
  landing on a bar that matches a marker time and emits a tooltip-ready
  payload to the parent. The tooltip renders fixed-position relative to
  the chart container with the date, signal, composite, 4 sub-scores, and
  flag text (truncated to 140 chars).
- **Calibration thin indicator** — when `distinctDays < 14`, a chip shows
  next to the settings cog: `"ⓘ {n}d history — calibration thin"`.
  Tapping reveals an explanation pop-over advising revisiting after 30+
  days.

## Verification checklist

- `/api/quotes/AAPL/candles?timeframe=3M` returns 63 daily candles with
  realistic OHLCV.
- `/api/quotes/NVDA/scores?range=1y` returns the two parsed entries (BUY
  84.5 on 05-17, BUY 80.0 on 05-18).
- `/api/quotes/AAPL/latest` returns a price snapshot under 100ms (cached).
- `/ticker/AAPL` renders the candle + volume chart cleanly in dark + light
  mode; toggling the html `[data-theme]` re-skins the chart.
- Verdict markers appear at the right dates (visually verified on the
  3M timeframe).
- Settings cog shows three toggles; choices persist across reload.
- "Calibration thin" chip surfaces while the cron has < 14 days of
  history; auto-hides once the threshold is crossed.
- TypeScript clean across server + client (`tsc --noEmit`).
- Vite build clean: initial 187 KB gz, TickerChart chunk 58 KB gz.

## Cross-app dashboard note

A short summary section is appended to
`taskpulse/data/reports/framedeck/2026-05-16-v010-pivot-scaffold.md` —
that's the cross-app dashboard the user maintains.
