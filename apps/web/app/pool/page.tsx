'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import PoolEngineView from '../../components/dashboard/PoolEngineView';

export default function PoolPage() {
  return (
    <DashboardShell view="pools">
      {(data, actions) => <PoolEngineView data={data} actions={actions} />}
    </DashboardShell>
  );
}
