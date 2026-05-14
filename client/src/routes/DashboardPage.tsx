import { useNavigate, useParams } from 'react-router-dom';
import WatchlistGrid from '../components/WatchlistGrid';
import TickerDetailModal from '../components/TickerDetailModal';

export default function DashboardPage() {
  const { symbol } = useParams<{ symbol?: string }>();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg text-textMuted font-medium">Watchlist</h1>
      </div>
      <WatchlistGrid onSelect={(s) => navigate(`/ticker/${s}`)} />
      {symbol && (
        <TickerDetailModal symbol={symbol.toUpperCase()} onClose={() => navigate('/')} />
      )}
    </div>
  );
}
