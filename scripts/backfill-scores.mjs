#!/usr/bin/env node
// scripts/backfill-scores.mjs
//
// Parses every cron-shaped stock-analysis report under the configured
// REPORTS_DIR (or the dev fallback) and upserts DailyScore rows. Idempotent:
// re-running yields zero net change once everything's in sync.
//
// Usage:
//   npx tsx scripts/backfill-scores.mjs
//   REPORTS_DIR=/path/to/stocks npx tsx scripts/backfill-scores.mjs
//
// IMPORTANT: must be invoked via `npx tsx` (not plain `node`) so the TS
// imports resolve. Node's `--loader` flag was deprecated in 20.6 and the
// programmatic tsx register API has changed enough times that the simplest
// path forward is to require the tsx launcher.
//
// .env loaded automatically so DATABASE_URL is picked up from the repo root.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

async function loadServerModules() {
  const scoreStoreUrl = pathToFileURL(
    path.join(repoRoot, 'server', 'src', 'services', 'scoreStore.ts'),
  ).href;
  const prismaUrl = pathToFileURL(
    path.join(repoRoot, 'server', 'src', 'lib', 'prisma.ts'),
  ).href;
  const { ingestReportFile } = await import(scoreStoreUrl);
  const { prisma } = await import(prismaUrl);
  return { ingestReportFile, prisma };
}

function resolveReportsDir() {
  return (
    process.env.REPORTS_DIR ||
    process.env.STOCK_REPORTS_DIR ||
    // Windows-dev fallback — same default as the server's reports router.
    'C:\\Users\\eugin\\projects\\taskpulse\\data\\reports\\stocks'
  );
}

const CRON_FILE_RE = /^(\d{4}-\d{2}-\d{2})-stock-analysis\.md$/;

async function main() {
  const dir = resolveReportsDir();
  if (!fs.existsSync(dir)) {
    console.error(`[backfill] reports dir not found: ${dir}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => CRON_FILE_RE.test(f))
    .sort();
  if (files.length === 0) {
    console.log(`[backfill] no cron-shaped reports found in ${dir}`);
    return;
  }
  console.log(`[backfill] found ${files.length} files in ${dir}`);

  const { ingestReportFile, prisma } = await loadServerModules();
  let filesProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const allWarnings = [];

  for (const f of files) {
    const filePath = path.join(dir, f);
    try {
      const { date, counts, warnings } = await ingestReportFile(filePath);
      filesProcessed += 1;
      totalInserted += counts.inserted;
      totalUpdated += counts.updated;
      totalSkipped += counts.skipped;
      for (const w of warnings) allWarnings.push(w);
      console.log(
        `  ${f}  date=${date ?? '???'}  inserted=${counts.inserted}  updated=${counts.updated}  skipped=${counts.skipped}`,
      );
    } catch (err) {
      console.error(`  ${f}  ERROR: ${err?.message ?? err}`);
    }
  }

  console.log('');
  console.log(`[backfill] summary:`);
  console.log(`  files processed:  ${filesProcessed}/${files.length}`);
  console.log(`  rows inserted:    ${totalInserted}`);
  console.log(`  rows updated:     ${totalUpdated}`);
  console.log(`  rows skipped:     ${totalSkipped}`);
  console.log(`  warnings:         ${allWarnings.length}`);
  for (const w of allWarnings.slice(0, 20)) console.warn('  ' + w);
  if (allWarnings.length > 20) {
    console.warn(`  ... and ${allWarnings.length - 20} more`);
  }

  // Final tally: how much DailyScore history exists?
  const total = await prisma.dailyScore.count();
  const distinctTickers = await prisma.dailyScore.groupBy({
    by: ['ticker'],
    _count: { ticker: true },
    orderBy: { _count: { ticker: 'desc' } },
    take: 10,
  });
  console.log('');
  console.log(`[backfill] DailyScore total rows: ${total}`);
  console.log(`[backfill] top tickers by history:`);
  for (const row of distinctTickers) {
    console.log(`  ${row.ticker.padEnd(10)} ${row._count.ticker} day(s)`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
