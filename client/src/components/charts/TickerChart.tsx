// TickerChart — TradingView-style candle + volume chart wrapping the
// `lightweight-charts` library. Theme-reactive (re-reads CSS variables when
// the user toggles dark/light), with a segmented timeframe switcher and a
// 60s auto-refresh during market hours. Verdict-marker overlay & tooltip
// are layered on in v1.2.0.
//
// The component is dynamically imported by TickerPage via React.lazy so the
// ~45 KB-gz lightweight-charts payload is excluded from the initial bundle.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type DeepPartial,
  type ChartOptions,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useStore } from '../../store';

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'Max';

interface CandleBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlePayload {
  ticker: string;
  interval: string;
  range: string;
  timeframe?: string;
  currency: string | null;
  exchangeName: string | null;
  previousClose: number | null;
  candles: CandleBar[];
}

export interface DailyScoreRow {
  id: number;
  ticker: string;
  date: string; // ISO
  market: string | null;
  company: string | null;
  signal: string;
  composite: number;
  fundamental: number | null;
  technical: number | null;
  sentiment: number | null;
  economyFlow: number | null;
  keyReason: string | null;
  flags: string | null;
}

export interface MarkerPrefs {
  showMarkers: boolean;
  onlyBuy: boolean;
  hideWatch: boolean;
}

export interface TickerChartProps {
  ticker: string;
  initialTimeframe?: Timeframe;
  scores?: DailyScoreRow[];
  markerPrefs?: MarkerPrefs;
  onHoverMarker?: (
    info: { marker: DailyScoreRow; clientX: number; clientY: number } | null,
  ) => void;
}

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'Max'];

interface ChartColors {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  borderSoft: string;
  up: string;
  down: string;
  accent: string;
  warning: string;
}

function readColors(): ChartColors {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: cs.getPropertyValue('--c-bg').trim() || '#ffffff',
    surface: cs.getPropertyValue('--c-surface').trim() || '#ffffff',
    text: cs.getPropertyValue('--c-text').trim() || '#28231d',
    textMuted: cs.getPropertyValue('--c-text-muted').trim() || '#8b8275',
    border: cs.getPropertyValue('--c-border').trim() || '#d8cdb8',
    borderSoft: cs.getPropertyValue('--c-border-soft').trim() || '#e9e1d2',
    up: cs.getPropertyValue('--c-success').trim() || '#10b981',
    down: cs.getPropertyValue('--c-error').trim() || '#ef4444',
    accent: cs.getPropertyValue('--c-accent').trim() || '#d97757',
    warning: cs.getPropertyValue('--c-warning').trim() || '#f59e0b',
  };
}

function isMarketHours(now = new Date()): boolean {
  // Approximation: US market hours 13:30–20:00 UTC weekdays.
  // KLSE is 01:00–09:00 UTC Mon–Fri. Combined window = "weekday daytime".
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  return h >= 1 && h <= 20;
}

