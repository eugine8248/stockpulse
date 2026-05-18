import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

interface Hit {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
}

export default function SymbolSearch({
  onPick,
  onCancel,
}: {
  onPick: (symbol: string) => void;
  onCancel?: () => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const data = await api.get<Hit[]>(`/api/quotes/search?q=${encodeURIComponent(q)}`);
        setHits(data || []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  function pick(h: Hit) {
    onPick(h.symbol);
  }

  return (
    <div className="flex flex-col h-full">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search symbol e.g. AAPL"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel?.();
          if (e.key === 'ArrowDown') setActive((i) => Math.min(hits.length - 1, i + 1));
          if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
          if (e.key === 'Enter') {
            if (hits[active]) pick(hits[active]);
            else if (q.trim()) onPick(q.trim().toUpperCase());
          }
        }}
        className="input h-8 text-xs font-mono"
      />
      <ul className="mt-1 flex-1 overflow-y-auto">
        {hits.map((h, i) => (
          <li
            key={`${h.symbol}-${i}`}
            onClick={() => pick(h)}
            className={`px-2 py-1 text-xs rounded cursor-pointer flex justify-between gap-2 transition ${
              i === active ? 'bg-surface-muted text-text' : 'text-text-2 hover:bg-surface-muted'
            }`}
          >
            <span className="font-mono">{h.symbol}</span>
            <span className="truncate">{h.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
