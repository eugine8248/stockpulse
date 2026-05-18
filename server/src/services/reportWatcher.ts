// reportWatcher — watches the host-mounted reports directory (typically the
// taskpulse pull-morning-reports drop site at
// C:\Users\eugin\projects\taskpulse\data\reports\stocks) and emits a tiny
// in-process event whenever a stock-analysis markdown file is created,
// modified, or removed.
//
// We do NOT mirror the file contents into our own DB — every endpoint that
// needs a report still reads the markdown directly from disk via the reports
// route. The watcher's job is purely:
//   1. let the API surface "latest" without polling the filesystem on every
//      request, by caching the newest date once at startup and on every event
//   2. log new file arrivals so we have a paper trail in the container logs
//   3. allow future SSE/WS push-to-client without re-architecting
//
// Filename pattern: YYYY-MM-DD-stock-analysis.md (cron output)
// Also accepts the legacy YYYY-MM-DD.md placed directly in data/stock-reports
// (handled by the reports route itself; this watcher is for cron pulls).

import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

export const reportEvents = new EventEmitter();

export interface WatchedReport {
  date: string;       // YYYY-MM-DD
  filePath: string;
  mtimeMs: number;
}

const CRON_FILE_RE = /^(\d{4}-\d{2}-\d{2})-stock-analysis\.md$/;

class ReportCache {
  private byDate = new Map<string, WatchedReport>();

  upsert(filePath: string): WatchedReport | null {
    const base = path.basename(filePath);
    const m = CRON_FILE_RE.exec(base);
    if (!m) return null;
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
    const rec: WatchedReport = { date: m[1], filePath, mtimeMs };
    this.byDate.set(m[1], rec);
    return rec;
  }

  remove(filePath: string): string | null {
    const base = path.basename(filePath);
    const m = CRON_FILE_RE.exec(base);
    if (!m) return null;
    this.byDate.delete(m[1]);
    return m[1];
  }

  latest(): WatchedReport | null {
    if (this.byDate.size === 0) return null;
    // newest date wins; in case of ties prefer the one with newer mtime
    const all = Array.from(this.byDate.values());
    all.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.mtimeMs - a.mtimeMs;
    });
    return all[0];
  }

  list(): WatchedReport[] {
    return Array.from(this.byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }
}

const cache = new ReportCache();
let watcher: FSWatcher | null = null;

export function getLatestReport(): WatchedReport | null {
  return cache.latest();
}

export function listWatchedReports(): WatchedReport[] {
  return cache.list();
}

export function startReportWatcher(reportsDir: string): void {
  if (watcher) return; // idempotent
  // Pre-seed cache from existing files so we don't have to wait for the
  // 'add' fan-out on startup.
  try {
    if (fs.existsSync(reportsDir) && fs.statSync(reportsDir).isDirectory()) {
      for (const entry of fs.readdirSync(reportsDir)) {
        const full = path.join(reportsDir, entry);
        try {
          if (fs.statSync(full).isFile()) cache.upsert(full);
        } catch {
          /* ignore individual stat errors */
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reportWatcher] startup scan failed:', err);
  }

  // ignoreInitial: false would re-emit 'add' for every existing file. We
  // already pre-seeded, so true is fine and quieter.
  watcher = chokidar.watch(reportsDir, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    // Only watch files (not subdirs) at the top level. taskpulse cron drops
    // files directly into the stocks/ folder.
    depth: 0,
  });

  watcher
    .on('add', (filePath: string) => {
      const rec = cache.upsert(filePath);
      if (rec) {
        // eslint-disable-next-line no-console
        console.log(`[reportWatcher] add ${rec.date} (${path.basename(filePath)})`);
        reportEvents.emit('report:added', rec);
      }
    })
    .on('change', (filePath: string) => {
      const rec = cache.upsert(filePath);
      if (rec) {
        // eslint-disable-next-line no-console
        console.log(`[reportWatcher] change ${rec.date} (${path.basename(filePath)})`);
        reportEvents.emit('report:changed', rec);
      }
    })
    .on('unlink', (filePath: string) => {
      const date = cache.remove(filePath);
      if (date) {
        // eslint-disable-next-line no-console
        console.log(`[reportWatcher] unlink ${date}`);
        reportEvents.emit('report:removed', { date, filePath });
      }
    })
    .on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[reportWatcher] error:', err);
    });

  // eslint-disable-next-line no-console
  console.log(`[reportWatcher] watching ${reportsDir}`);
}

export async function stopReportWatcher(): Promise<void> {
  if (!watcher) return;
  await watcher.close();
  watcher = null;
}
