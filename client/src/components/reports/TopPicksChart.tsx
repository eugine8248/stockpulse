import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useStore } from '../../store';
import type { TopPick } from '../../hooks/useReports';

interface Props {
  picks: TopPick[];
}

interface TooltipPayloadEntry {
  payload?: TopPick;
}

function CustomTooltip({
  active,
  payload,
  signalColor,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  signalColor: (s: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  if (!p) return null;
  return (
    <div className="surface p-2 text-xs shadow-md max-w-xs">
      <div className="font-mono font-semibold text-text">
        {p.ticker} <span className="text-text-muted">· {p.market}</span>
      </div>
      <div className="text-text-2 truncate">{p.company}</div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-text">
          Score: <span className="font-mono">{p.score.toFixed(1)}</span>
        </span>
        <span style={{ color: signalColor(p.signal) }} className="font-mono font-semibold">
          {p.signal}
        </span>
      </div>
      <div className="mt-1 text-text-muted italic leading-snug">{p.keyReason}</div>
    </div>
  );
}

/**
 * TopPicksChart — bar chart of composite scores tinted by signal.
 * Reads live CSS variables so the colors re-theme automatically on dark
 * mode toggle. (Recharts SVG attributes need resolved hex/rgb values.)
 */
export default function TopPicksChart({ picks }: Props) {
  const themeKey = useStore((s) => s.theme);
  const [colors, setColors] = useState({
    success: '#5a9d8a',
    warning: '#d4a44a',
    error: '#c45a4a',
    accent: '#d97757',
    textMuted: '#8b8275',
    border: '#e9e1d2',
    accentSoft: 'rgba(217,119,87,0.08)',
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setColors({
      success: cs.getPropertyValue('--c-success').trim() || '#5a9d8a',
      warning: cs.getPropertyValue('--c-warning').trim() || '#d4a44a',
      error: cs.getPropertyValue('--c-error').trim() || '#c45a4a',
      accent: cs.getPropertyValue('--c-accent').trim() || '#d97757',
      textMuted: cs.getPropertyValue('--c-text-muted').trim() || '#8b8275',
      border: cs.getPropertyValue('--c-border-soft').trim() || '#e9e1d2',
      accentSoft: cs.getPropertyValue('--c-accent-soft').trim() || 'rgba(217,119,87,0.08)',
    });
  }, [themeKey]);

  function signalColor(signal: string): string {
    switch (signal.toUpperCase()) {
      case 'BUY':   return colors.success;
      case 'WATCH': return colors.warning;
      case 'HOLD':  return colors.textMuted;
      case 'SELL':  return colors.error;
      default:      return colors.accent;
    }
  }

  if (picks.length === 0) {
    return (
      <div className="surface h-72 flex items-center justify-center text-text-muted text-sm">
        No picks in this report
      </div>
    );
  }

  // Sort by score descending so the chart reads left-to-right strongest-to-weakest
  const sorted = [...picks].sort((a, b) => b.score - a.score);
  const yMin = Math.max(0, Math.floor(Math.min(...sorted.map((p) => p.score)) - 5));
  const yMax = Math.min(100, Math.ceil(Math.max(...sorted.map((p) => p.score)) + 3));

  return (
    <div className="surface p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-text">Composite Score</h2>
        <span className="text-xs text-text-muted">BUY threshold ≥ 75 · scale 0–100</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={sorted} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ticker"
              stroke={colors.textMuted}
              tick={{ fontSize: 11, fill: colors.textMuted }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke={colors.textMuted}
              tick={{ fontSize: 11, fill: colors.textMuted }}
              domain={[yMin, yMax]}
              width={32}
            />
            <Tooltip
              content={<CustomTooltip signalColor={signalColor} />}
              cursor={{ fill: colors.accentSoft }}
            />
            <ReferenceLine
              y={75}
              stroke={colors.success}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'BUY', position: 'right', fill: colors.success, fontSize: 10 }}
            />
            <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {sorted.map((p) => (
                <Cell key={p.ticker} fill={signalColor(p.signal)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
