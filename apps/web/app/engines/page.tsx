'use client';

import { Cpu } from 'lucide-react';
import { useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import EngineControlPanel from './EngineControlPanel';
import { useAuthStore } from '../../lib/store';
import './engine-cards.css';

export default function EnginesPage() {
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  if (authLoading || !initialized || !user) {
    return (
      <main className="app-shell">
        <div className="app-container app-content">
          <div className="loading-state flex items-center gap-3 p-4">
            <div className="brand-orb">
              <Cpu className="size-4" />
            </div>
            <div className="min-w-0">
              <strong className="block">Opening TCE</strong>
              <span className="text-sm text-muted">Checking secure session…</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <DashboardLayout activeId="engine">
      <EngineControlPanel />
    </DashboardLayout>
  );
}
