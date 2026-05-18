import { useState } from 'react';
import { Plus } from 'lucide-react';
import SymbolSearch from './SymbolSearch';
import { useWatchlist } from '../hooks/useWatchlist';

export default function AddTickerCard({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { add } = useWatchlist();

  if (open) {
    return (
      <div
        className={`h-36 rounded-lg border border-dashed border-accent bg-surface p-3 flex flex-col gap-2 ${className}`}
      >
        <SymbolSearch
          onPick={async (sym) => {
            try {
              await add.mutateAsync(sym);
            } catch (e) {
              alert(`Add failed: ${(e as Error).message}`);
            }
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className={`h-36 rounded-lg border border-dashed border-border-soft hover:border-accent bg-surface hover:bg-surface-muted text-text-muted hover:text-text flex flex-col items-center justify-center gap-2 transition ${className}`}
    >
      <Plus className="w-5 h-5" />
      <span className="text-sm font-medium">Add ticker</span>
    </button>
  );
}
