// Stock-analysis reports: read markdown files from data/stock-reports/,
// parse them with reportParser, and expose them via REST.
//
// Filename convention: YYYY-MM-DD.md
//
// Endpoints:
//   GET /api/reports/stock-analysis           — list available dates (newest first)
//   GET /api/reports/stock-analysis/:date     — parsed report for that date
//   GET /api/reports/stock-analysis/:date/raw — original markdown
//
// Auth: shares authMiddleware with the rest of the API. NO_AUTH bypass is
// already handled by authMiddleware itself.

import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { authMiddleware } from '../middleware/auth';
import { parseReport } from '../services/reportParser';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

const REPORTS_DIR =
  process.env.STOCK_REPORTS_DIR ||
  path.resolve(__dirname, '..', '..', '..', 'data', 'stock-reports');

const DATE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

async function listDates(): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(REPORTS_DIR);
  } catch {
    return [];
  }
  return entries
    .map((e) => DATE_RE.exec(e)?.[1])
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse(); // newest first
}

reportsRouter.get('/stock-analysis', async (_req, res) => {
  const dates = await listDates();
  res.json({ success: true, data: { dates } });
});

reportsRouter.get('/stock-analysis/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(`${date}.md`)) {
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
  }
  const filePath = path.join(REPORTS_DIR, `${date}.md`);
  let markdown: string;
  try {
    markdown = await fs.readFile(filePath, 'utf8');
  } catch {
    return res.status(404).json({ success: false, error: `No report for ${date}` });
  }
  const parsed = parseReport(markdown);
  // Adjacent dates so the client can build prev/next without a second round-trip
  const all = await listDates();
  const idx = all.indexOf(date);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  res.json({
    success: true,
    data: {
      report: parsed,
      nav: { newer, older, all },
    },
  });
});

reportsRouter.get('/stock-analysis/:date/raw', async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(`${date}.md`)) {
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
  }
  const filePath = path.join(REPORTS_DIR, `${date}.md`);
  try {
    const md = await fs.readFile(filePath, 'utf8');
    res.type('text/markdown').send(md);
  } catch {
    res.status(404).json({ success: false, error: `No report for ${date}` });
  }
});
