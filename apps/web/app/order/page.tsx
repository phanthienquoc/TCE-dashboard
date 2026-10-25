'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { OrdersView } from '../../components/dashboard/DashboardViews';

export default function OrderPage() {
  return (
    <DashboardShell view="orders">
      {(data, actions) => <OrdersView data={data} actions={actions} />}
    </DashboardShell>
  );
}
