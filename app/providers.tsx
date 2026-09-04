'use client';

import { useEffect } from 'react';
import { useUIStore } from '../lib/ui-store';
import { ToastProvider } from '../components/ui/toast';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
