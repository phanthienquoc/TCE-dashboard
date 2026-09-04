'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { OverviewView } from '../../components/dashboard/DashboardViews';

export default function OverviewPage() {
  return <DashboardShell view="overview">{(data, actions) => <OverviewView data={data} actions={actions} />}</DashboardShell>;
}
