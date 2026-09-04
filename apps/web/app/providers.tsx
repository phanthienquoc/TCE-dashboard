'use client';

import { useEffect } from 'react';
import { useUIStore } from '../lib/ui-store';
import { ToastProvider } from '../components/ui/toast';
import { ThemeProvider } from '../shareComponent/theme-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider defaultTheme="tce">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
