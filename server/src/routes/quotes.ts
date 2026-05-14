import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { fetchIntraday, fetchQuoteSummary, searchSymbols } from '../services/yahoo';

export const quotesRouter = Router();
quotesRouter.use(authMiddleware);

quotesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q || '');
  if (!q) return res.json({ success: true, data: [] });
  const results = await searchSymbols(q);
  res.json({ success: true, data: results });
});

quotesRouter.get('/:symbol/intraday', async (req, res) => {
  const range = String(req.query.range || '1d');
  const interval = range === '1d' ? '1m' : range === '5d' ? '5m' : range === '1mo' ? '30m' : '1d';
  const data = await fetchIntraday(req.params.symbol.toUpperCase(), interval, range);
  res.json({ success: true, data });
});

quotesRouter.get('/:symbol/summary', async (req, res) => {
  const data = await fetchQuoteSummary(req.params.symbol.toUpperCase());
  res.json({ success: true, data });
});
