'use client';

import { useEffect } from 'react';
import { useUIStore } from '../lib/ui-store';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}
