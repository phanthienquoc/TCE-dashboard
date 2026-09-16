'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import TechLoading from '../../components/navigation/TechLoading';
import { useAuthStore } from '../../lib/store';

const BinanceXauTradingPanel = dynamic(() => import('../engines/BinanceXauTradingPanel'), {
  loading: () => <TechLoading label="Loading XAU execution" />,
});

export default function XauPage() {
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (authLoading || !initialized || !user) {
    return <TechLoading label="Initializing TCE runtime" />;
  }

  return (
    <DashboardLayout activeId="engine">
      <div className="engine-page-content">
        <BinanceXauTradingPanel />
      </div>
    </DashboardLayout>
  );
}
