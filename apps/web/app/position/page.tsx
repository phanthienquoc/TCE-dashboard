'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { DividendPositionsView } from '../../components/dashboard/DividendPositionsView';
import { DividendPositionsFilter } from '../../components/dashboard/DividendPositionsFilter';

export default function PositionPage() {
  return (
    <DashboardShell view="positions" pageFilter={<DividendPositionsFilter />}>
      {(data, actions) => <DividendPositionsView data={data} actions={actions} />}
    </DashboardShell>
  );
}
