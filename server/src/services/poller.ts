// Background poller: fetches batched Yahoo quotes for the union of all
// watchlist symbols, broadcasts price ticks per user, and evaluates alerts.

import { prisma } from '../lib/prisma';
import { fetchBatchQuotes, BatchQuote } from './yahoo';
import { broadcast } from './wsHub';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = 50;
const ALERT_DEBOUNCE_MS = 5 * 60 * 1000; // 5 min

// userId -> Set<symbol>
let userSymbolMap = new Map<number, Set<string>>();
// union of all symbols across all users
let pollSet: string[] = [];

let timer: NodeJS.Timeout | null = null;
let inflight = false;

export async function rebuildPollSet(): Promise<void> {
  const items = await prisma.watchlistItem.findMany({
    select: { userId: true, symbol: true },
  });
  const map = new Map<number, Set<string>>();
  const all = new Set<string>();
  for (const it of items) {
    const sym = it.symbol.toUpperCase();
    all.add(sym);
    let s = map.get(it.userId);
    if (!s) {
      s = new Set();
      map.set(it.userId, s);
    }
    s.add(sym);
  }
  userSymbolMap = map;
  pollSet = Array.from(all);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function tick(): Promise<void> {
  if (inflight) return;
  if (pollSet.length === 0) return;
  inflight = true;
  try {
    const batches = chunk(pollSet, BATCH_SIZE);
    const results: BatchQuote[] = [];
    for (const b of batches) {
      try {
        const r = await fetchBatchQuotes(b);
        results.push(...r);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[poller] batch fetch failed', (err as Error).message);
      }
    }
    if (results.length === 0) return;

    const bySymbol = new Map<string, BatchQuote>();
    for (const q of results) bySymbol.set(q.symbol.toUpperCase(), q);

    // 1) Broadcast price ticks per user
    for (const [userId, syms] of userSymbolMap.entries()) {
      for (const sym of syms) {
        const q = bySymbol.get(sym);
        if (!q || q.price == null) continue;
        broadcast(userId, {
          type: 'price',
          symbol: q.symbol,
          price: q.price,
          change: q.change,
          changePct: q.changePct,
          previousClose: q.previousClose,
          volume: q.volume,
          marketState: q.marketState,
          ts: q.ts,
        });
      }
    }

    // 2) Evaluate alerts for symbols we just polled
    await evaluateAlerts(bySymbol);
  } finally {
    inflight = false;
  }
}

async function evaluateAlerts(bySymbol: Map<string, BatchQuote>): Promise<void> {
  const symbols = Array.from(bySymbol.keys());
  if (!symbols.length) return;
  const alerts = await prisma.alert.findMany({
    where: { enabled: true, symbol: { in: symbols } },
  });
  if (!alerts.length) return;

  const now = Date.now();
  for (const a of alerts) {
    const q = bySymbol.get(a.symbol.toUpperCase());
    if (!q) continue;
    const price = q.price;
    const pct = q.changePct;
    let crossed = false;
    let observed = 0;
    let condition = '';

    switch (a.type) {
      case 'price_above':
        if (price != null && price >= a.threshold) {
          crossed = true; observed = price;
          condition = `price ${price.toFixed(2)} ≥ ${a.threshold}`;
        }
        break;
      case 'price_below':
        if (price != null && price <= a.threshold) {
          crossed = true; observed = price;
          condition = `price ${price.toFixed(2)} ≤ ${a.threshold}`;
        }
        break;
      case 'pct_change_above':
        if (pct != null && pct >= a.threshold) {
          crossed = true; observed = pct;
          condition = `change ${pct.toFixed(2)}% ≥ ${a.threshold}%`;
        }
        break;
      case 'pct_change_below':
        if (pct != null && pct <= a.threshold) {
          crossed = true; observed = pct;
          condition = `change ${pct.toFixed(2)}% ≤ ${a.threshold}%`;
        }
        break;
    }

    if (!crossed) continue;
    if (a.lastTriggered && now - a.lastTriggered.getTime() < ALERT_DEBOUNCE_MS) continue;

    try {
      const event = await prisma.alertEvent.create({
        data: {
          alertId: a.id,
          observedValue: observed,
          message: `${a.symbol}: ${condition}`,
        },
      });
      await prisma.alert.update({
        where: { id: a.id },
        data: { lastTriggered: new Date(now) },
      });
      broadcast(a.userId, {
        type: 'alert',
        event: {
          id: event.id,
          alertId: a.id,
          symbol: a.symbol,
          alertType: a.type,
          threshold: a.threshold,
          observedValue: observed,
          message: event.message,
          triggeredAt: event.triggeredAt,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[poller] alert persist failed', (err as Error).message);
    }
  }
}

export function startPoller(): void {
  if (timer) return;
  // initial build, then schedule
  rebuildPollSet().catch((err) =>
    // eslint-disable-next-line no-console
    console.error('[poller] initial rebuildPollSet failed', err)
  );
  timer = setInterval(() => {
    tick().catch((err) =>
      // eslint-disable-next-line no-console
      console.error('[poller] tick failed', err)
    );
  }, POLL_INTERVAL_MS);
  timer.unref?.();
  // eslint-disable-next-line no-console
  console.log(`[poller] started @ ${POLL_INTERVAL_MS}ms`);
}

export function stopPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
