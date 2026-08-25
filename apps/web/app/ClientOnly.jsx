'use client';

import { useEffect, useState } from 'react';

const RELOAD_PARAM = '_tce_reload';
const RELOAD_GUARD_MS = 10_000;

function recoverFromStaleChunk(error) {
  if (typeof window === 'undefined') return;

  const target = error?.target;
  const src = typeof target?.src === 'string' ? target.src : '';
  if (!src.includes('/_next/static/')) return;

  // A rolling deployment replaces the Next.js build and can invalidate chunks
  // that an already-open tab still references. Reload once with a cache-busting
  // query so the browser obtains fresh HTML/build metadata instead of looping.
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has(RELOAD_PARAM)) return;

  currentUrl.searchParams.set(RELOAD_PARAM, String(Date.now()));
  window.location.replace(currentUrl.toString());
}

export default function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const onError = (event) => recoverFromStaleChunk(event);
    window.addEventListener('error', onError, true);

    // Remove the recovery marker after a healthy boot so a future deployment
    // can recover again without leaving a cache-busting URL behind.
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.has(RELOAD_PARAM)) {
        url.searchParams.delete(RELOAD_PARAM);
        window.history.replaceState(window.history.state, '', url.toString());
      }
    }, RELOAD_GUARD_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  if (!mounted) return <div className="loading-screen">Loading TCE…</div>;
  return children;
}
