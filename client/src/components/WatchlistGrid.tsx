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
          <div
            key={i}
            className="h-36 rounded-lg border border-border bg-surface animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (list.error) {
    return <div className="text-down">Failed to load watchlist: {(list.error as Error).message}</div>;
  }

  const items = list.data ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-textMuted">
        <p className="mb-4">Your watchlist is empty.</p>
        <AddTickerCard className="w-64 h-36" />
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
