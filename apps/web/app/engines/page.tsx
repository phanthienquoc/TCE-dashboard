'use client';

import DashboardShell from '../../components/dashboard/DashboardShell';
import EngineWorkflowScreen from '../settings/engine/EngineWorkflowScreen';

export default function EnginesPage() {
  return <DashboardShell view="engine">{() => <EngineWorkflowScreen />}</DashboardShell>;
}
