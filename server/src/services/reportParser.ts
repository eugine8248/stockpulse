// Parses the markdown produced by stock-analysis-pm into structured JSON
// for the client. The format is fixed by the PM skill's "Output Format"
// section, so the parser is intentionally simple and tolerant: missing
// sections come back as empty strings / arrays rather than throwing.

export interface TopPick {
  rank: number;
  ticker: string;
  company: string;
  market: string;
  score: number;
  signal: string;
  keyReason: string;
}

export interface IndividualSummary {
  ticker: string;
  company: string;
  fundamental: string;
  technical: string;
  sentiment: string;
  economyFlow: string;
  pmNote: string;
}

export interface ParsedReport {
  date: string;
  goal: string;
  horizon: string;
  markets: string;
  executiveSummary: string;
  topPicks: TopPick[];
  economyHighlights: string[];
  sectorFlow: string;
  individualSummaries: IndividualSummary[];
  risks: string[];
  notRecommended: string[];
  rawMarkdown: string;
}

const KNOWN_SECTIONS = [
  'Executive Summary',
  'Top Picks',
  'Economy & Flow Highlights',
  'Sector Flow Snapshot',
  'Individual Summaries',
  'Risks & Caveats',
  'Not Recommended',
];

export function parseReport(markdown: string): ParsedReport {
  const date = (markdown.match(/^# Stock Analysis Report — (\d{4}-\d{2}-\d{2})/m)?.[1]) ?? '';

  const metaMatch = markdown.match(
    /\*\*Goal:\*\*\s*(.+?)\s*\|\s*\*\*Horizon:\*\*\s*(.+?)\s*\|\s*\*\*Markets:\*\*\s*(.+?)\s*$/m,
  );
  const goal = metaMatch?.[1]?.trim() ?? '';
  const horizon = metaMatch?.[2]?.trim() ?? '';
  const markets = metaMatch?.[3]?.trim() ?? '';

  const sections = splitH2Sections(markdown);

  const executiveSummary = (sections['Executive Summary'] ?? '').trim();
  const topPicks = parseTopPicksTable(sections['Top Picks'] ?? '');
  const economyHighlights = parseBullets(sections['Economy & Flow Highlights'] ?? '');
  const sectorFlow = (sections['Sector Flow Snapshot'] ?? '').trim();
  const individualSummaries = parseIndividualSummaries(sections['Individual Summaries'] ?? '');
  const risks = parseBullets(sections['Risks & Caveats'] ?? '');
  const notRecommended = parseBullets(sections['Not Recommended'] ?? '');

  return {
    date,
    goal,
    horizon,
    markets,
    executiveSummary,
    topPicks,
    economyHighlights,
    sectorFlow,
    individualSummaries,
    risks,
    notRecommended,
    rawMarkdown: markdown,
  };
}

function splitH2Sections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Capture H2 header + everything until the next H2 (or end of file)
  const re = /^##\s+(.+?)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    out[m[1].trim()] = m[2];
  }
  // Some markdown engines use \Z, JS regex does not — fallback split-and-scan
  if (Object.keys(out).length === 0) {
    const lines = md.split(/\r?\n/);
    let current: string | null = null;
    const buf: Record<string, string[]> = {};
    for (const line of lines) {
      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) {
        current = h2[1].trim();
        buf[current] = [];
      } else if (current) {
        buf[current].push(line);
      }
    }
    for (const k of Object.keys(buf)) out[k] = buf[k].join('\n');
  }
  return out;
}

function parseTopPicksTable(section: string): TopPick[] {
  const lines = section.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return []; // header + separator + at least one row
  const rows = lines.slice(2); // skip header + separator
  const picks: TopPick[] = [];
  for (const row of rows) {
    const cells = row
      .split('|')
      .slice(1, -1) // ignore leading/trailing empties from split
      .map((c) => c.trim());
    if (cells.length < 7) continue;
    const [rank, ticker, company, market, score, signal, keyReason] = cells;
    const rankNum = parseInt(rank, 10);
    const scoreNum = parseFloat(score);
    if (Number.isNaN(rankNum) || Number.isNaN(scoreNum)) continue;
    picks.push({
      rank: rankNum,
      ticker,
      company,
      market,
      score: scoreNum,
      signal: signal.toUpperCase(),
      keyReason,
    });
  }
  return picks;
}

function parseBullets(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function parseIndividualSummaries(section: string): IndividualSummary[] {
  // Split by H3 headers; each block starts with "### TICKER — Company"
  const re = /^###\s+(.+?)\s*$([\s\S]*?)(?=^###\s+|\Z)/gm;
  const out: IndividualSummary[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const header = m[1].trim();
    const body = m[2];
    const [ticker, ...companyParts] = header.split(/\s*—\s*/);
    const company = companyParts.join(' — ').trim();
    out.push({
      ticker: ticker.trim(),
      company,
      fundamental: extractLabeledBullet(body, 'Fundamental'),
      technical: extractLabeledBullet(body, 'Technical'),
      sentiment: extractLabeledBullet(body, 'Sentiment'),
      economyFlow: extractLabeledBullet(body, 'Economy Flow'),
      pmNote: extractLabeledBullet(body, 'PM Note'),
    });
  }
  // Fallback for missing \Z support: split-and-scan
  if (out.length === 0) {
    const blocks = section.split(/^###\s+/m).slice(1);
    for (const block of blocks) {
      const [headerLine, ...rest] = block.split(/\r?\n/);
      const body = rest.join('\n');
      const [ticker, ...companyParts] = headerLine.split(/\s*—\s*/);
      const company = companyParts.join(' — ').trim();
      out.push({
        ticker: ticker.trim(),
        company,
        fundamental: extractLabeledBullet(body, 'Fundamental'),
        technical: extractLabeledBullet(body, 'Technical'),
        sentiment: extractLabeledBullet(body, 'Sentiment'),
        economyFlow: extractLabeledBullet(body, 'Economy Flow'),
        pmNote: extractLabeledBullet(body, 'PM Note'),
      });
    }
  }
  return out;
}

function extractLabeledBullet(body: string, label: string): string {
  const re = new RegExp(`-\\s*\\*\\*${escapeRegex(label)}:\\*\\*\\s*(.+)`, 'i');
  const m = body.match(re);
  return m?.[1]?.trim() ?? '';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
