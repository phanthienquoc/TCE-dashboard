'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, notifyApiError } from '../../lib/api';
import { clearSession, saveSession } from '../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      if (err.response || err.code) notifyApiError(err, 'Unable to sign in.');
      setError(err.response?.data?.message || err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
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

        <div className="auth-fields">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            />
          </label>
        </div>

        <div className="auth-options">
          <span className="secure-badge">● Backend secured</span>
        </div>

        <button
          className="auth-submit"
          type="button"
          disabled={loading}
          onClick={submit}
        >
          <span>{loading ? 'Signing in…' : 'Sign in'}</span>
          <span>→</span>
        </button>

        <div className="auth-error" role="alert">{error}</div>

        <div className="auth-footer">
          <span>Next.js • Axios • JWT</span>
        </div>
      </div>
    </section>
  );
}
