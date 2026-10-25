'use client';

import DashboardShell from '../../../components/dashboard/DashboardShell';
import EngineWorkflowScreen from './EngineWorkflowScreen';

export default function SettingsEnginesPage() {
  return <DashboardShell view="settings">{() => <EngineWorkflowScreen />}</DashboardShell>;
}
