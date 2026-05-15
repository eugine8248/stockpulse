import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StockReport } from '../../hooks/useReports';

interface Props {
  report: StockReport;
}

function signalClasses(signal: string): string {
  switch (signal.toUpperCase()) {
    case 'BUY':
      return 'text-up bg-up/10 border-up/30';
    case 'WATCH':
      return 'text-warning bg-warning/10 border-warning/30';
    case 'HOLD':
      return 'text-textMuted bg-textMuted/10 border-border';
    case 'SELL':
      return 'text-down bg-down/10 border-down/30';
    default:
      return 'text-accent bg-accent/10 border-accent/30';
  }
}

export default function ReportBody({ report }: Props) {
  const [showIndividual, setShowIndividual] = useState(false);

  return (
    <div className="space-y-4">
      {/* Meta chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded border border-border text-textMuted">
          Goal: <span className="text-text font-mono">{report.goal || '—'}</span>
        </span>
        <span className="px-2 py-1 rounded border border-border text-textMuted">
          Horizon: <span className="text-text font-mono">{report.horizon || '—'}</span>
        </span>
        <span className="px-2 py-1 rounded border border-border text-textMuted">
          Markets: <span className="text-text font-mono">{report.markets || '—'}</span>
        </span>
      </div>

      {/* Executive summary */}
      {report.executiveSummary && (
        <section className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-medium text-text mb-2">Executive Summary</h2>
          <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </section>
      )}

      {/* Top picks table */}
      {report.topPicks.length > 0 && (
        <section className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-text">Top Picks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-textMuted text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">#</th>
                  <th className="text-left px-3 py-2 font-normal">Ticker</th>
                  <th className="text-left px-3 py-2 font-normal hidden sm:table-cell">Company</th>
                  <th className="text-left px-3 py-2 font-normal hidden md:table-cell">Market</th>
                  <th className="text-right px-3 py-2 font-normal">Score</th>
                  <th className="text-center px-3 py-2 font-normal">Signal</th>
                  <th className="text-left px-3 py-2 font-normal hidden lg:table-cell">Key reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.topPicks.map((p) => (
                  <tr key={`${p.rank}-${p.ticker}`} className="hover:bg-elevated/50">
                    <td className="px-3 py-2 text-textFaint font-mono">{p.rank}</td>
                    <td className="px-3 py-2 font-mono text-text">{p.ticker}</td>
                    <td className="px-3 py-2 text-textMuted hidden sm:table-cell">{p.company}</td>
                    <td className="px-3 py-2 text-textFaint hidden md:table-cell font-mono text-xs">{p.market}</td>
                    <td className="px-3 py-2 text-right font-mono text-text">{p.score.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border font-mono text-xs ${signalClasses(p.signal)}`}
                      >
                        {p.signal}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-textMuted text-xs hidden lg:table-cell">{p.keyReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Economy & Flow Highlights */}
      {report.economyHighlights.length > 0 && (
        <section className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-medium text-text mb-2">Economy & Flow</h2>
          <ul className="space-y-1.5 text-sm">
            {report.economyHighlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-text/90">
                <span className="text-textFaint mt-1">·</span>
                <span className="leading-snug">{h}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sector Flow + Risks side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.sectorFlow && (
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-text mb-2">Sector Flow</h2>
            <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">
              {report.sectorFlow}
            </p>
          </section>
        )}

        {report.risks.length > 0 && (
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-text mb-2">Risks & Caveats</h2>
            <ul className="space-y-1.5 text-sm">
              {report.risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-text/90">
                  <span className="text-down mt-1">·</span>
                  <span className="leading-snug">{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Individual summaries — collapsible */}
      {report.individualSummaries.length > 0 && (
        <section className="bg-surface border border-border rounded-lg">
          <button
            type="button"
            onClick={() => setShowIndividual((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-elevated/40 min-h-11"
            aria-expanded={showIndividual}
          >
            <h2 className="text-sm font-medium text-text">
              Individual Summaries
              <span className="ml-2 text-textFaint font-normal">
                ({report.individualSummaries.length})
              </span>
            </h2>
            {showIndividual ? (
              <ChevronDown className="w-4 h-4 text-textMuted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-textMuted" />
            )}
          </button>
          {showIndividual && (
            <div className="border-t border-border divide-y divide-border">
              {report.individualSummaries.map((s) => (
                <div key={s.ticker} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="font-mono font-semibold text-text">{s.ticker}</span>
                    <span className="text-textMuted">— {s.company}</span>
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
                          <dt className="text-textFaint">{label}</dt>
                          <dd className="text-text/90 leading-snug">{value}</dd>
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
        <section className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-medium text-text mb-2">Not Recommended</h2>
          <ul className="space-y-1.5 text-sm">
            {report.notRecommended.map((r, i) => (
              <li key={i} className="flex gap-2 text-text/90">
                <span className="text-textFaint mt-1">·</span>
                <span className="leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
