'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, Cpu, Home, Layers3, Settings, UserCircle } from 'lucide-react';
import { NavigationDock } from '../navigation/NavigationDock';

type DashboardNavigationId =
  | 'overview'
  | 'pools'
  | 'positions'
  | 'orders'
  | 'engine'
  | 'events'
  | 'notifications'
  | 'settings'
  | 'profile';

export const dashboardNavigation = [
  { id: 'overview' as const, label: 'Home', icon: Home, href: '/overview' },
  { id: 'pools' as const, label: 'Pools', icon: Layers3, href: '/pools' },
  { id: 'positions' as const, label: 'Positions', icon: ArrowLeftRight, href: '/position' },
  { id: 'engine' as const, label: 'Engine', icon: Cpu, href: '/engines' },
  { id: 'settings' as const, label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'profile' as const, label: 'Profile', icon: UserCircle, href: '/profile' },
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
