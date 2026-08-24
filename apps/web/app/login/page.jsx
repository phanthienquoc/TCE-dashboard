'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/api';
import { clearSession, saveSession } from '../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A login page is a clean auth boundary. Never let an expired token or
    // refresh token interfere with the first credential POST.
    clearSession();
  }, []);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await login(email.trim(), password);
      if (data.mfaRequired) {
        localStorage.setItem('tce_mfa_user_id', data.userId);
        throw new Error('MFA verification is required.');
      }
      saveSession(data);
      router.replace('/');
    } catch (err) {
      clearSession();
      setError(err.response?.data?.message || err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void submit();
  }

  return (
    <section className="auth-shell">
      <div className="auth-glow" />
      <div className="auth-brand">
        <div className="brand-mark">T</div>
        <div>
          <span className="eyebrow">TCE</span>
          <b>Treasury Cash Extraction</b>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-kicker">WELCOME BACK</span>
          <h1>Sign in</h1>
          <p>Access your trading workspace securely.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>
          <div className="auth-options">
            <span className="secure-badge">● Backend secured</span>
          </div>
          <button
            className="auth-submit"
            disabled={loading}
            type="submit"
          >
            <span>{loading ? 'Signing in…' : 'Sign in'}</span>
            <span>→</span>
          </button>
          <div className="auth-error" role="alert">{error}</div>
        </form>
        <div className="auth-footer">
          <span>Next.js • Axios • JWT</span>
        </div>
      </div>
    </section>
  );
}
