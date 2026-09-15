'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { DividendPositionsView } from '../../components/dashboard/DividendPositionsView';

export default function PositionPage() {
  return (
    <DashboardShell view="positions">
      {(data, actions) => <DividendPositionsView data={data} actions={actions} />}
    </DashboardShell>
  );
}
