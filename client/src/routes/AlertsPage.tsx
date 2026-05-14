import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import AlertEditor from '../components/AlertEditor';

interface AlertEvent {
  id: number;
  alertId: number;
  triggeredAt: string;
  observedValue: number;
  message: string;
  alert: { symbol: string; type: string };
}

export default function AlertsPage() {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const events = useQuery({
    queryKey: ['alert-events'],
    queryFn: () => api.get<AlertEvent[]>('/api/alerts/events'),
    enabled: tab === 'history',
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg text-textMuted">Alerts</h1>
      <div className="flex gap-1 border-b border-border">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === t ? 'border-accent text-text' : 'border-transparent text-textMuted'
            }`}
          >
            {t === 'active' ? 'Active' : 'History'}
          </button>
        ))}
      </div>
      {tab === 'active' && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <AlertEditor />
        </div>
      )}
      {tab === 'history' && (
        <div className="bg-surface border border-border rounded-lg p-4">
          {events.isLoading && <div className="text-textMuted text-sm">Loading…</div>}
          {events.data && events.data.length === 0 && (
            <div className="text-textMuted text-sm">No alerts have triggered yet.</div>
          )}
          <ul className="divide-y divide-border">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="py-2 text-sm flex justify-between">
                <span className="font-mono">{e.message}</span>
                <span className="text-textFaint text-xs">
                  {new Date(e.triggeredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
