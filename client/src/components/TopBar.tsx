import { Link, useNavigate } from 'react-router-dom';
import { Bell, FileText, Settings, Sun, Moon, LogOut, Activity } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';

export default function TopBar() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const status = useStore((s) => s.connectionStatus);
  const { logout, token } = useAuth();
  const navigate = useNavigate();

  const dotColor =
    status === 'connected'
      ? 'bg-up'
      : status === 'reconnecting'
      ? 'bg-warning'
      : status === 'stale'
      ? 'bg-down'
      : 'bg-textFaint';

  return (
    <header className="sticky top-0 z-40 h-14 bg-surface border-b border-border flex items-center px-3 sm:px-6 lg:px-8 gap-1 sm:gap-3 md:gap-4">
      <Link to="/" className="flex items-center gap-2 font-mono font-semibold text-accent shrink-0">
        <Activity className="w-5 h-5" />
        <span>stockpulse</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-xs text-textMuted shrink-0">
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <span className="hidden md:inline">{status}</span>
      </div>

      <Link
        to="/reports"
        className="p-2 rounded hover:bg-elevated text-textMuted hover:text-text"
        title="Reports"
      >
        <FileText className="w-4 h-4" />
      </Link>

      <Link
        to="/alerts"
        className="p-2 rounded hover:bg-elevated text-textMuted hover:text-text"
        title="Alerts"
      >
        <Bell className="w-4 h-4" />
      </Link>

      <Link
        to="/settings"
        className="p-2 rounded hover:bg-elevated text-textMuted hover:text-text"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </Link>

      <button
        onClick={toggleTheme}
        className="p-2 rounded hover:bg-elevated text-textMuted hover:text-text"
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {token && (
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="p-2 rounded hover:bg-elevated text-textMuted hover:text-text"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </header>
  );
}
