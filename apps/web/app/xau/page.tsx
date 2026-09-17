'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { XauPanelSkeleton, DetailSkeleton } from '../../components/ui/page-skeleton';
import { useAuthStore } from '../../lib/store';

const BinanceXauTradingPanel = dynamic(() => import('../engines/BinanceXauTradingPanel'), {
  loading: () => <XauPanelSkeleton />,
});

export default function XauPage() {
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (authLoading || !initialized) {
    return <DetailSkeleton />;
  }
  if (!user) return null;

  return (
    <DashboardLayout activeId="engine">
      <div className="engine-page-content">
        <BinanceXauTradingPanel />
      </div>
    </DashboardLayout>
  );
}
