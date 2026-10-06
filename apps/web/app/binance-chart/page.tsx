import DashboardShell from '../../components/dashboard/DashboardShell';
import { BinanceRealtimeChart } from '../../components/dashboard/BinanceRealtimeChart';

export default function BinanceChartPage() {
  return (
    <DashboardShell view="overview">
      {() => <BinanceRealtimeChart symbol="BTCUSDT" interval="1m" limit={240} />}
    </DashboardShell>
  );
}
