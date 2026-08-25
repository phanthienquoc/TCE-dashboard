'use client';

import { useEffect, useState } from 'react';

const RELOAD_KEY = 'tce:chunk-recovery';

function recoverFromStaleChunk(error) {
  if (typeof window === 'undefined') return;

  const target = error?.target;
  const src = typeof target?.src === 'string' ? target.src : '';
  if (!src.includes('/_next/static/')) return;

  // A rolling deployment replaces the Next.js build and can invalidate chunks
  // that an already-open tab still references. Reload once with a cache-busting
  // query so the browser obtains a fresh HTML/build manifest instead of looping.
  if (window.sessionStorage.getItem(RELOAD_KEY) === '1') return;
  window.sessionStorage.setItem(RELOAD_KEY, '1');
  const url = new URL(window.location.href);
  url.searchParams.set('_tce_reload', String(Date.now()));
  window.location.replace(url.toString());
}

export default function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const onError = (event) => recoverFromStaleChunk(event);
    window.addEventListener('error', onError, true);

    // Clear the one-shot guard after a successful mount so a future deployment
    // can recover again without requiring the user to clear site data.
    window.sessionStorage.removeItem(RELOAD_KEY);

    return () => window.removeEventListener('error', onError, true);
  }, []);

  if (!mounted) return <div className="loading-screen">Loading TCE…</div>;
  return children;
}
