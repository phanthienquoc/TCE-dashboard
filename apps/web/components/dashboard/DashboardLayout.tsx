'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, BarChart3, Bell, CalendarDays, Cpu, Home, Settings } from 'lucide-react';
import { NavigationDock } from '../navigation/NavigationDock';

type DashboardNavigationId =
  'overview' | 'positions' | 'orders' | 'engine' | 'events' | 'notifications' | 'settings';

export const dashboardNavigation = [
  { id: 'overview' as const, label: 'Overview', icon: Home, href: '/overview' },
  { id: 'positions' as const, label: 'Positions', icon: BarChart3, href: '/position' },
  { id: 'orders' as const, label: 'Orders', icon: ArrowLeftRight, href: '/order' },
  { id: 'engine' as const, label: 'Engine', icon: Cpu, href: '/engine' },
  { id: 'events' as const, label: 'Events', icon: CalendarDays, href: '/stock-events' },
  { id: 'notifications' as const, label: 'Alerts', icon: Bell, href: '/notifications' },
  { id: 'settings' as const, label: 'Settings', icon: Settings, href: '/settings' },
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
