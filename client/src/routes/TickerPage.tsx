import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Settings as SettingsIcon, Info } from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store';
import type {
  DailyScoreRow,
  MarkerPrefs,
} from '../components/charts/TickerChart';

// Lazy-load TickerChart so the ~45 KB-gz lightweight-charts payload stays
// out of the initial bundle. Vite handles the chunk-split automatically.
const TickerChart = lazy(() => import('../components/charts/TickerChart'));

interface LatestResp {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  longName: string | null;
  ts: number;
}

interface ScoresResp {
  ticker: string;
  range: string;
  scores: DailyScoreRow[];
}

const LS_KEY_PREFIX = 'stockpulse.chart.markers.';

function loadMarkerPrefs(ticker: string): MarkerPrefs {
  if (typeof localStorage === 'undefined') {
    return { showMarkers: true, onlyBuy: false, hideWatch: false };
  }
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${ticker}`);
    if (!raw) return { showMarkers: true, onlyBuy: false, hideWatch: false };
    const parsed = JSON.parse(raw) as Partial<MarkerPrefs>;
    return {
      showMarkers: parsed.showMarkers !== false,
      onlyBuy: parsed.onlyBuy === true,
      hideWatch: parsed.hideWatch === true,
    };
  } catch {
    return { showMarkers: true, onlyBuy: false, hideWatch: false };
  }
}

function saveMarkerPrefs(ticker: string, p: MarkerPrefs) {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${ticker}`, JSON.stringify(p));
  } catch {
    /* ignore quota errors */
  }
}

