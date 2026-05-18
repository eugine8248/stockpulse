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
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-text-2 mt-1">
          Active alerts run against each price tick. History shows everything that's fired so far.
        </p>
      </div>
      <div className="tabstrip">
        {(['active', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
            {t === 'active' ? 'Active' : 'History'}
          </button>
        ))}
      </div>
      {tab === 'active' && (
        <div className="surface p-4">
          <AlertEditor />
        </div>
      )}
      {tab === 'history' && (
        <div className="surface p-4">
          {events.isLoading && <div className="text-text-muted text-sm">Loading…</div>}
          {events.data && events.data.length === 0 && (
            <div className="text-text-muted text-sm">No alerts have triggered yet.</div>
          )}
          <ul className="divide-y divide-border-soft">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="py-2 text-sm flex justify-between gap-3">
                <span className="font-mono text-text">{e.message}</span>
                <span className="text-text-muted text-xs font-mono shrink-0">
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
