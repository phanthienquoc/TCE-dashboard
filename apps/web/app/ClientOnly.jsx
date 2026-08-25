'use client';

import { useEffect, useState } from 'react';

export default function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="loading-screen">Loading TCE…</div>;
  return children;
}
