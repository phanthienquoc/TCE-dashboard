'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { PositionsView } from '../../components/dashboard/DashboardViews';

export default function PositionPage() {
  return (
    <DashboardShell view="positions">
      {(data, actions) => <PositionsView data={data} actions={actions} />}
    </DashboardShell>
  );
}
