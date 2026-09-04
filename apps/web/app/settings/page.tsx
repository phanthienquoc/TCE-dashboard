'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import { SettingsView } from '../../components/dashboard/DashboardViews';

export default function SettingsPage() {
  return <DashboardShell view="settings">{() => <SettingsView />}</DashboardShell>;
}
