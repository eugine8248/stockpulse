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
import type { TopPick } from '../../hooks/useReports';

interface Props {
  picks: TopPick[];
}

function signalColor(signal: string): string {
  switch (signal.toUpperCase()) {
    case 'BUY':
      return '#5fcf95'; // tailwind: up
    case 'WATCH':
      return '#e8a86a'; // tailwind: warning
    case 'HOLD':
      return '#8b95a5'; // tailwind: textMuted
    case 'SELL':
      return '#f0716a'; // tailwind: down
    default:
      return '#5b8def'; // tailwind: accent
  }
}

interface TooltipPayloadEntry {
  payload?: TopPick;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  if (!p) return null;
  return (
    <div className="bg-surface border border-border rounded p-2 text-xs shadow-lg max-w-xs">
      <div className="font-mono font-semibold text-text">
        {p.ticker} <span className="text-textFaint">· {p.market}</span>
      </div>
      <div className="text-textMuted truncate">{p.company}</div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-text">Score: <span className="font-mono">{p.score.toFixed(1)}</span></span>
        <span style={{ color: signalColor(p.signal) }} className="font-mono">{p.signal}</span>
      </div>
      <div className="mt-1 text-textFaint italic leading-snug">{p.keyReason}</div>
    </div>
  );
}

export default function TopPicksChart({ picks }: Props) {
  if (picks.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-textMuted text-sm bg-surface border border-border rounded-lg">
        No picks in this report
      </div>
    );
  }

  // Sort by score descending so the chart reads left-to-right strongest-to-weakest
  const sorted = [...picks].sort((a, b) => b.score - a.score);
  const yMin = Math.max(0, Math.floor(Math.min(...sorted.map((p) => p.score)) - 5));
  const yMax = Math.min(100, Math.ceil(Math.max(...sorted.map((p) => p.score)) + 3));

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-medium text-text">Composite Score</h2>
        <span className="text-xs text-textFaint">BUY threshold ≥ 75 · scale 0–100</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={sorted} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ticker"
              stroke="#5a6374"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke="#5a6374"
              tick={{ fontSize: 11 }}
              domain={[yMin, yMax]}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(91,141,239,0.08)' }} />
            <ReferenceLine
              y={75}
              stroke="#5fcf95"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'BUY', position: 'right', fill: '#5fcf95', fontSize: 10 }}
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
