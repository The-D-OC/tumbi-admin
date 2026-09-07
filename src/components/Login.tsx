import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Email + password sign-in. Any registered user can sign in, but the app only
 * unlocks for admins (checked via is_admin() after login) — see App.tsx.
 */
export function Login({ notAdmin }: { notAdmin?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="app setup">
      <div className="card">
        <h2>Admin sign in</h2>
        <p className="subtle">Sign in with your Tumbi admin account to manage classes and offers.</p>

        {notAdmin && (
          <div className="banner err">
            That account isn’t an admin. Sign out and use an admin account, or ask for access.
          </div>
        )}
        {error && <div className="banner err">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="footer-actions">
            <button type="submit" className="pill-btn" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        {notAdmin && (
          <p className="subtle" style={{ marginTop: 16 }}>
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
