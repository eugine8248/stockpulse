import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface TopPick {
  rank: number;
  ticker: string;
  company: string;
  market: string;
  score: number;
  signal: string;
  keyReason: string;
}

export interface IndividualSummary {
  ticker: string;
  company: string;
  fundamental: string;
  technical: string;
  sentiment: string;
  economyFlow: string;
  pmNote: string;
}

export interface StockReport {
  date: string;
  goal: string;
  horizon: string;
  markets: string;
  executiveSummary: string;
  topPicks: TopPick[];
  economyHighlights: string[];
  sectorFlow: string;
  individualSummaries: IndividualSummary[];
  risks: string[];
  notRecommended: string[];
  rawMarkdown: string;
}

export interface ReportNav {
  newer: string | null;
  older: string | null;
  all: string[];
}

export interface ReportPayload {
  report: StockReport;
  nav: ReportNav;
}

export function useReportDates() {
  return useQuery({
    queryKey: ['stock-report-dates'],
    queryFn: () => api.get<{ dates: string[] }>('/api/reports/stock-analysis'),
    staleTime: 60_000,
  });
}

export function useReport(date: string | undefined) {
  return useQuery({
    queryKey: ['stock-report', date],
    queryFn: () => api.get<ReportPayload>(`/api/reports/stock-analysis/${date}`),
    enabled: Boolean(date),
    staleTime: 60_000,
  });
}
