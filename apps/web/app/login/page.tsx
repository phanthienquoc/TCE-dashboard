'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  const loginWithPasskey = useAuthStore(s => s.loginWithPasskey);
  const mfa = useAuthStore(s => s.mfa);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardShift, setKeyboardShift] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth > 767) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const updateKeyboardShift = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        const card = document.querySelector<HTMLElement>('.auth-card');
        if (!(active instanceof HTMLElement) || !card) {
          setKeyboardShift(0);
          return;
        }
        const isField = active.matches('input, textarea, select');
        const keyboardOpen = window.innerHeight - viewport.height > 120;
        if (!isField || !keyboardOpen) {
          setKeyboardShift(0);
          return;
        }
        const viewportBottom = viewport.offsetTop + viewport.height;
        const fieldBottom = active.getBoundingClientRect().bottom;
        const overlap = fieldBottom + 20 - viewportBottom;
        setKeyboardShift(Math.min(320, Math.max(0, overlap)));
      });
    };
    const onFocus = () => window.setTimeout(updateKeyboardShift, 40);
    const onBlur = () => window.setTimeout(updateKeyboardShift, 80);
    viewport.addEventListener('resize', updateKeyboardShift);
    viewport.addEventListener('scroll', updateKeyboardShift);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    updateKeyboardShift();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', updateKeyboardShift);
      viewport.removeEventListener('scroll', updateKeyboardShift);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (pending) await mfa(pending, code.trim());
      else {
        const result = await login(email.trim(), password);
        if (result.mfaRequired) {
          setPending(result.userId!);
          return;
        }
      }
      router.replace('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  const passkeySubmit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await loginWithPasskey();
      if (result.mfaRequired) {
        setPending(result.userId!);
        return;
      }
      router.replace('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Unable to sign in with passkey');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow" aria-hidden="true" />
      <section
        className="auth-card"
        aria-label="Sign in"
        style={{ '--auth-keyboard-shift': `${keyboardShift}px` } as CSSProperties}
      >
        <form onSubmit={submit} noValidate>
          {pending ? (
            <label>
              <span className="sr-only">MFA code</span>
              <Input
                autoFocus
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                aria-label="MFA code"
              />
            </label>
          ) : (
            <>
              <label>
                <span className="sr-only">Email</span>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  aria-label="Email"
                />
              </label>
              <label>
                <span className="sr-only">Password</span>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-label="Password"
                />
              </label>
            </>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-actions">
            <Button className="auth-submit auth-sign-in" type="submit" disabled={busy}>
              <span>{busy ? 'Working…' : pending ? 'Verify code' : 'Sign in'}</span>
              <ArrowRight size={19} strokeWidth={2} aria-hidden="true" />
            </Button>
            {!pending && (
              <Button
                className="auth-passkey"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void passkeySubmit()}
                aria-label="Sign in with passkey"
                title="Sign in with passkey"
              >
                <KeyRound size={24} strokeWidth={2} aria-hidden="true" />
              </Button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
