import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Trash2 } from 'lucide-react';

interface Alert {
  id: number;
  symbol: string;
  type: 'price_above' | 'price_below' | 'pct_change_above' | 'pct_change_below';
  threshold: number;
  enabled: boolean;
  notifyChannels: string;
}

const TYPE_LABELS: Record<Alert['type'], string> = {
  price_above: 'Price above',
  price_below: 'Price below',
  pct_change_above: '% change above',
  pct_change_below: '% change below',
};

/**
 * Each alert renders as a pill-style row with a left-border colored by
 * severity (green for "above", red for "below"). Matches the brief's
 * "pill-style entries with left-border colored by severity" idiom.
 */
function severityBorder(type: Alert['type']): string {
  if (type === 'price_above' || type === 'pct_change_above') return 'border-l-success';
  return 'border-l-error';
}

export default function AlertEditor({ symbol }: { symbol?: string }) {
  const qc = useQueryClient();
  const { data: all } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<Alert[]>('/api/alerts'),
  });
  const alerts = symbol ? (all ?? []).filter((a) => a.symbol === symbol.toUpperCase()) : all ?? [];

  const [type, setType] = useState<Alert['type']>('price_above');
  const [threshold, setThreshold] = useState('');
  const [browserNotify, setBrowserNotify] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.post<Alert>('/api/alerts', {
        symbol: (symbol || '').toUpperCase(),
        type,
        threshold: parseFloat(threshold),
        notifyChannels: browserNotify ? ['in_app', 'browser'] : ['in_app'],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setThreshold('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.patch<void>(`/api/alerts/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  async function ensureBrowserPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const r = await Notification.requestPermission();
    return r === 'granted';
  }

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <ul className="space-y-1.5">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`surface-muted flex items-center justify-between text-sm px-3 py-1.5 border-l-4 ${severityBorder(a.type)}`}
            >
              <span className="font-mono text-text-2">
                {!symbol && <b className="mr-2 text-text">{a.symbol}</b>}
                {TYPE_LABELS[a.type]} {a.threshold}
                {a.type.startsWith('pct') ? '%' : ''}
              </span>
              <span className="flex items-center gap-3">
                <label className="text-xs text-text-muted inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={(e) => toggle.mutate({ id: a.id, enabled: e.target.checked })}
                    className="accent-accent w-3.5 h-3.5"
                  />
                  on
                </label>
                <button
                  onClick={() => remove.mutate(a.id)}
                  className="text-text-muted hover:text-error"
                  aria-label={`Remove alert ${a.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {symbol && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!threshold) return;
            if (browserNotify) await ensureBrowserPermission();
            create.mutate();
          }}
          className="flex flex-wrap gap-2 items-center"
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Alert['type'])}
            className="input h-8 text-xs w-auto"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="Threshold"
            className="input h-8 text-xs font-mono w-28"
          />
          <label className="text-xs text-text-muted inline-flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={browserNotify}
              onChange={(e) => setBrowserNotify(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            browser notify
          </label>
          <button
            type="submit"
            disabled={create.isPending || !threshold}
            className="btn btn-primary btn-sm"
          >
            Add alert
          </button>
        </form>
      )}
    </div>
  );
}
