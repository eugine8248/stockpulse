// Stock-analysis reports: read markdown files from data/stock-reports/
// AND/OR the host-mounted cron drop directory configured by REPORTS_DIR
// (defaults to C:\Users\eugin\projects\taskpulse\data\reports\stocks).
//
// Filename conventions accepted:
//   • YYYY-MM-DD.md                       (legacy local format)
//   • YYYY-MM-DD-stock-analysis.md        (cron drop format, written by the
//                                          Windows TaskpulsePullMorningReports
//                                          scheduled task)
//
// Endpoints:
//   GET /api/reports/stock-analysis            — list available dates (newest first)
//   GET /api/reports/stock-analysis/latest-buys — top BUY-signal tickers from today
//   GET /api/reports/stock-analysis/:date      — parsed report for that date
//   GET /api/reports/stock-analysis/:date/raw  — original markdown
//
// Auth: shares authMiddleware with the rest of the API. NO_AUTH bypass is
// already handled by authMiddleware itself.

import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { authMiddleware } from '../middleware/auth';
import { parseReport } from '../services/reportParser';
import { getLatestReport } from '../services/reportWatcher';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

// Legacy local dir — shipped with the repo, used in dev and as a fallback in prod.
const LEGACY_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'stock-reports');

// Cron drop dir — host-mounted in prod via docker-compose; configurable for
// dev so devs can point at their local taskpulse/data/reports/stocks copy.
export const REPORTS_DIR =
  process.env.REPORTS_DIR ||
  process.env.STOCK_REPORTS_DIR ||
  // Sensible Windows-dev fallback. Prod overrides this via env.
  'C:\\Users\\eugin\\projects\\taskpulse\\data\\reports\\stocks';

const LEGACY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const CRON_FILE_RE = /^(\d{4}-\d{2}-\d{2})-stock-analysis\.md$/;

type SourceKind = 'legacy' | 'cron';

interface ResolvedFile {
  date: string;
  filePath: string;
  source: SourceKind;
}

async function listFilesIn(dir: string, kind: SourceKind): Promise<ResolvedFile[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: ResolvedFile[] = [];
  for (const e of entries) {
    const m = kind === 'legacy' ? LEGACY_FILE_RE.exec(e) : CRON_FILE_RE.exec(e);
    if (!m) continue;
    out.push({ date: m[1], filePath: path.join(dir, e), source: kind });
  }
  return out;
}

async function collectAll(): Promise<ResolvedFile[]> {
  const [legacy, cron] = await Promise.all([
    listFilesIn(LEGACY_DIR, 'legacy'),
    listFilesIn(REPORTS_DIR, 'cron'),
  ]);
  // If a date appears in both, prefer the cron drop (newer, canonical source).
  const byDate = new Map<string, ResolvedFile>();
  for (const f of legacy) byDate.set(f.date, f);
  for (const f of cron) byDate.set(f.date, f);
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

async function listDates(): Promise<string[]> {
  const all = await collectAll();
  return all.map((f) => f.date);
}

async function resolveByDate(date: string): Promise<string | null> {
  const all = await collectAll();
  const hit = all.find((f) => f.date === date);
  return hit ? hit.filePath : null;
}

reportsRouter.get('/stock-analysis', async (_req, res) => {
  const dates = await listDates();
  res.json({ success: true, data: { dates } });
});

// MUST come before /stock-analysis/:date so :date doesn't match "latest-buys".
reportsRouter.get('/stock-analysis/latest-buys', async (_req, res) => {
  try {
    // Prefer the watcher's in-memory pointer (instant, no fs scan); fall back
    // to a full scan if the watcher hasn't yet seen anything.
    const watched = getLatestReport();
    const filePath = watched?.filePath ?? (await (async () => {
      const all = await collectAll();
      return all.length ? all[0].filePath : null;
    })());
    if (!filePath) {
      return res.json({ success: true, data: { date: null, picks: [] } });
    }
    const md = await fs.readFile(filePath, 'utf8');
    const parsed = parseReport(md);
    const buys = parsed.topPicks
      .filter((p) => p.signal.toUpperCase() === 'BUY')
      .slice(0, 10);
    res.json({
      success: true,
      data: { date: parsed.date || watched?.date || null, picks: buys },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[reports/latest-buys] error:', err);
    res.status(500).json({ success: false, error: 'Latest buys fetch failed' });
  }
});

reportsRouter.get('/stock-analysis/:date', async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
  }
  const filePath = await resolveByDate(date);
  if (!filePath) {
    return res.status(404).json({ success: false, error: `No report for ${date}` });
  }
  let markdown: string;
  try {
    markdown = await fs.readFile(filePath, 'utf8');
  } catch {
    return res.status(404).json({ success: false, error: `No report for ${date}` });
  }
  const parsed = parseReport(markdown);
  const all = await listDates();
  const idx = all.indexOf(date);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  res.json({
    success: true,
    data: { report: parsed, nav: { newer, older, all } },
  });
});

reportsRouter.get('/stock-analysis/:date/raw', async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
  }
  const filePath = await resolveByDate(date);
  if (!filePath) {
    return res.status(404).json({ success: false, error: `No report for ${date}` });
  }
  try {
    const md = await fs.readFile(filePath, 'utf8');
    res.type('text/markdown').send(md);
  } catch {
    res.status(404).json({ success: false, error: `No report for ${date}` });
  }
});
