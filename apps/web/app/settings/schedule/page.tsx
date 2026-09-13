'use client';

import DashboardShell from '../../../components/dashboard/DashboardShell';
import ProfitExitSettings from '../../../components/settings/ProfitExitSettings';

export default function ScheduleSettingsPage() {
  return <DashboardShell view="settings">{() => <ProfitExitSettings />}</DashboardShell>;
}
