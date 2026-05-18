// scoreParser — turns a daily stock-analysis markdown report into structured
// DailyScore rows (one per ticker covered by the "Individual Summaries"
// section). Tolerant by design: a malformed ticker block is skipped with a
// warning and the parser keeps going; a missing section returns an empty
// slice rather than throwing.
//
// The cron's markdown format has evolved twice in 14 days, so the parser
// accepts BOTH:
//
//   Format A — "Score 85 (STRONG)" / "Composite: 84.5 — BUY"
//     ### NVDA — NVIDIA (NASDAQ)
//     - **Fundamental:** Score 85 (STRONG). Revenue growing ~77% ...
//     - **Composite: 84.5 — BUY** | *Flags: Earnings risk May 20 ...*
//
//   Format B — "Fundamental (85/100):" / "Composite: 84.5 | BUY"
//     ### NVDA — NVIDIA (NASDAQ)
//     - **Fundamental (85/100):** FY25 net profit ...
//     - **Composite: 80.0 | BUY** | Confidence: HIGH
//     - Flags: RSI overbought; May 20 earnings event risk ...
//
// We pull the four analyst scores (fundamental, technical, sentiment,
// economyFlow), the composite + signal, and the flags string. The Top Picks
// table — when present — provides `keyReason` and the market column.

import fs from 'fs';
import path from 'path';

export interface ParsedScore {
  ticker: string;
  date: string;          // YYYY-MM-DD
  market: string | null;
  company: string | null;
  signal: string;
  composite: number;
  fundamental: number | null;
  technical: number | null;
  sentiment: number | null;
  economyFlow: number | null;
  keyReason: string | null;
  flags: string | null;
  reportPath: string;
}

interface TopPickRow {
  ticker: string;
  company: string | null;
  market: string | null;
  keyReason: string | null;
}

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-stock-analysis\.md$/i;
const H1_DATE_RE = /^#\s+.*?(\d{4}-\d{2}-\d{2})\s*$/m;

export function parseReportFile(filePath: string): {
  date: string | null;
  scores: ParsedScore[];
  warnings: string[];
} {
  const md = fs.readFileSync(filePath, 'utf8');
  return parseReportMarkdown(md, filePath);
}

export function parseReportMarkdown(
  md: string,
  filePath: string,
): { date: string | null; scores: ParsedScore[]; warnings: string[] } {
  const warnings: string[] = [];

  // --- Date resolution: filename takes precedence, H1 is a fallback. ---
  const baseName = path.basename(filePath);
  const fileMatch = FILENAME_RE.exec(baseName);
  const headerMatch = H1_DATE_RE.exec(md);
  const date = fileMatch?.[1] ?? headerMatch?.[1] ?? null;
  if (!date) {
    warnings.push(`[scoreParser] no date in ${baseName}; skipping file`);
    return { date: null, scores: [], warnings };
  }

  // --- Section splitter (H2-driven, CRLF-tolerant). ---
  const sections = splitH2Sections(md);

  // --- Build a lookup of TopPicks rows so we can carry keyReason + market.
  // Several reports ship multiple Top-Picks tables (Overall / KLSE / US).
  // We merge them all, last-write-wins (Overall is usually listed first).
  const topPicks = new Map<string, TopPickRow>();
  for (const [heading, body] of Object.entries(sections)) {
    if (!/top picks/i.test(heading)) continue;
    for (const row of parseTopPicksTable(body)) {
      topPicks.set(normalizeTicker(row.ticker), row);
    }
  }

  // --- Individual Summaries — the per-ticker H3 blocks.
  const indiv = sections['Individual Summaries'] ?? findSectionByPrefix(sections, 'Individual Summaries');
  if (!indiv) {
    warnings.push(`[scoreParser] no Individual Summaries section in ${baseName}`);
    return { date, scores: [], warnings };
  }

  const blocks = splitH3Blocks(indiv);
  const scores: ParsedScore[] = [];
  for (const block of blocks) {
    try {
      const parsed = parseTickerBlock(block, date, filePath, topPicks, warnings);
      if (parsed) scores.push(parsed);
    } catch (err: any) {
      warnings.push(
        `[scoreParser] ${baseName} → block "${block.header.slice(0, 40)}…": ${err?.message ?? err}`,
      );
    }
  }

  return { date, scores, warnings };
}

interface H3Block {
  header: string;
  body: string;
}

function splitH2Sections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = md.split(/\r?\n/);
  let current: string | null = null;
  const buf: Record<string, string[]> = {};
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = h2[1].trim();
      if (!(current in buf)) buf[current] = [];
    } else if (current) {
      buf[current].push(line);
    }
  }
  for (const k of Object.keys(buf)) out[k] = buf[k].join('\n');
  return out;
}

function findSectionByPrefix(
  sections: Record<string, string>,
  prefix: string,
): string | null {
  for (const k of Object.keys(sections)) {
    if (k.toLowerCase().startsWith(prefix.toLowerCase())) return sections[k];
  }
  return null;
}

function splitH3Blocks(section: string): H3Block[] {
  const parts = section.split(/^###\s+/m);
  const out: H3Block[] = [];
  for (const part of parts.slice(1)) {
    const [first, ...rest] = part.split(/\r?\n/);
    out.push({ header: first.trim(), body: rest.join('\n') });
  }
  return out;
}

function parseTopPicksTable(section: string): TopPickRow[] {
  const lines = section.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  const rows = lines.slice(2);
  const out: TopPickRow[] = [];
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;
    // Both shapes for KLSE / US tech / Overall tables put the ticker in
    // column 2 and use slightly different schemas after. We only care about
    // ticker, company, market (if present), and the last cell (keyReason).
    const [ , ticker, company, marketOrPrice, , , keyReason ] = cells;
    if (!ticker) continue;
    // The "Market" column for the Overall table is alphabetic ('NASDAQ').
    // For market-scoped tables it's a price ('5.00' or '~185est'); detect
    // that and null it out.
    const isMarket = /^[A-Za-z]/.test(marketOrPrice ?? '');
    out.push({
      ticker,
      company: company || null,
      market: isMarket ? marketOrPrice : null,
      keyReason: keyReason || null,
    });
  }
  return out;
}

