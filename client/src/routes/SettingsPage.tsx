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
      <h1 className="text-lg text-textMuted">Settings</h1>

      <section className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="text-sm text-textMuted">
          Email: <span className="text-text font-mono">{me.data?.email ?? '—'}</span>
        </div>
        <div className="text-sm text-textMuted">
          Name: <span className="text-text">{me.data?.name ?? '—'}</span>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Data source</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={dataSource === 'yahoo'}
            onChange={() => setDataSource('yahoo')}
          />
          Yahoo Finance (default, no key)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={dataSource === 'polygon'}
            onChange={() => setDataSource('polygon')}
          />
          Polygon.io (requires API key)
        </label>
        {dataSource === 'polygon' && (
          <input
            type="password"
            value={polygonKey}
            onChange={(e) => setPolygonKey(e.target.value)}
            placeholder="Polygon API key"
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm font-mono"
          />
        )}
      </section>

      <section className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <label className="block text-sm">
          <span className="text-textMuted">Poll interval (ms): </span>
          <input
            type="number"
            min={2000}
            max={60000}
            step={1000}
            value={pollMs}
            onChange={(e) => setPollMs(e.target.value)}
            className="ml-2 w-24 bg-bg border border-border rounded px-2 py-1 text-sm font-mono"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alertSound === 'true'}
            onChange={(e) => setAlertSound(e.target.checked ? 'true' : 'false')}
          />
          Play sound on alert
        </label>
        <button
          onClick={requestNotifPermission}
          className="text-xs px-3 py-1 bg-elevated border border-border rounded hover:border-accent"
        >
          Request browser notification permission
        </button>
      </section>

      <section className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-3 py-1 text-sm rounded ${
                theme === t ? 'bg-accent text-white' : 'bg-elevated text-textMuted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="bg-accent hover:bg-accentHover text-white px-4 py-1.5 rounded disabled:opacity-50"
      >
        {save.isPending ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}
