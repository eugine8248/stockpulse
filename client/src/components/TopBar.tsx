import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, FileText, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';

/**
 * TopBar — framedeck-style IDE bar.
 *   - Orange checkmark logo + "stockpulse" wordmark (sister-app cue)
 *   - Connection-status dot with text label on desktop
 *   - Icon-only nav (reports / alerts / settings) — surface-muted hover
 *   - Theme toggle + sign out
 */
export default function TopBar() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const status = useStore((s) => s.connectionStatus);
  const { logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const dotColor =
    status === 'connected'
      ? 'bg-success'
      : status === 'reconnecting'
      ? 'bg-warning'
      : status === 'stale'
      ? 'bg-error'
      : 'bg-text-muted';

  const navIconClass = (active: boolean) =>
    [
      'inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors',
      active
        ? 'bg-surface-muted text-accent'
        : 'text-text-2 hover:bg-surface-muted hover:text-text',
    ].join(' ');

  return (
    <header className="sticky top-0 z-40 h-14 bg-surface border-b border-border-soft flex items-center px-3 sm:px-6 lg:px-8 gap-1 sm:gap-3 md:gap-4">
      <Link to="/" className="flex items-center gap-2 shrink-0" title="stockpulse">
        <Logo />
        <span className="font-semibold text-sm">stockpulse</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-xs text-text-muted shrink-0" title={status}>
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <span className="hidden md:inline">{status}</span>
      </div>

      <Link
        to="/"
        className={navIconClass(location.pathname === '/' || location.pathname.startsWith('/ticker'))}
        title="Watchlist"
        aria-label="Watchlist"
      >
        <WatchlistIcon />
      </Link>

      <Link
        to="/reports"
        className={navIconClass(location.pathname.startsWith('/reports'))}
        title="Reports"
        aria-label="Reports"
      >
        <FileText className="w-5 h-5" />
      </Link>

      <Link
        to="/alerts"
        className={navIconClass(location.pathname === '/alerts')}
        title="Alerts"
        aria-label="Alerts"
      >
        <Bell className="w-5 h-5" />
      </Link>

      <Link
        to="/settings"
        className={navIconClass(location.pathname === '/settings')}
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5" />
      </Link>

      <button
        onClick={toggleTheme}
        className={navIconClass(false)}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {token && (
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className={navIconClass(false)}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}
    </header>
  );
}

/**
 * Logo — same orange-square + checkmark glyph as framedeck/taskpulse so the
 * sister-app branding is visually consistent at a glance.
 */
function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="var(--c-accent)" />
      <path
        d="M10 22 L14 14 L18 18 L24 10"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * WatchlistIcon — small 3-bar chart glyph that pairs with framedeck's
 * iconography. Avoids re-using lucide's Activity icon for the brand strip.
 */
function WatchlistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="4" height="10" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}