function parseTickerBlock(
  block: H3Block,
  date: string,
  filePath: string,
  topPicks: Map<string, TopPickRow>,
  warnings: string[],
): ParsedScore | null {
  // Header shape: "NVDA — NVIDIA (NASDAQ)" or "NVDA — NVIDIA (NASDAQ) ★ BUY"
  // or "5398 — Gamuda (KLSE) ★ KLSE TOP PICK"
  const headerRe = /^([A-Za-z0-9.^=-]+)\s*[—-]\s*(.+?)(?:\s*\(([^)]+)\))?(?:\s*★.*)?$/;
  const hm = headerRe.exec(block.header);
  if (!hm) {
    warnings.push(`[scoreParser] could not parse header: "${block.header}"`);
    return null;
  }
  const rawTicker = hm[1].trim();
  const company = (hm[2] ?? '').trim() || null;
  const market = (hm[3] ?? '').trim() || null;

  const body = block.body;

  // Try Format A first: "- **Fundamental:** Score 85 (...)"
  // Then Format B: "- **Fundamental (85/100):**"
  const fundamental = extractScore(body, 'Fundamental');
  const technical = extractScore(body, 'Technical');
  const sentiment = extractScore(body, 'Sentiment');
  // Economy/Flow appears as "Economy/Flow" (Format A) or "Economy Flow" (Format B).
  const economyFlow = extractScore(body, 'Economy/Flow') ?? extractScore(body, 'Economy Flow');

  const composite = extractComposite(body);
  if (composite === null) {
    warnings.push(`[scoreParser] no composite line for "${block.header}" — skipping`);
    return null;
  }

  const flags = extractFlags(body);
  const ticker = normalizeTicker(rawTicker);
  const fromTable = topPicks.get(ticker) ?? topPicks.get(rawTicker);

  return {
    ticker,
    date,
    market: market ?? fromTable?.market ?? null,
    company: company ?? fromTable?.company ?? null,
    signal: composite.signal,
    composite: composite.value,
    fundamental,
    technical,
    sentiment,
    economyFlow,
    keyReason: fromTable?.keyReason ?? null,
    flags,
    reportPath: filePath,
  };
}

/**
 * Extract a single analyst score by label, accepting both formats:
 *   - "**Fundamental:** Score 85 (STRONG)."
 *   - "**Fundamental (85/100):**"
 * Returns null if neither pattern matches.
 */
function extractScore(body: string, label: string): number | null {
  // Format B: "**Fundamental (85/100):**"
  const reB = new RegExp(
    `\\*\\*${escapeRegex(label)}\\s*\\((\\d+(?:\\.\\d+)?)\\s*/\\s*100\\)\\s*:\\*\\*`,
    'i',
  );
  const mB = body.match(reB);
  if (mB) return parseFloat(mB[1]);

  // Format A: "**Fundamental:** Score 85"  (number can have a decimal)
  const reA = new RegExp(
    `\\*\\*${escapeRegex(label)}:\\*\\*\\s*Score\\s*(\\d+(?:\\.\\d+)?)`,
    'i',
  );
  const mA = body.match(reA);
  if (mA) return parseFloat(mA[1]);

  return null;
}

/**
 * Composite line accepts both delimiters:
 *   "**Composite: 84.5 — BUY**"
 *   "**Composite: 80.0 | BUY**"
 * Returns the score + signal, or null if neither matched.
 */
function extractComposite(body: string): { value: number; signal: string } | null {
  const re = /\*\*Composite:\s*(\d+(?:\.\d+)?)\s*[—|–-]\s*(BUY|WATCH|HOLD|AVOID|SELL)\*\*/i;
  const m = body.match(re);
  if (!m) return null;
  let signal = m[2].toUpperCase();
  // Normalise SELL → AVOID for the v0.2 schema.
  if (signal === 'SELL') signal = 'AVOID';
  return { value: parseFloat(m[1]), signal };
}

/**
 * Flags accept two shapes:
 *   - `*Flags: ...*` (italicised, inline)
 *   - `- Flags: ...` (plain bullet)
 * Returns the body of the flags string, trimmed.
 */
function extractFlags(body: string): string | null {
  // Italicised inline form.
  const reItal = /\*Flags:\s*([^*]+)\*/i;
  const m1 = body.match(reItal);
  if (m1) return m1[1].trim();

  // Plain-bullet form. Stop at the next bullet or blank line.
  const reBullet = /^-\s*Flags:\s*(.+?)$/im;
  const m2 = body.match(reBullet);
  if (m2) return m2[1].trim();

  return null;
}

/**
 * Normalise tickers so the same instrument lands in one row regardless of
 * how the report wrote it: '5398' / '5398.KL' / '8869.KL' / '5235SS.KL'.
 * Strategy: uppercase, strip whitespace. We DO NOT collapse the .KL suffix
 * automatically — Yahoo's chart endpoint requires it for KLSE listings, so
 * preserving it as written keeps the downstream chart-overlay join working
 * for both bare-numeric and dotted variants.
 */
function normalizeTicker(t: string): string {
  return t.replace(/\s+/g, '').toUpperCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
