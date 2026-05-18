import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useStore } from '../store';

export default function SettingsPage() {
  const qc = useQueryClient();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string>>('/api/settings'),
  });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ id: number; email: string; name: string | null }>('/api/auth/me'),
    retry: false,
  });

  const [pollMs, setPollMs] = useState('5000');
  const [dataSource, setDataSource] = useState('yahoo');
  const [polygonKey, setPolygonKey] = useState('');
  const [alertSound, setAlertSound] = useState('false');

  useEffect(() => {
    if (!settings.data) return;
    setPollMs(settings.data.poll_interval_ms || '5000');
    setDataSource(settings.data.data_source || 'yahoo');
    setPolygonKey(settings.data.polygon_key || '');
    setAlertSound(settings.data.alert_sound || 'false');
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put<void>('/api/settings', {
        poll_interval_ms: pollMs,
        data_source: dataSource,
        polygon_key: polygonKey,
        alert_sound: alertSound,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') {
      alert('Browser notifications not supported.');
      return;
    }
    const r = await Notification.requestPermission();
    alert(`Notification permission: ${r}`);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-text-2 mt-1">Account, data source, polling, and appearance.</p>
      </div>

      <section className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="text-sm text-text-2">
          Email: <span className="text-text font-mono">{me.data?.email ?? '—'}</span>
        </div>
        <div className="text-sm text-text-2">
          Name: <span className="text-text">{me.data?.name ?? '—'}</span>
        </div>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold">Data source</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={dataSource === 'yahoo'}
            onChange={() => setDataSource('yahoo')}
            className="accent-accent"
          />
          Yahoo Finance (default, no key)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={dataSource === 'polygon'}
            onChange={() => setDataSource('polygon')}
            className="accent-accent"
          />
          Polygon.io (requires API key)
        </label>
        {dataSource === 'polygon' && (
          <input
            type="password"
            value={polygonKey}
            onChange={(e) => setPolygonKey(e.target.value)}
            placeholder="Polygon API key"
            className="input font-mono"
          />
        )}
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <label className="block">
          <span className="label">Poll interval (ms)</span>
          <input
            type="number"
            min={2000}
            max={60000}
            step={1000}
            value={pollMs}
            onChange={(e) => setPollMs(e.target.value)}
            className="input w-32 font-mono"
          />
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={alertSound === 'true'}
            onChange={(e) => setAlertSound(e.target.checked ? 'true' : 'false')}
            className="accent-accent"
          />
          Play sound on alert
        </label>
        <button onClick={requestNotifPermission} className="btn btn-secondary btn-sm">
          Request browser notification permission
        </button>
      </section>

      <section className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <div className="tabstrip">
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={theme === t ? 'active' : ''}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary">
        {save.isPending ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}
