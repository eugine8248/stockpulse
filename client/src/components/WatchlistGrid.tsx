import { useWatchlist, WatchlistItem } from '../hooks/useWatchlist';
import TickerCard from './TickerCard';
import AddTickerCard from './AddTickerCard';

interface Props {
  onSelect: (symbol: string) => void;
}

export default function WatchlistGrid({ onSelect }: Props) {
  const { list, remove } = useWatchlist();

  if (list.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface h-36 animate-pulse" />
        ))}
      </div>
    );
  }

  if (list.error) {
    return (
      <div className="surface p-4 text-error text-sm">
        Failed to load watchlist: {(list.error as Error).message}
      </div>
    );
  }

  const items = list.data ?? [];

  if (items.length === 0) {
    return (
      <div className="surface p-12 text-center">
        <div className="text-4xl mb-3">📈</div>
        <h2 className="text-lg font-semibold">Your watchlist is empty</h2>
        <p className="text-sm text-text-2 mt-2">
          Add your first ticker to start tracking real-time prices and set alerts.
        </p>
        <div className="mt-5 inline-block">
          <AddTickerCard className="w-64 h-36" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((it: WatchlistItem) => (
        <TickerCard
          key={it.id}
          symbol={it.symbol}
          onClick={() => onSelect(it.symbol)}
          onRemove={() => remove.mutate(it.id)}
        />
      ))}
      <AddTickerCard />
    </div>
  );
}
