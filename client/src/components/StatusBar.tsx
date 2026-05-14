import { useStore } from '../store';
import { useWatchlist } from '../hooks/useWatchlist';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export default function StatusBar() {
  const status = useStore((s) => s.connectionStatus);
  const { list } = useWatchlist();
  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<any[]>('/api/alerts'),
  });

  const tickerCount = list.data?.length ?? 0;
  const alertCount = alerts.data?.length ?? 0;

  return (
    <footer className="sticky bottom-0 h-7 bg-surface border-t border-border flex items-center px-4 text-[11px] font-mono text-textFaint gap-4">
      <span>● {status}</span>
      <span>5s poll</span>
      <span>{tickerCount} tickers</span>
      <span>{alertCount} alerts</span>
    </footer>
  );
}
