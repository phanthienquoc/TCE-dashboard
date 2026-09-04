'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function LoginPage() {
  const router = useRouter(); const login = useAuthStore(s => s.login); const mfa = useAuthStore(s => s.mfa);
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [code,setCode]=useState(''); const [pending,setPending]=useState<string|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { if (pending) await mfa(pending,code.trim()); else { const result=await login(email.trim(),password); if(result.mfaRequired){setPending(result.userId!);return;} } router.replace('/'); } catch(err:any) { setError(err?.response?.data?.message ?? 'Unable to sign in'); } finally { setBusy(false); } };
  return (
    <main className="auth-shell">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-brand" aria-label="TCE Dashboard"><div className="brand-mark">T</div><div><span className="eyebrow">Treasury Cash Extraction</span><b>TCE Dashboard</b></div></div>
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-header"><span className="auth-kicker">SECURE ACCESS</span><h1 id="login-title">Welcome back</h1><p>{pending ? 'Verify your MFA code to continue.' : 'Sign in to access your trading dashboard.'}</p></header>
        <form onSubmit={submit} noValidate>
          {pending ? <label>MFA code<Input autoFocus required value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} aria-label="MFA code" /></label> : <><label>Email<Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" /></label><label>Password<Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></label></>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-options"><span className="secure-badge"><ShieldCheck size={15} strokeWidth={2} aria-hidden="true" /> Secure session</span></div>
          <Button className="auth-submit" type="submit" disabled={busy}><span>{busy ? 'Working…' : pending ? 'Verify code' : 'Sign in'}</span><ArrowRight size={18} strokeWidth={2} aria-hidden="true" /></Button>
        </form>
        <footer className="auth-footer">TCE Dashboard · Protected access</footer>
      </section>
    </main>
  );
}