export default function TickerPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const ticker = (symbol || '').toUpperCase();
  const livePrices = useStore((s) => s.prices);
  const tick = livePrices[ticker];

  const { data: latest } = useQuery({
    queryKey: ['ticker-latest', ticker],
    queryFn: () => api.get<LatestResp>(`/api/quotes/${encodeURIComponent(ticker)}/latest`),
    staleTime: 10_000,
    refetchInterval: 30_000,
    enabled: !!ticker,
  });

  const { data: scoresResp } = useQuery({
    queryKey: ['ticker-scores', ticker, '1y'],
    queryFn: () =>
      api.get<ScoresResp>(`/api/quotes/${encodeURIComponent(ticker)}/scores?range=1y`),
    enabled: !!ticker,
    staleTime: 5 * 60_000,
    // Tolerate a 404 / 500 — server may not have scores yet.
    retry: false,
  });

  const scores = scoresResp?.scores ?? [];
  const [markerPrefs, setMarkerPrefs] = useState<MarkerPrefs>(() => loadMarkerPrefs(ticker));
  const [showSettings, setShowSettings] = useState(false);
  const [showCalibrationInfo, setShowCalibrationInfo] = useState(false);
  const [hover, setHover] = useState<
    { marker: DailyScoreRow; clientX: number; clientY: number } | null
  >(null);

  useEffect(() => {
    setMarkerPrefs(loadMarkerPrefs(ticker));
  }, [ticker]);

  useEffect(() => {
    if (ticker) saveMarkerPrefs(ticker, markerPrefs);
  }, [ticker, markerPrefs]);

  const calibrationDays = useMemo(() => {
    const uniq = new Set(scores.map((s) => s.date.slice(0, 10)));
    return uniq.size;
  }, [scores]);
  const calibrationThin = scores.length > 0 && calibrationDays < 14;

  const price = tick?.price ?? latest?.price ?? null;
  const change = tick?.change ?? latest?.change ?? null;
  const changePct = tick?.changePct ?? latest?.changePct ?? null;
  const up = (changePct ?? 0) >= 0;
  const longName = latest?.longName ?? null;

  if (!ticker) {
    return <div className="p-6 text-text-2">No ticker specified.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => navigate(-1)}
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono font-semibold text-2xl">{ticker}</span>
              {longName && (
                <span className="text-text-2 text-sm truncate">{longName}</span>
              )}
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="font-mono text-xl">
                {price != null ? price.toFixed(2) : '—'}
              </span>
              {changePct != null && (
                <span
                  className={`font-mono text-sm ${up ? 'text-success' : 'text-error'}`}
                >
                  {change != null
                    ? `${change > 0 ? '+' : ''}${change.toFixed(2)} `
                    : ''}
                  ({changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          {calibrationThin && (
            <button
              className="chip text-warning border-warning/30 hover:bg-surface-muted"
              onClick={() => setShowCalibrationInfo((v) => !v)}
              title="Calibration thin"
            >
              <Info className="w-3 h-3" />
              {calibrationDays}d history — calibration thin
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Chart settings"
            title="Chart settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          {showSettings && (
            <div
              className="absolute right-0 top-12 z-30 surface shadow-lg p-3 text-sm w-64"
              onMouseLeave={() => setShowSettings(false)}
            >
              <div className="font-medium text-text mb-2">Verdict markers</div>
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markerPrefs.showMarkers}
                  onChange={(e) =>
                    setMarkerPrefs({ ...markerPrefs, showMarkers: e.target.checked })
                  }
                />
                <span>Show verdict markers</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markerPrefs.onlyBuy}
                  onChange={(e) =>
                    setMarkerPrefs({ ...markerPrefs, onlyBuy: e.target.checked })
                  }
                />
                <span>Only BUY signals</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markerPrefs.hideWatch}
                  onChange={(e) =>
                    setMarkerPrefs({ ...markerPrefs, hideWatch: e.target.checked })
                  }
                />
                <span>Hide WATCH markers</span>
              </label>
              <div className="text-xs text-text-muted mt-2">
                {scores.length} verdict{scores.length === 1 ? '' : 's'} loaded over{' '}
                {calibrationDays} day{calibrationDays === 1 ? '' : 's'}.
              </div>
            </div>
          )}
          {showCalibrationInfo && (
            <div
              className="absolute right-0 top-12 z-30 surface shadow-lg p-3 text-xs w-72"
              onClick={() => setShowCalibrationInfo(false)}
            >
              The daily cron has only {calibrationDays} day
              {calibrationDays === 1 ? '' : 's'} of history on this ticker.
              Verdict markers compound over time — revisit after 30+ days to
              evaluate signal quality.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="relative">
          <Suspense
            fallback={
              <div className="surface flex items-center justify-center text-text-muted text-sm" style={{ height: 520 }}>
                Loading chart…
              </div>
            }
          >
            <TickerChart
              ticker={ticker}
              initialTimeframe="3M"
              scores={scores}
              markerPrefs={markerPrefs}
              onHoverMarker={setHover}
            />
          </Suspense>
          <MarkerTooltip hover={hover} />
        </div>

        <aside className="hidden md:block surface p-3 text-sm">
          <h3 className="font-semibold text-text mb-2">Latest analysis</h3>
          <LatestAnalysisStub ticker={ticker} scores={scores} />
        </aside>
      </div>
    </div>
  );
}

function MarkerTooltip({
  hover,
}: {
  hover: { marker: DailyScoreRow; clientX: number; clientY: number } | null;
}) {
  if (!hover) return null;
  const { marker, clientX, clientY } = hover;
  const sig = marker.signal.toUpperCase();
  const sigColor =
    sig === 'BUY' ? 'text-success' : sig === 'WATCH' ? 'text-warning' : 'text-error';
  return (
    <div
      className="absolute z-40 bg-surface border border-border-soft rounded-md shadow-lg p-3 text-xs pointer-events-none"
      style={{
        left: Math.min(clientX + 12, 480),
        top: Math.max(clientY - 12, 0),
        width: 240,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-text">{marker.date.slice(0, 10)}</span>
        <span className={`font-medium ${sigColor}`}>{sig}</span>
      </div>
      <div className="font-mono text-text">
        Composite: <span className="font-semibold">{marker.composite.toFixed(1)}</span>
      </div>
      <div className="my-2 border-t border-border-soft" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
        <span className="text-text-muted">Fundamental</span>
        <span className="text-right">{marker.fundamental?.toFixed(0) ?? '—'}</span>
        <span className="text-text-muted">Technical</span>
        <span className="text-right">{marker.technical?.toFixed(0) ?? '—'}</span>
        <span className="text-text-muted">Sentiment</span>
        <span className="text-right">{marker.sentiment?.toFixed(0) ?? '—'}</span>
        <span className="text-text-muted">Economy</span>
        <span className="text-right">{marker.economyFlow?.toFixed(0) ?? '—'}</span>
      </div>
      {marker.flags && (
        <>
          <div className="my-2 border-t border-border-soft" />
          <div className="text-text-2 leading-snug">
            <span className="text-text-muted">Flags:</span> {truncate(marker.flags, 140)}
          </div>
        </>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

// TODO v0.4 — expand into a full "Latest Analysis" panel with the markdown
// excerpt for this ticker (4 analyst sections + flags + composite).
function LatestAnalysisStub({
  ticker,
  scores,
}: {
  ticker: string;
  scores: DailyScoreRow[];
}) {
  if (!scores.length) {
    return (
      <p className="text-text-muted">
        No daily-cron analysis yet for {ticker}. Once the cron parser has
        rows here, this panel will surface today's verdict alongside the
        chart.
      </p>
    );
  }
  const latest = [...scores].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const sig = latest.signal.toUpperCase();
  return (
    <div className="space-y-2">
      <div className="text-text-muted">
        Latest verdict ({latest.date.slice(0, 10)}):
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`pill ${
            sig === 'BUY'
              ? 'pill-buy'
              : sig === 'WATCH'
                ? 'pill-watch'
                : sig === 'AVOID'
                  ? 'pill-sell'
                  : 'pill-hold'
          }`}
        >
          {sig}
        </span>
        <span className="font-mono text-text">{latest.composite.toFixed(1)}</span>
      </div>
      {latest.keyReason && (
        <p className="text-text-2 leading-snug">{latest.keyReason}</p>
      )}
      {latest.flags && (
        <p className="text-text-muted text-xs leading-snug">
          <span className="text-text-muted">Flags:</span> {latest.flags}
        </p>
      )}
    </div>
  );
}
