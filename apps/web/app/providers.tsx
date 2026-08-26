'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '../lib/ui-store';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    useUIStore.persist.rehydrate().finally(() => {
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return <>{hydrated ? children : <div className="min-h-svh bg-[#070b12]" aria-hidden="true" />}</>;
}
