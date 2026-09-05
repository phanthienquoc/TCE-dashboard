'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { PositionsView } from '../../components/dashboard/DashboardViews';

export default function PositionPage() {
  return (
    <DashboardShell view="positions">
      {data => <PositionsView data={data} actions={data.actions} />}
    </DashboardShell>
  );
}
