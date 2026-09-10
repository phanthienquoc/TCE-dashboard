'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { PoolsView } from '../../components/dashboard/DashboardViews';

export default function PoolsPage() {
  return (
    <DashboardShell view="pools">
      {(data, actions) => <PoolsView data={data} actions={actions} />}
    </DashboardShell>
  );
}
