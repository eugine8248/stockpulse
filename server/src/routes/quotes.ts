import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  fetchIntraday,
  fetchQuoteSummary,
  searchSymbols,
} from '../services/yahoo';
import { getScoresForTicker } from '../services/scoreStore';

export const quotesRouter = Router();
quotesRouter.use(authMiddleware);

// Yahoo Finance is an unofficial / unstable upstream. It can return 401
// (Invalid Crumb when their cookie scheme rotates), 429, or just hang.
// Wrap every handler so a single upstream failure surfaces as a clean
// 502 instead of an unhandled rejection that crashes the Node process.

quotesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q || '');
  if (!q) return res.json({ success: true, data: [] });
  try {
    const results = await searchSymbols(q);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error('[quotes/search] upstream error:', e?.message ?? e);
    res.status(502).json({ success: false, error: 'Symbol search service unavailable' });
  }
});

quotesRouter.get('/:symbol/intraday', async (req, res) => {
  const range = String(req.query.range || '1d');
  const interval = range === '1d' ? '1m' : range === '5d' ? '5m' : range === '1mo' ? '30m' : '1d';
  try {
    const data = await fetchIntraday(req.params.symbol.toUpperCase(), interval, range);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[quotes/intraday] upstream error:', e?.message ?? e);
    res.status(502).json({ success: false, error: 'Intraday quote service unavailable' });
  }
});

quotesRouter.get('/:symbol/summary', async (req, res) => {
  try {
    const data = await fetchQuoteSummary(req.params.symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[quotes/summary] upstream error:', e?.message ?? e);
    res.status(502).json({ success: false, error: 'Quote summary service unavailable' });
  }
});

// --- TradingView-style candle endpoint (v1.0.0) ----------------------------
//
// Maps a friendly `timeframe` token to the Yahoo (interval, range) pair that
// produces a sensible amount of bars for that horizon. We accept the raw
// (interval,range) too for power users, but the timeframe shortcut is the
// canonical path the chart uses.
//
// In-memory LRU cache by (ticker, interval, range), TTL 5 minutes. Yahoo
// blocks UA-less requests and rate-limits aggressively when the same
// (ticker, interval, range) is fetched hundreds of times per minute by a
// shared front-end. 5 minutes is fine for end-of-day candles and tolerable
// for intraday — the front-end auto-refreshes finer-grained slots more often
// via the /latest endpoint anyway.

interface CandleBar {
  time: number; // unix seconds — Lightweight Charts format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlePayload {
  ticker: string;
  interval: string;
  range: string;
  timeframe?: string;
  currency: string | null;
  exchangeName: string | null;
  previousClose: number | null;
  candles: CandleBar[];
}

interface CacheEntry {
  expiresAt: number;
  payload: CandlePayload;
}

const CANDLE_CACHE = new Map<string, CacheEntry>();
const CANDLE_TTL_MS = 5 * 60 * 1000;
const CANDLE_CACHE_MAX = 200;

const TIMEFRAME_MAP: Record<string, { interval: string; range: string }> = {
  '1D':  { interval: '5m',  range: '1d'  },
  '5D':  { interval: '15m', range: '5d'  },
  '1M':  { interval: '1h',  range: '1mo' },
  '3M':  { interval: '1d',  range: '3mo' },
  '6M':  { interval: '1d',  range: '6mo' },
  '1Y':  { interval: '1d',  range: '1y'  },
  '5Y':  { interval: '1wk', range: '5y'  },
  'MAX': { interval: '1mo', range: 'max' },
};

// Yahoo accepts these for `interval` and `range` directly. We accept either
// the friendly timeframe shortcut OR a raw pair; if both are passed the
// timeframe wins.
const ALLOWED_INTERVALS = new Set([
  '1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo',
]);
const ALLOWED_RANGES = new Set([
  '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max',
]);

// Ticker validator — supports US tickers (AAPL), KLSE suffix (1155.KL),
// dotted indices (^GSPC), futures (=F), and short Korean ones. Length 1–12.
const TICKER_RE = /^[A-Z0-9.^=-]{1,12}$/;
const tickerSchema = z.string().transform((s) => s.toUpperCase()).pipe(z.string().regex(TICKER_RE));

function cacheGet(key: string): CandlePayload | null {
  const hit = CANDLE_CACHE.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    CANDLE_CACHE.delete(key);
    return null;
  }
  // Touch on hit for naive LRU semantics — re-insert at the back of the map.
  CANDLE_CACHE.delete(key);
  CANDLE_CACHE.set(key, hit);
  return hit.payload;
}

function cacheSet(key: string, payload: CandlePayload): void {
  CANDLE_CACHE.set(key, { expiresAt: Date.now() + CANDLE_TTL_MS, payload });
  if (CANDLE_CACHE.size > CANDLE_CACHE_MAX) {
    // Drop the oldest entry — Map preserves insertion order.
    const oldestKey = CANDLE_CACHE.keys().next().value;
    if (oldestKey !== undefined) CANDLE_CACHE.delete(oldestKey);
  }
}

