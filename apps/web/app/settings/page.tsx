'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import SettingsHome from '../../components/settings/SettingsHome';

export default function SettingsPage() {
  return <DashboardShell view="settings">{() => <SettingsHome />}</DashboardShell>;
}
