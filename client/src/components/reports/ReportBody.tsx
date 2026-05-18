import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StockReport } from '../../hooks/useReports';

interface Props {
  report: StockReport;
}

function signalPill(signal: string): string {
  switch (signal.toUpperCase()) {
    case 'BUY':   return 'pill pill-buy';
    case 'WATCH': return 'pill pill-watch';
    case 'HOLD':  return 'pill pill-hold';
    case 'SELL':  return 'pill pill-sell';
    default:      return 'pill';
  }
}

export default function ReportBody({ report }: Props) {
  const [showIndividual, setShowIndividual] = useState(false);

  return (
    <div className="space-y-4">
      {/* Meta chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="chip">
          Goal: <span className="text-text font-mono">{report.goal || '—'}</span>
        </span>
        <span className="chip">
          Horizon: <span className="text-text font-mono">{report.horizon || '—'}</span>
        </span>
        <span className="chip">
          Markets: <span className="text-text font-mono">{report.markets || '—'}</span>
        </span>
      </div>

      {/* Executive summary */}
      {report.executiveSummary && (
        <section className="surface p-4">
          <h2 className="text-sm font-semibold text-text mb-2">Executive Summary</h2>
          <p className="text-sm leading-relaxed text-text-2 whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </section>
      )}

      {/* Top picks table */}
      {report.topPicks.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border-soft">
            <h2 className="text-sm font-semibold text-text">Top Picks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-text-muted text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Ticker</th>
                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Company</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Market</th>
                  <th className="text-right px-3 py-2 font-medium">Score</th>
                  <th className="text-center px-3 py-2 font-medium">Signal</th>
                  <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Key reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {report.topPicks.map((p) => (
                  <tr key={`${p.rank}-${p.ticker}`} className="hover:bg-surface-muted transition">
                    <td className="px-3 py-2 text-text-muted font-mono">{p.rank}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-text">{p.ticker}</td>
                    <td className="px-3 py-2 text-text-2 hidden sm:table-cell">{p.company}</td>
                    <td className="px-3 py-2 text-text-muted hidden md:table-cell font-mono text-xs">{p.market}</td>
                    <td className="px-3 py-2 text-right font-mono text-text">{p.score.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={signalPill(p.signal)}>{p.signal}</span>
                    </td>
                    <td className="px-3 py-2 text-text-2 text-xs hidden lg:table-cell">{p.keyReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Economy & Flow Highlights */}
      {report.economyHighlights.length > 0 && (
        <section className="surface p-4">
          <h2 className="text-sm font-semibold text-text mb-2">Economy & Flow</h2>
          <ul className="space-y-1.5 text-sm">
            {report.economyHighlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-text-2">
                <span className="text-text-muted mt-1">·</span>
                <span className="leading-snug">{h}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sector Flow + Risks side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.sectorFlow && (
          <section className="surface p-4">
            <h2 className="text-sm font-semibold text-text mb-2">Sector Flow</h2>
            <p className="text-sm leading-relaxed text-text-2 whitespace-pre-wrap">
              {report.sectorFlow}
            </p>
          </section>
        )}

        {report.risks.length > 0 && (
          <section className="surface p-4">
            <h2 className="text-sm font-semibold text-text mb-2">Risks & Caveats</h2>
            <ul className="space-y-1.5 text-sm">
              {report.risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-text-2">
                  <span className="text-error mt-1">·</span>
                  <span className="leading-snug">{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Individual summaries — collapsible */}
      {report.individualSummaries.length > 0 && (
        <section className="surface">
          <button
            type="button"
            onClick={() => setShowIndividual((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-muted min-h-11 transition rounded-t-lg"
            aria-expanded={showIndividual}
          >
            <h2 className="text-sm font-semibold text-text">
              Individual Summaries
              <span className="ml-2 text-text-muted font-normal">
                ({report.individualSummaries.length})
              </span>
            </h2>
            {showIndividual ? (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-muted" />
            )}
          </button>
          {showIndividual && (
            <div className="border-t border-border-soft divide-y divide-border-soft">
              {report.individualSummaries.map((s) => (
                <div key={s.ticker} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="font-mono font-semibold text-text">{s.ticker}</span>
                    <span className="text-text-2">— {s.company}</span>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
                    {[
                      ['Fundamental', s.fundamental],
                      ['Technical', s.technical],
                      ['Sentiment', s.sentiment],
                      ['Economy Flow', s.economyFlow],
                      ['PM Note', s.pmNote],
                    ].map(([label, value]) =>
                      value ? (
                        <div key={label} className="contents">
                          <dt className="text-text-muted">{label}</dt>
                          <dd className="text-text-2 leading-snug">{value}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Not recommended */}
      {report.notRecommended.length > 0 && (
        <section className="surface p-4">
          <h2 className="text-sm font-semibold text-text mb-2">Not Recommended</h2>
          <ul className="space-y-1.5 text-sm">
            {report.notRecommended.map((r, i) => (
              <li key={i} className="flex gap-2 text-text-2">
                <span className="text-text-muted mt-1">·</span>
                <span className="leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
