'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_LOGIN_EMAIL = 'phanthienquoc@outlook.com';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await signIn(email.trim(), password);
      if (data.mfaRequired) {
        localStorage.setItem('tce_mfa_user_id', data.userId);
        throw new Error('MFA verification is required.');
      }
      router.replace('/');
    } catch (err) {
      if (err.response || err.code) notifyApiError(err, 'Unable to sign in.');
      setError(err.response?.data?.message || err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-glow" />
      <div className="auth-brand"><div className="brand-mark">T</div><div><span className="eyebrow">TCE</span><b>Treasury Cash Extraction</b></div></div>
      <form className="auth-card" method="post" onSubmit={submit} noValidate>
        <div className="auth-header"><span className="auth-kicker">WELCOME BACK</span><h1>Sign in</h1><p>Access your trading workspace securely.</p></div>
        <div className="auth-fields">
          <label>Email<input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label>
        </div>
        <div className="auth-options"><span className="secure-badge">● Backend secured</span></div>
        <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? 'Signing in…' : 'Sign in'}</span><span>→</span></button>
        <div className="auth-error" role="alert">{error}</div>
        <div className="auth-footer"><span>Next.js • Axios • JWT</span></div>
      </form>
    </section>
  );
}
