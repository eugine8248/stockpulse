import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  date: string;
  newer: string | null;
  older: string | null;
  total: number;
  position: number; // 1-based: 1 = newest, N = oldest
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; treat as a local date to avoid TZ surprises
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReportNav({ date, newer, older, total, position }: Props) {
  const arrowBase =
    'p-2 rounded border border-border text-textMuted hover:text-text hover:bg-elevated min-h-11 min-w-11 flex items-center justify-center';
  const arrowDisabled = 'opacity-30 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-textMuted shrink-0" />
        <div className="min-w-0">
          <div className="text-xs text-textFaint">Stock analysis</div>
          <div className="font-mono text-sm truncate" title={date}>
            {formatDate(date)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-textFaint hidden sm:inline">
          {position} of {total}
        </span>

        {older ? (
          <Link
            to={`/reports/${older}`}
            className={arrowBase}
            title={`Previous: ${formatDate(older)}`}
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : (
          <span className={`${arrowBase} ${arrowDisabled}`} aria-disabled>
            <ChevronLeft className="w-4 h-4" />
          </span>
        )}

        {newer ? (
          <Link
            to={`/reports/${newer}`}
            className={arrowBase}
            title={`Next: ${formatDate(newer)}`}
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className={`${arrowBase} ${arrowDisabled}`} aria-disabled>
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
}
