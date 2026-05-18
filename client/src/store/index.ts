import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'stale' | 'paused' | 'disconnected';

export interface PriceTick {
  symbol: string;
  price: number;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  volume: number | null;
  ts: number;
}

export interface AlertToast {
  id: number;
  symbol: string;
  message: string;
  alertType: string;
  observedValue: number;
  triggeredAt: string;
}

interface State {
  token: string | null;
  setToken: (t: string | null) => void;

  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;

  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;

  prices: Record<string, PriceTick>;
  applyPrice: (p: PriceTick) => void;

  alertToasts: AlertToast[];
  pushAlertToast: (a: AlertToast) => void;
  dismissAlertToast: (id: number) => void;
}

const STORAGE_TOKEN = 'stockpulse.token';
const STORAGE_THEME = 'stockpulse.theme';

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_THEME) as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  // OS preference fallback — matches the FOUC-free init script in index.html
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export const useStore = create<State>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_TOKEN) : null,
  setToken: (t) => {
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem(STORAGE_TOKEN, t);
      else localStorage.removeItem(STORAGE_TOKEN);
    }
    set({ token: t });
  },

  theme: initialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_THEME, next);
      return { theme: next };
    }),
  setTheme: (t) => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_THEME, t);
    set({ theme: t });
  },

  connectionStatus: 'disconnected',
  setConnectionStatus: (s) => set({ connectionStatus: s }),

  prices: {},
  applyPrice: (p) =>
    set((s) => ({
      prices: { ...s.prices, [p.symbol.toUpperCase()]: p },
    })),

  alertToasts: [],
  pushAlertToast: (a) =>
    set((s) => ({ alertToasts: [a, ...s.alertToasts].slice(0, 4) })),
  dismissAlertToast: (id) =>
    set((s) => ({ alertToasts: s.alertToasts.filter((t) => t.id !== id) })),
}));
