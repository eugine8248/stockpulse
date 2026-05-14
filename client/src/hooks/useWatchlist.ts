import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export interface WatchlistItem {
  id: number;
  userId: number;
  symbol: string;
  sortOrder: number;
  addedAt: string;
}

export function useWatchlist() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.get<WatchlistItem[]>('/api/watchlist'),
  });

  const add = useMutation({
    mutationFn: (symbol: string) =>
      api.post<WatchlistItem>('/api/watchlist', { symbol: symbol.toUpperCase() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.post<void>('/api/watchlist/reorder', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  return { list, add, remove, reorder };
}
