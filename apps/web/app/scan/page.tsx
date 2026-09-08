import DashboardShell from '../../components/dashboard/DashboardShell';
import { ScanView } from '../../components/dashboard/DashboardViews';

export default function ScanPage() {
  return (
    <DashboardShell view="scan">
      {(data, actions) => <ScanView data={data} actions={actions} />}
    </DashboardShell>
  );
}
