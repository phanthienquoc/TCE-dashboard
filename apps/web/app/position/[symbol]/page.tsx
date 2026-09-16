'use client';

import { use } from 'react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { DividendPositionDetail } from '../../../components/dashboard/DividendPositionDetail';

export default function PositionSymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = use(params);
  return (
    <DashboardShell view="positions">
      {(data, actions) => (
        <DividendPositionDetail
          symbol={decodeURIComponent(resolvedParams.symbol)}
          data={data}
          actions={actions}
        />
      )}
    </DashboardShell>
  );
}
