import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api/client';
import { useStore } from './store';
import AppLayout from './components/AppLayout';
import LoginPage from './routes/LoginPage';
import SetupPage from './routes/SetupPage';
import DashboardPage from './routes/DashboardPage';
import AlertsPage from './routes/AlertsPage';
import ReportsPage from './routes/ReportsPage';
import SettingsPage from './routes/SettingsPage';

interface AuthStatus {
  hasUsers: boolean;
  noAuth: boolean;
}

export default function App() {
  const theme = useStore((s) => s.theme);
  const token = useStore((s) => s.token);
  const setToken = useStore((s) => s.setToken);
  const location = useLocation();
  const navigate = useNavigate();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Initial auth status
  const { data: status, isLoading } = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: () => api.get<AuthStatus>('/api/auth/status'),
  });

  // Routing decisions based on auth status
  useEffect(() => {
    if (!status) return;
    const path = location.pathname;
    if (status.noAuth) {
      // bypass everything
      if (path === '/login' || path === '/setup') navigate('/', { replace: true });
      return;
    }
    if (!status.hasUsers && path !== '/setup') {
      navigate('/setup', { replace: true });
      return;
    }
    if (status.hasUsers && !token && path !== '/login' && path !== '/setup') {
      navigate('/login', { replace: true });
    }
  }, [status, location.pathname, token, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-textMuted">
        Loading…
      </div>
    );
  }

  // Allow setup/login outside of layout
  if (location.pathname === '/login') return <LoginPage onLogin={setToken} />;
  if (location.pathname === '/setup') return <SetupPage onLogin={setToken} />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ticker/:symbol" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:date" element={<ReportsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
