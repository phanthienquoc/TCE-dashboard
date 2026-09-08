'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, Home, Layers3, Search, Settings } from 'lucide-react';
import { NavigationDock } from '../navigation/NavigationDock';

type DashboardNavigationId =
  | 'overview'
  | 'pools'
  | 'positions'
  | 'orders'
  | 'scan'
  | 'engine'
  | 'events'
  | 'notifications'
  | 'settings';

export const dashboardNavigation = [
  { id: 'overview' as const, label: 'Home', icon: Home, href: '/overview' },
  { id: 'pools' as const, label: 'Pools', icon: Layers3, href: '/pool' },
  { id: 'positions' as const, label: 'Positions', icon: ArrowLeftRight, href: '/position' },
  { id: 'scan' as const, label: 'Scan', icon: Search, href: '/scan' },
  { id: 'settings' as const, label: 'More', icon: Settings, href: '/settings' },
];

export default function DashboardLayout({
  activeId,
  children,
  overlay,
}: {
  activeId: DashboardNavigationId;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const items = dashboardNavigation.map(item => ({ ...item, active: item.id === activeId }));

  return (
    <main className="app-shell">
      <div className="dashboard-layout">
        <div className="app-container app-content">{children}</div>
        <NavigationDock items={items} />
      </div>
      {overlay}
    </main>
  );
}
