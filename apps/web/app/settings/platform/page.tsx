'use client';

import DashboardShell from '../../../components/dashboard/DashboardShell';
import PlatformConfigTab from '../../../components/config/PlatformConfigTab';

export default function PlatformSettingsPage() {
  return <DashboardShell view="settings">{() => <PlatformConfigTab />}</DashboardShell>;
}
