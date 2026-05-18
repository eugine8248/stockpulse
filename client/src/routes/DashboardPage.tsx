import { useNavigate } from 'react-router-dom';
import WatchlistGrid from '../components/WatchlistGrid';
import { useWatchlist } from '../hooks/useWatchlist';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { list } = useWatchlist();
  const count = list.data?.length ?? 0;
  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Watchlist</h1>
          <p className="text-sm text-text-2 mt-1">
            {count === 0
              ? 'Add tickers to start tracking real-time prices.'
              : `${count} ticker${count === 1 ? '' : 's'} · 5-second polling`}
          </p>
        </div>
      </div>
      <WatchlistGrid onSelect={(s) => navigate(`/ticker/${s}`)} />
    </div>
  );
}
