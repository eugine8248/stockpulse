// Yahoo Finance data service.
// Uses Node 20 native fetch. All Yahoo endpoints require a UA header
// to avoid 403 from their unofficial API.

const UA = 'Mozilla/5.0';

export interface IntradayBar {
  ts: number;        // unix seconds
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface IntradayResult {
  symbol: string;
  currency: string | null;
  exchangeName: string | null;
  interval: string;
  range: string;
  previousClose: number | null;
  bars: IntradayBar[];
}

export interface QuoteSummary {
  symbol: string;
  currency: string | null;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketOpen: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketPreviousClose: number | null;
  regularMarketVolume: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  longName: string | null;
  shortName: string | null;
  raw: any;
}

export interface SymbolSearchHit {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
}

export interface BatchQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  volume: number | null;
  marketState: string | null;
  shortName: string | null;
  ts: number;
}

async function yahooGet(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json,text/plain,*/*',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Yahoo ${res.status} ${res.statusText} for ${url} :: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchIntraday(
  symbol: string,
  interval: string,
  range: string
): Promise<IntradayResult> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
  const json = await yahooGet(url);
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo intraday: no data for ${symbol}`);
  }
  const meta = result.meta || {};
  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = quote.open || [];
  const highs: (number | null)[] = quote.high || [];
  const lows: (number | null)[] = quote.low || [];
  const closes: (number | null)[] = quote.close || [];
  const volumes: (number | null)[] = quote.volume || [];

  const bars: IntradayBar[] = timestamps.map((ts, i) => ({
    ts,
    open: opens[i] ?? null,
    high: highs[i] ?? null,
    low: lows[i] ?? null,
    close: closes[i] ?? null,
    volume: volumes[i] ?? null,
  }));

  return {
    symbol: meta.symbol || symbol,
    currency: meta.currency ?? null,
    exchangeName: meta.exchangeName ?? null,
    interval,
    range,
    previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    bars,
  };
}

export async function fetchQuoteSummary(symbol: string): Promise<QuoteSummary> {
  const modules = 'financialData,defaultKeyStatistics,summaryDetail,price';
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${modules}`;
  const json = await yahooGet(url);
  const result = json?.quoteSummary?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo quoteSummary: no data for ${symbol}`);
  }
  const price = result.price || {};
  const summaryDetail = result.summaryDetail || {};
  const keyStats = result.defaultKeyStatistics || {};

  const num = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && typeof v.raw === 'number') return v.raw;
    return null;
  };

  return {
    symbol: price.symbol || symbol,
    currency: price.currency ?? null,
    regularMarketPrice: num(price.regularMarketPrice),
    regularMarketChange: num(price.regularMarketChange),
    regularMarketChangePercent: num(price.regularMarketChangePercent),
    regularMarketOpen: num(price.regularMarketOpen) ?? num(summaryDetail.open),
    regularMarketDayHigh: num(price.regularMarketDayHigh) ?? num(summaryDetail.dayHigh),
    regularMarketDayLow: num(price.regularMarketDayLow) ?? num(summaryDetail.dayLow),
    regularMarketPreviousClose:
      num(price.regularMarketPreviousClose) ?? num(summaryDetail.previousClose),
    regularMarketVolume: num(price.regularMarketVolume) ?? num(summaryDetail.volume),
    marketCap: num(price.marketCap) ?? num(summaryDetail.marketCap),
    trailingPE: num(summaryDetail.trailingPE) ?? num(keyStats.trailingPE),
    fiftyTwoWeekHigh: num(summaryDetail.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(summaryDetail.fiftyTwoWeekLow),
    longName: price.longName ?? null,
    shortName: price.shortName ?? null,
    raw: result,
  };
}

export async function searchSymbols(q: string): Promise<SymbolSearchHit[]> {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
  const json = await yahooGet(url);
  const quotes = json?.quotes || [];
  return quotes
    .filter((q: any) => q && q.symbol)
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchDisp || q.exchange || null,
      type: q.quoteType || q.typeDisp || null,
    }));
}

export async function fetchBatchQuotes(symbols: string[]): Promise<BatchQuote[]> {
  if (!symbols.length) return [];
  const csv = symbols.join(',');
  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(csv)}`;
  const json = await yahooGet(url);
  const list = json?.quoteResponse?.result || [];
  const ts = Date.now();
  return list.map((q: any) => ({
    symbol: q.symbol,
    price: q.regularMarketPrice ?? null,
    change: q.regularMarketChange ?? null,
    changePct: q.regularMarketChangePercent ?? null,
    previousClose: q.regularMarketPreviousClose ?? null,
    volume: q.regularMarketVolume ?? null,
    marketState: q.marketState ?? null,
    shortName: q.shortName ?? q.longName ?? null,
    ts,
  }));
}
