import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import { useStore } from '../store';

interface IntradayBar {
  ts: number;
  close: number | null;
}

interface IntradayResp {
  symbol: string;
  bars: IntradayBar[];
  previousClose: number | null;
}

/**
 * IntradayChart — line chart of close prices for a given range.
 * Restyled to read live CSS variables (--c-accent, --c-border-soft,
 * --c-text-muted, --c-surface) so the chart automatically re-themes when
 * the user toggles dark mode. Recharts needs resolved hex/rgb values for
 * its SVG attributes, so we grab them off <html> once per theme change.
 */
export default function IntradayChart({
  symbol,
  range,
}: {
  symbol: string;
  range: string;
}) {
  const themeKey = useStore((s) => s.theme);
  const [chartColors, setChartColors] = useState({
    accent: '#d97757',
    border: '#e9e1d2',
    text: '#28231d',
    textMuted: '#8b8275',
    surface: '#ffffff',
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setChartColors({
      accent: cs.getPropertyValue('--c-accent').trim() || '#d97757',
      border: cs.getPropertyValue('--c-border-soft').trim() || '#e9e1d2',
      text: cs.getPropertyValue('--c-text').trim() || '#28231d',
      textMuted: cs.getPropertyValue('--c-text-muted').trim() || '#8b8275',
      surface: cs.getPropertyValue('--c-surface').trim() || '#ffffff',
    });
  }, [themeKey]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['intraday', symbol, range],
    queryFn: () =>
      api.get<IntradayResp>(
        `/api/quotes/${encodeURIComponent(symbol)}/intraday?range=${encodeURIComponent(range)}`,
      ),
  });

  if (isLoading) return <div className="h-64 animate-pulse bg-surface-muted rounded-md" />;
  if (error) return <div className="h-64 text-error text-sm">Failed to load chart</div>;

  const points = (data?.bars ?? [])
    .filter((b) => b.close != null)
    .map((b) => ({ ts: b.ts * 1000, v: b.close as number }));

  if (points.length === 0) return <div className="h-64 text-text-muted text-sm">No data</div>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartColors.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            tickFormatter={(ts) => {
              const d = new Date(ts);
              return range === '1d'
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString();
            }}
            stroke={chartColors.textMuted}
            tick={{ fontSize: 11, fill: chartColors.textMuted }}
          />
          <YAxis
            stroke={chartColors.textMuted}
            tick={{ fontSize: 11, fill: chartColors.textMuted }}
            domain={['auto', 'auto']}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: chartColors.surface,
              border: `1px solid ${chartColors.border}`,
              borderRadius: 6,
              color: chartColors.text,
              fontSize: 12,
            }}
            labelStyle={{ color: chartColors.text }}
            itemStyle={{ color: chartColors.text }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(v: number | string) => (typeof v === 'number' ? v.toFixed(2) : v)}
            cursor={{ stroke: chartColors.accent, strokeOpacity: 0.4 }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={chartColors.accent}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
