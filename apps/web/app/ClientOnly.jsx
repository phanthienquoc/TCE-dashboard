'use client';

import { useEffect, useState } from 'react';

const RELOAD_KEY = 'tce:chunk-recovery';
const RELOAD_GUARD_MS = 10_000;

function recoverFromStaleChunk(error) {
  if (typeof window === 'undefined') return;

  const target = error?.target;
  const src = typeof target?.src === 'string' ? target.src : '';
  if (!src.includes('/_next/static/')) return;

  // A rolling deployment replaces the Next.js build and can invalidate chunks
  // that an already-open tab still references. Reload once with a cache-busting
  // query so the browser obtains fresh HTML/build metadata instead of looping.
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

    // Keep the guard briefly after boot. If the fresh build also fails to load,
    // do not enter an infinite reload loop; after a healthy boot future deploys
    // can use the recovery path again.
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(RELOAD_KEY);
    }, RELOAD_GUARD_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  if (!mounted) return <div className="loading-screen">Loading TCE…</div>;
  return children;
}
