import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage({ onLogin }: { onLogin: (t: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(email, password);
      onLogin(null); // setToken called inside login; onLogin just nudges App re-render
      navigate('/', { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 space-y-4"
      >
        <div>
          <h1 className="font-mono text-accent text-xl">stockpulse</h1>
          <p className="text-textMuted text-sm">Sign in to your dashboard</p>
        </div>
        <div>
          <label className="block text-xs text-textMuted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-textMuted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        {err && <div className="text-down text-xs">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent hover:bg-accentHover text-white py-1.5 rounded disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
