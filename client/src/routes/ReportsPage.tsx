import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReport, useReportDates } from '../hooks/useReports';
import ReportNav from '../components/reports/ReportNav';
import TopPicksChart from '../components/reports/TopPicksChart';
import ReportBody from '../components/reports/ReportBody';

export default function ReportsPage() {
  const { date: paramDate } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const dates = useReportDates();

  // Default to most recent (today's) when no date in the URL
  const defaultDate = dates.data?.dates[0];
  const targetDate = paramDate || defaultDate;
  const report = useReport(targetDate);

  // Once the dates list lands, replace the bare /reports with the canonical date URL
  useEffect(() => {
    if (!paramDate && defaultDate) {
      navigate(`/reports/${defaultDate}`, { replace: true });
    }
  }, [paramDate, defaultDate, navigate]);

  // No reports at all
  if (dates.isSuccess && dates.data.dates.length === 0) {
    return (
      <div className="max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-text-2 mt-1">Daily stock-analysis reports.</p>
        </div>
        <div className="surface p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="text-lg font-semibold">No reports yet</h2>
          <p className="text-sm text-text-2 mt-2">
            Reports live at{' '}
            <code className="font-mono text-text">data/stock-reports/&lt;YYYY-MM-DD&gt;.md</code>.
            <br />
            The stock-analysis-daily routine populates this directory each morning.
          </p>
        </div>
      </div>
    );
  }

  // Initial load
  if (dates.isLoading || (!report.data && report.isLoading)) {
    return (
      <div className="max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
        </div>
        <div className="h-16 surface animate-pulse" />
        <div className="h-72 surface animate-pulse" />
        <div className="h-40 surface animate-pulse" />
      </div>
    );
  }

  // Error
  if (report.error) {
    return (
      <div className="max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="surface p-4 text-error text-sm">
          Failed to load report: {(report.error as Error).message}
        </div>
      </div>
    );
  }

  if (!report.data) return null;

  const { report: parsed, nav } = report.data;
  const total = nav.all.length;
  const position = Math.max(1, nav.all.indexOf(parsed.date) + 1);

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-text-2 mt-1">Daily stock-analysis reports.</p>
      </div>

      <ReportNav
        date={parsed.date}
        newer={nav.newer}
        older={nav.older}
        total={total}
        position={position}
      />

      <TopPicksChart picks={parsed.topPicks} />

      <ReportBody report={parsed} />
    </div>
  );
}
