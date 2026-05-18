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
    'btn btn-secondary btn-icon btn-sm';
  const arrowDisabled = 'opacity-30 cursor-not-allowed pointer-events-none';

  return (
    <div className="surface flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-text-muted shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide font-medium text-text-muted">
            Stock analysis
          </div>
          <div className="font-mono text-sm truncate text-text" title={date}>
            {formatDate(date)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="pill font-mono hidden sm:inline-flex">
          {position} / {total}
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
