'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { OrdersView } from '../../components/dashboard/DashboardViews';

export default function OrderPage() {
  return <DashboardShell view="orders">{data => <OrdersView data={data} />}</DashboardShell>;
}
