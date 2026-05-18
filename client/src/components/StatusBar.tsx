import { useStore } from '../store';
import { useWatchlist } from '../hooks/useWatchlist';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * StatusBar — sticky footer that mirrors a code-editor status strip.
 * Soft-bordered, monospace, theme-aware via CSS variables.
 */
export default function StatusBar() {
  const status = useStore((s) => s.connectionStatus);
  const { list } = useWatchlist();
  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<unknown[]>('/api/alerts'),
  });

  const tickerCount = list.data?.length ?? 0;
  const alertCount = alerts.data?.length ?? 0;

  const dotColor =
    status === 'connected' ? 'bg-success'
    : status === 'reconnecting' ? 'bg-warning'
    : status === 'stale' ? 'bg-error'
    : 'bg-text-muted';

  return (
    <footer className="sticky bottom-0 h-7 bg-surface border-t border-border-soft flex items-center px-4 text-[11px] font-mono text-text-muted gap-4">
      <span className="inline-flex items-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {status}
      </span>
      <span>5s poll</span>
      <span>{tickerCount} tickers</span>
      <span>{alertCount} alerts</span>
    </footer>
  );
}