async function withYahooBackoff<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [0, 1000, 2000, 4000];
  let lastErr: unknown;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      // Only retry on transient errors. 4xx (other than 429) is permanent.
      if (!/Yahoo 429/i.test(msg) && !/Yahoo 5\d\d/i.test(msg) && !/ETIMEDOUT|ECONNRESET/i.test(msg)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

quotesRouter.get('/:symbol/candles', async (req, res) => {
  // Parse ticker.
  const tickerParse = tickerSchema.safeParse(req.params.symbol);
  if (!tickerParse.success) {
    return res.status(400).json({ success: false, error: 'Invalid ticker format' });
  }
  const ticker = tickerParse.data;

  // Resolve interval + range, preferring `timeframe` if present.
  let interval: string;
  let range: string;
  const tfRaw = req.query.timeframe ? String(req.query.timeframe).toUpperCase() : '';
  if (tfRaw && TIMEFRAME_MAP[tfRaw]) {
    interval = TIMEFRAME_MAP[tfRaw].interval;
    range = TIMEFRAME_MAP[tfRaw].range;
  } else {
    interval = String(req.query.interval || '1d');
    range = String(req.query.range || '3mo');
    if (!ALLOWED_INTERVALS.has(interval) || !ALLOWED_RANGES.has(range)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval/range. Use ?timeframe=3M or pass allowed pair.',
      });
    }
  }

  const cacheKey = `${ticker}|${interval}|${range}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return res.json({ success: true, data: { ...cached, timeframe: tfRaw || undefined } });
  }

  try {
    const result = await withYahooBackoff(() => fetchIntraday(ticker, interval, range));
    // Filter null bars — Yahoo emits gaps (holidays, missing prints) as nulls
    // in the parallel arrays. Lightweight Charts requires non-null OHLC.
    const candles: CandleBar[] = result.bars
      .filter(
        (b) =>
          b.open != null &&
          b.high != null &&
          b.low != null &&
          b.close != null &&
          b.ts != null,
      )
      .map((b) => ({
        time: b.ts,
        open: b.open as number,
        high: b.high as number,
        low: b.low as number,
        close: b.close as number,
        volume: b.volume ?? 0,
      }));

    const payload: CandlePayload = {
      ticker: result.symbol,
      interval,
      range,
      timeframe: tfRaw || undefined,
      currency: result.currency,
      exchangeName: result.exchangeName,
      previousClose: result.previousClose,
      candles,
    };
    cacheSet(cacheKey, payload);
    res.json({ success: true, data: payload });
  } catch (e: any) {
    console.error('[quotes/candles] upstream error:', e?.message ?? e);
    res.status(502).json({ success: false, error: 'Candle service unavailable' });
  }
});

// --- /latest — quick snapshot for auto-refresh (10s cache). ---------------
interface LatestPayload {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  longName: string | null;
  ts: number;
}

const LATEST_CACHE = new Map<string, { expiresAt: number; payload: LatestPayload }>();
const LATEST_TTL_MS = 10 * 1000;

quotesRouter.get('/:symbol/latest', async (req, res) => {
  const tickerParse = tickerSchema.safeParse(req.params.symbol);
  if (!tickerParse.success) {
    return res.status(400).json({ success: false, error: 'Invalid ticker format' });
  }
  const ticker = tickerParse.data;
  const hit = LATEST_CACHE.get(ticker);
  if (hit && hit.expiresAt > Date.now()) {
    return res.json({ success: true, data: hit.payload });
  }
  try {
    const s = await fetchQuoteSummary(ticker);
    const payload: LatestPayload = {
      ticker,
      price: s.regularMarketPrice,
      change: s.regularMarketChange,
      changePct: s.regularMarketChangePercent,
      previousClose: s.regularMarketPreviousClose,
      open: s.regularMarketOpen,
      high: s.regularMarketDayHigh,
      low: s.regularMarketDayLow,
      volume: s.regularMarketVolume,
      longName: s.longName ?? s.shortName,
      ts: Date.now(),
    };
    LATEST_CACHE.set(ticker, { expiresAt: Date.now() + LATEST_TTL_MS, payload });
    res.json({ success: true, data: payload });
  } catch (e: any) {
    console.error('[quotes/latest] upstream error:', e?.message ?? e);
    res.status(502).json({ success: false, error: 'Latest quote service unavailable' });
  }
});

// --- /scores — DailyScore rows for the verdict-marker overlay (v1.1.0). ---
//
// Returns the parsed cron-analysis rows for a ticker within a rolling window,
// oldest first. Used by TickerChart's setMarkers() overlay. The window is
// expressed in the same vocabulary as the candle range so the markers always
// land inside the visible price domain.

const SCORE_WINDOW_MS: Record<string, number> = {
  '1d': 1 * 24 * 60 * 60 * 1000,
  '5d': 7 * 24 * 60 * 60 * 1000,
  '1mo': 31 * 24 * 60 * 60 * 1000,
  '3mo': 93 * 24 * 60 * 60 * 1000,
  '6mo': 186 * 24 * 60 * 60 * 1000,
  '1y': 366 * 24 * 60 * 60 * 1000,
  '2y': 2 * 366 * 24 * 60 * 60 * 1000,
  '5y': 5 * 366 * 24 * 60 * 60 * 1000,
  'max': 100 * 366 * 24 * 60 * 60 * 1000,
};

quotesRouter.get('/:symbol/scores', async (req, res) => {
  const tickerParse = tickerSchema.safeParse(req.params.symbol);
  if (!tickerParse.success) {
    return res.status(400).json({ success: false, error: 'Invalid ticker format' });
  }
  const ticker = tickerParse.data;
  const range = String(req.query.range || '1y').toLowerCase();
  const fromMs = Date.now() - (SCORE_WINDOW_MS[range] ?? SCORE_WINDOW_MS['1y']);
  try {
    const rows = await getScoresForTicker(ticker, new Date(fromMs));
    res.json({ success: true, data: { ticker, range, scores: rows } });
  } catch (e: any) {
    console.error('[quotes/scores] error:', e?.message ?? e);
    res.status(500).json({ success: false, error: 'Score fetch failed' });
  }
});
