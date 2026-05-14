import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { useStore } from '../store';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface Props {
  symbol: string;
  onClick: () => void;
  onRemove: () => void;
}

interface IntradayBar {
  ts: number;
  close: number | null;
}

export default function TickerCard({ symbol, onClick, onRemove }: Props) {
  const tick = useStore((s) => s.prices[symbol.toUpperCase()]);

  // Pull intraday for sparkline; cache 60s
  const { data: intraday } = useQuery({
    queryKey: ['intraday', symbol, '1d'],
    queryFn: () =>
      api.get<{ bars: IntradayBar[]; previousClose: number | null }>(
        `/api/quotes/${encodeURIComponent(symbol)}/intraday?range=1d`
      ),
    staleTime: 60_000,
  });

  const price = tick?.price;
  const changePct = tick?.changePct ?? null;
  const change = tick?.change ?? null;
  const up = (changePct ?? 0) >= 0;

  const sparkData = (intraday?.bars ?? [])
    .filter((b) => b.close != null)
    .map((b) => ({ ts: b.ts, v: b.close as number }));

  return (
    <div
      role="button"
      onClick={onClick}
      className="group relative h-36 rounded-lg border border-border bg-surface hover:bg-elevated hover:border-accent/40 cursor-pointer transition-colors p-3 flex flex-col"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-textFaint hover:text-down hover:bg-bg"
        title="Remove"
      >
        <X className="w-3 h-3" />
      </button>

      <div className="flex items-baseline justify-between">
        <span className="font-mono font-semibold text-text">{symbol}</span>
        <span className="text-xs text-textFaint truncate ml-2">
          {tick ? '' : '—'}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-xl text-text">
          {price != null ? price.toFixed(2) : '—'}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1 text-xs font-mono">
        {changePct != null && (
          <span className={`flex items-center gap-0.5 ${up ? 'text-up' : 'text-down'}`}>
            {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)} ` : ''}
            ({changePct.toFixed(2)}%)
          </span>
        )}
      </div>

      <div className="mt-auto h-10 -mx-1">
        {sparkData.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={`g-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={up ? '#5fcf95' : '#f0716a'}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor={up ? '#5fcf95' : '#f0716a'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={up ? '#5fcf95' : '#f0716a'}
                strokeWidth={1.5}
                fill={`url(#g-${symbol})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
