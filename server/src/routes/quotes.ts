import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { fetchIntraday, fetchQuoteSummary, searchSymbols } from '../services/yahoo';

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
