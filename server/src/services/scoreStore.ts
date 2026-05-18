// scoreStore — DB-side helpers for DailyScore rows. The parser produces a
// neutral ParsedScore shape; this module is where we cross over into Prisma.
//
// Idempotency: upserts keyed on (ticker, date) so re-runs of the backfill or
// the live watcher are safe. The unique compound key is declared in the
// schema.

import { prisma } from '../lib/prisma';
import { parseReportFile, type ParsedScore } from './scoreParser';

export interface UpsertCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

export async function upsertParsedScores(
  rows: ParsedScore[],
): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 };
  for (const row of rows) {
    try {
      // Probe first so we can report insert vs update accurately. SQLite is
      // fast enough that this double round-trip is fine for backfill scale.
      const existing = await prisma.dailyScore.findUnique({
        where: { ticker_date: { ticker: row.ticker, date: new Date(row.date) } },
        select: { id: true },
      });
      await prisma.dailyScore.upsert({
        where: { ticker_date: { ticker: row.ticker, date: new Date(row.date) } },
        create: {
          ticker: row.ticker,
          date: new Date(row.date),
          market: row.market,
          company: row.company,
          signal: row.signal,
          composite: row.composite,
          fundamental: row.fundamental,
          technical: row.technical,
          sentiment: row.sentiment,
          economyFlow: row.economyFlow,
          keyReason: row.keyReason,
          flags: row.flags,
          reportPath: row.reportPath,
        },
        update: {
          market: row.market,
          company: row.company,
          signal: row.signal,
          composite: row.composite,
          fundamental: row.fundamental,
          technical: row.technical,
          sentiment: row.sentiment,
          economyFlow: row.economyFlow,
          keyReason: row.keyReason,
          flags: row.flags,
          reportPath: row.reportPath,
        },
      });
      if (existing) counts.updated += 1;
      else counts.inserted += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[scoreStore] upsert failed for ${row.ticker}@${row.date}: ${(err as Error).message}`,
      );
      counts.skipped += 1;
    }
  }
  return counts;
}

export async function ingestReportFile(filePath: string): Promise<{
  date: string | null;
  counts: UpsertCounts;
  warnings: string[];
}> {
  const { date, scores, warnings } = parseReportFile(filePath);
  if (!date || scores.length === 0) {
    return { date, counts: { inserted: 0, updated: 0, skipped: 0 }, warnings };
  }
  const counts = await upsertParsedScores(scores);
  return { date, counts, warnings };
}

/**
 * Look up scores for a ticker, transparently merging the bare and the
 * dotted-suffix variants (e.g. '5398' and '5398.KL'). Reports flip between
 * the two formats across days and we want the verdict-marker overlay to
 * stitch the whole history together regardless of which variant the watch-
 * list / Yahoo proxy uses.
 */
export async function getScoresForTicker(ticker: string, from: Date) {
  const upper = ticker.toUpperCase();
  const variants = expandTickerVariants(upper);
  return prisma.dailyScore.findMany({
    where: {
      ticker: { in: variants },
      date: { gte: from },
    },
    orderBy: { date: 'asc' },
  });
}

function expandTickerVariants(ticker: string): string[] {
  // Numeric KLSE ticker — try both '5398' and '5398.KL'.
  if (/^[0-9]+(SS)?$/.test(ticker)) return [ticker, ticker + '.KL'];
  // Dotted KLSE ticker — strip the .KL too.
  if (/\.KL$/i.test(ticker)) {
    const bare = ticker.replace(/\.KL$/i, '');
    return [ticker, bare];
  }
  return [ticker];
}
