import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useStore } from '../store';
import IntradayChart from './IntradayChart';
import AlertEditor from './AlertEditor';

const RANGES = ['1d', '5d', '1mo', '3mo', '1y'];

interface Summary {
  symbol: string;
  longName: string | null;
  shortName: string | null;
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
}

function formatBig(n: number | null): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

export default function TickerDetailModal({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [range, setRange] = useState('1d');
  const tick = useStore((s) => s.prices[symbol.toUpperCase()]);

  const { data: summary } = useQuery({
    queryKey: ['summary', symbol],
    queryFn: () => api.get<Summary>(`/api/quotes/${encodeURIComponent(symbol)}/summary`),
    staleTime: 30_000,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const price = tick?.price ?? summary?.regularMarketPrice ?? null;
  const change = tick?.change ?? summary?.regularMarketChange ?? null;
  const changePct = tick?.changePct ?? summary?.regularMarketChangePercent ?? null;
  const up = (changePct ?? 0) >= 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-4 border-b border-border-soft">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono font-semibold text-lg">{symbol}</span>
              <span className="text-text-2 text-sm">
                {summary?.longName || summary?.shortName || ''}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-2xl">
                {price != null ? price.toFixed(2) : '—'}
              </span>
              {changePct != null && (
                <span className={`font-mono text-sm ${up ? 'text-success' : 'text-error'}`}>
                  {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)} ` : ''}
                  ({changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <IntradayChart symbol={symbol} range={range} />
          <div className="mt-3 tabstrip">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`font-mono ${range === r ? 'active' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border-soft grid grid-cols-3 gap-4 text-sm">
          <Stat label="Open" value={summary?.regularMarketOpen?.toFixed(2) ?? '—'} />
          <Stat label="High" value={summary?.regularMarketDayHigh?.toFixed(2) ?? '—'} />
          <Stat label="Low" value={summary?.regularMarketDayLow?.toFixed(2) ?? '—'} />
          <Stat label="Prev close" value={summary?.regularMarketPreviousClose?.toFixed(2) ?? '—'} />
          <Stat label="Mkt cap" value={formatBig(summary?.marketCap ?? null)} />
          <Stat label="P/E" value={summary?.trailingPE != null ? summary.trailingPE.toFixed(2) : '—'} />
        </div>

        <div className="p-4 border-t border-border-soft">
          <h3 className="text-sm font-semibold text-text mb-2">Alerts on {symbol}</h3>
          <AlertEditor symbol={symbol} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted text-[10px] uppercase tracking-wide font-medium">{label}</div>
      <div className="font-mono text-text mt-0.5">{value}</div>
    </div>
  );
}
