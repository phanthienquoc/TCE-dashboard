'use client';

import dynamic from 'next/dynamic';
import DashboardShell from '../../components/dashboard/DashboardShell';

const BinanceRealtimeChart = dynamic(
  () =>
    import('../../components/dashboard/BinanceRealtimeChart').then(mod => mod.BinanceRealtimeChart),
  { ssr: false }
);

export default function BinanceChartPage() {
  return (
    <DashboardShell view="overview">
      {() => <BinanceRealtimeChart symbol="BTCUSDT" interval="1m" limit={240} />}
    </DashboardShell>
  );
}
