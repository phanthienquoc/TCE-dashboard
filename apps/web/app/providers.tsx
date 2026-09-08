'use client';

import { useEffect } from 'react';
import { useUIStore } from '../lib/ui-store';
import { ToastProvider, useToast } from '../components/ui/toast';
import { ThemeProvider } from '../shareComponent/theme-provider';
import { useAuthStore } from '../lib/store';
import {
  checkLatestSystemUpdate,
  registerSystemServiceWorker,
  syncGrantedSystemUpdateNotifications,
} from '../lib/system-updates';
import { rememberSystemUpdate } from '../lib/system-updates';

function SystemUpdateBridge() {
  const authStatus = useAuthStore(state => state.status);
  const toast = useToast();

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let disposed = false;

    const init = async () => {
      try {
        await registerSystemServiceWorker();
        await syncGrantedSystemUpdateNotifications();
        await checkLatestSystemUpdate(update => {
          if (disposed) return;
          toast(update.message, 'info');
        });
      } catch (error) {
        console.debug('[SYSTEM_UPDATE_INIT]', error);
      }
    };

    void init();

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'SYSTEM_UPDATE') return;
      const version = typeof data.version === 'string' ? data.version : '';
      if (version) rememberSystemUpdate(version);
      toast(
        typeof data.title === 'string'
          ? `${data.title}: ${typeof data.body === 'string' ? data.body : 'A new version is available.'}`
          : typeof data.body === 'string'
            ? data.body
            : 'A new version is available.',
        'info'
      );
    };

    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      disposed = true;
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [authStatus, toast]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider defaultTheme="tce">
      <ToastProvider>
        <SystemUpdateBridge />
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
