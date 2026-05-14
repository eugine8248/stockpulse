import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function SetupPage({ onLogin }: { onLogin: (t: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setup } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setErr('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await setup(email, password, name || undefined);
      onLogin(null);
      navigate('/', { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-surface border border-border rounded-lg p-6 space-y-4"
      >
        <div>
          <h1 className="font-mono text-accent text-xl">Welcome to stockpulse</h1>
          <p className="text-textMuted text-sm">Create your admin account to get started</p>
        </div>
        <div>
          <label className="block text-xs text-textMuted mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
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
          <label className="block text-xs text-textMuted mb-1">Password (min 8)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-textMuted mb-1">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
