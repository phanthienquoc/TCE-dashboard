'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { completeKeycloakLogin } from '../../../lib/keycloak-sso';
import { useAuthStore } from '../../../lib/store';

export default function KeycloakCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(true);

  useEffect(() => {
    let active = true;
    const complete = async () => {
      try {
        const accessToken = await completeKeycloakLogin(window.location.search);
        await useAuthStore.getState().completeSsoLogin(accessToken);
        if (active) {
          window.history.replaceState({}, document.title, '/auth/callback');
          router.replace('/');
          router.refresh();
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to complete SSO sign-in');
          setWorking(false);
        }
      }
    };
    void complete();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="auth-shell">
      <div className="auth-glow" aria-hidden="true" />
      <section className="auth-card" aria-label="Complete SSO sign-in">
        <h1>{working ? 'Signing you in…' : 'SSO sign-in unavailable'}</h1>
        <p role={error ? 'alert' : undefined}>
          {error || 'Verifying your Keycloak session and preparing your TCE workspace.'}
        </p>
        {!working && (
          <Button type="button" variant="outline" onClick={() => router.replace('/login')}>
            Back to sign in
          </Button>
        )}
      </section>
    </main>
  );
}