export default function TickerChart({
  ticker,
  initialTimeframe = '3M',
  scores = [],
  markerPrefs = { showMarkers: true, onlyBuy: false, hideWatch: false },
  onHoverMarker,
}: TickerChartProps) {
  const themeKey = useStore((s) => s.theme);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [colors, setColors] = useState<ChartColors>(() =>
    typeof window === 'undefined'
      ? {
          bg: '#ffffff',
          surface: '#ffffff',
          text: '#28231d',
          textMuted: '#8b8275',
          border: '#d8cdb8',
          borderSoft: '#e9e1d2',
          up: '#10b981',
          down: '#ef4444',
          accent: '#d97757',
          warning: '#f59e0b',
        }
      : readColors(),
  );

  // Re-resolve colors on theme toggle.
  useEffect(() => {
    setColors(readColors());
  }, [themeKey]);

  // Candle data fetch. Auto-refresh every 60s during market hours.
  const { data, isLoading, error } = useQuery({
    queryKey: ['candles', ticker, timeframe],
    queryFn: () =>
      api.get<CandlePayload>(
        `/api/quotes/${encodeURIComponent(ticker)}/candles?timeframe=${encodeURIComponent(
          timeframe,
        )}`,
      ),
    staleTime: 30_000,
    refetchInterval: () => (isMarketHours() ? 60_000 : false),
    refetchOnWindowFocus: false,
  });

  // Build the chart instance once and dispose on unmount / theme change.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const options: DeepPartial<ChartOptions> = {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: colors.borderSoft },
        horzLines: { color: colors.borderSoft },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    };
    const chart = createChart(el, options);
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.up,
      downColor: colors.down,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
    candleSeriesRef.current = candleSeries;

    // Volume — separate price scale, scaled down to occupy the bottom 25%.
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: colors.up,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Markers plugin — v5 split this out of the series API.
    markersPluginRef.current = createSeriesMarkers(candleSeries, []);

    return () => {
      markersPluginRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [colors]);

  // Push candle data into the series.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;
    if (!data?.candles?.length) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }
    const candleData = data.candles.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const volumeData = data.candles.map((b) => ({
      time: b.time as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? colors.up + '88' : colors.down + '88',
    }));
    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data, colors]);

  // Verdict markers (v1.2.0).
  const visibleScores = useMemo(() => {
    if (!markerPrefs.showMarkers || !scores.length) return [];
    return scores.filter((s) => {
      const sig = s.signal.toUpperCase();
      if (sig === 'HOLD') return false;
      if (markerPrefs.onlyBuy && sig !== 'BUY') return false;
      if (markerPrefs.hideWatch && sig === 'WATCH') return false;
      return true;
    });
  }, [scores, markerPrefs]);

  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin) return;
    if (!visibleScores.length) {
      plugin.setMarkers([]);
      return;
    }
    const markers: SeriesMarker<Time>[] = visibleScores.map((s) => {
      const sig = s.signal.toUpperCase();
      const time = Math.floor(new Date(s.date).getTime() / 1000) as UTCTimestamp;
      if (sig === 'BUY') {
        return {
          time,
          position: 'belowBar',
          color: colors.up,
          shape: 'arrowUp',
          text: `BUY ${s.composite.toFixed(1)}`,
        };
      }
      if (sig === 'WATCH') {
        return {
          time,
          position: 'aboveBar',
          color: colors.warning,
          shape: 'circle',
          text: `WATCH ${s.composite.toFixed(1)}`,
        };
      }
      // AVOID (or anything else non-HOLD)
      return {
        time,
        position: 'aboveBar',
        color: colors.down,
        shape: 'arrowDown',
        text: `${sig} ${s.composite.toFixed(1)}`,
      };
    });
    plugin.setMarkers(markers);
  }, [visibleScores, colors]);

  // Crosshair hover → emit nearest-marker info to parent for tooltip rendering.
  const scoresByTime = useMemo(() => {
    const m = new Map<number, DailyScoreRow>();
    for (const s of visibleScores) {
      const t = Math.floor(new Date(s.date).getTime() / 1000);
      m.set(t, s);
    }
    return m;
  }, [visibleScores]);

  const emitHover = useCallback(
    (info: { marker: DailyScoreRow; clientX: number; clientY: number } | null) => {
      onHoverMarker?.(info);
    },
    [onHoverMarker],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!onHoverMarker) return;
    const handler = (param: any) => {
      if (!param || !param.time || !param.point) {
        emitHover(null);
        return;
      }
      const t = param.time as number;
      // Lightweight Charts emits the time of the bar under the crosshair —
      // we look for an exact match. If the marker happens to land on the
      // same bar, show the tooltip.
      const hit = scoresByTime.get(t);
      if (hit) {
        emitHover({ marker: hit, clientX: param.point.x, clientY: param.point.y });
      } else {
        emitHover(null);
      }
    };
    chart.subscribeCrosshairMove(handler);
    return () => {
      chart.unsubscribeCrosshairMove(handler);
    };
  }, [scoresByTime, emitHover, onHoverMarker]);

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="tabstrip">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`font-mono ${timeframe === tf ? 'active' : ''}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="surface relative" style={{ minHeight: 480 }}>
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: 480 }}
          data-testid="ticker-chart-container"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm bg-bg/40 backdrop-blur-[1px]">
            Fetching candles…
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-error text-sm">
            {(error as Error).message || 'Failed to load chart'}
          </div>
        )}
        {!isLoading && !error && !data?.candles?.length && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
