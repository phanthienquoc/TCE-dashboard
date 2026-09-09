'use client';

import type { ReactNode } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';

export default function EnginesLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout activeId="engine">{children}</DashboardLayout>;
}
