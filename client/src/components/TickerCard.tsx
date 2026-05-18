import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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

/**
 * TickerCard — surface card with ticker symbol, last price, day-change %,
 * and an intraday sparkline. Hover state lifts via shadow-md + accent border
 * (framedeck idiom). Sparkline fill/stroke pulls the live CSS variable for
 * success/error so the chart re-themes when dark mode toggles — Recharts
 * unfortunately renders SVG attributes once-per-render, so we read the
 * resolved values from a hidden probe div on mount + theme change.
 */
export default function TickerCard({ symbol, onClick, onRemove }: Props) {
  const tick = useStore((s) => s.prices[symbol.toUpperCase()]);
  const themeKey = useStore((s) => s.theme); // re-resolve sparkColors on theme change

  // Pull intraday for sparkline; cache 60s
  const { data: intraday } = useQuery({
    queryKey: ['intraday', symbol, '1d'],
    queryFn: () =>
      api.get<{ bars: IntradayBar[]; previousClose: number | null }>(
        `/api/quotes/${encodeURIComponent(symbol)}/intraday?range=1d`,
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

  // Recharts needs real hex/rgb values, not CSS variable refs — read the
  // current resolved colors off <html> so the sparkline picks them up.
  const [sparkColors, setSparkColors] = useState<{ up: string; down: string }>({
    up: '#5a9d8a',
    down: '#c45a4a',
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setSparkColors({
      up: cs.getPropertyValue('--c-success').trim() || '#5a9d8a',
      down: cs.getPropertyValue('--c-error').trim() || '#c45a4a',
    });
  }, [themeKey]);
  const lineColor = up ? sparkColors.up : sparkColors.down;

  return (
    <div
      role="button"
      onClick={onClick}
      className="group surface relative h-36 cursor-pointer transition p-3 flex flex-col shadow-xs hover:shadow-md hover:border-accent"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md text-text-muted hover:text-error hover:bg-surface-muted inline-flex items-center justify-center transition"
        title="Remove"
        aria-label={`Remove ${symbol}`}
      >
        <X className="w-3 h-3" />
      </button>

      <div className="flex items-baseline justify-between">
        <span className="font-mono font-semibold text-text">{symbol}</span>
        <span className="text-[10px] text-text-muted truncate ml-2">{tick ? '' : '—'}</span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-xl text-text">
          {price != null ? price.toFixed(2) : '—'}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1 text-xs font-mono">
        {changePct != null && (
          <span className={`flex items-center gap-0.5 ${up ? 'text-success' : 'text-error'}`}>
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
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={lineColor}
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
