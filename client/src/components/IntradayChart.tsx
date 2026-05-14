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

interface IntradayBar {
  ts: number;
  close: number | null;
}

interface IntradayResp {
  symbol: string;
  bars: IntradayBar[];
  previousClose: number | null;
}

export default function IntradayChart({
  symbol,
  range,
}: {
  symbol: string;
  range: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['intraday', symbol, range],
    queryFn: () =>
      api.get<IntradayResp>(
        `/api/quotes/${encodeURIComponent(symbol)}/intraday?range=${encodeURIComponent(range)}`
      ),
  });

  if (isLoading) return <div className="h-64 animate-pulse bg-elevated rounded" />;
  if (error) return <div className="h-64 text-down text-sm">Failed to load chart</div>;

  const points = (data?.bars ?? [])
    .filter((b) => b.close != null)
    .map((b) => ({ ts: b.ts * 1000, v: b.close as number }));

  if (points.length === 0) return <div className="h-64 text-textMuted text-sm">No data</div>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#262c36" strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            tickFormatter={(ts) => {
              const d = new Date(ts);
              return range === '1d'
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString();
            }}
            stroke="#5a6374"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="#5a6374"
            tick={{ fontSize: 11 }}
            domain={['auto', 'auto']}
            width={50}
          />
          <Tooltip
            contentStyle={{ background: '#161a21', border: '1px solid #262c36' }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : v)}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke="#5b8def"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
