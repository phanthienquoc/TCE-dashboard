'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, BarChart3, Bell, Cpu, Home, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type BottomTabItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  href?: string;
};

export type BottomTabsProps = {
  items: BottomTabItem[];
};

const fallbackItems: BottomTabItem[] = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/overview' },
  { id: 'positions', label: 'Positions', icon: BarChart3, href: '/position' },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight, href: '/order' },
  { id: 'engine', label: 'Engine', icon: Cpu, href: '/engine' },
  { id: 'notifications', label: 'Alerts', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function normalizeBottomTabHref(href?: string) {
  if (!href) return href;

  try {
    const target = new URL(href, 'https://tce.local');
    if (target.pathname === '/dashboard') {
      const tab = target.searchParams.get('tab');
      const paths: Record<string, string> = {
        overview: '/overview',
        positions: '/position',
        orders: '/order',
        settings: '/settings',
      };
      return tab && paths[tab] ? paths[tab] : '/overview';
    }

    if (target.pathname === '/engines') return '/engine';
  } catch {}

  return href;
}

export function BottomTabs({ items }: BottomTabsProps) {
  const pathname = usePathname();
  const navigationItems = items.length ? items : fallbackItems;

  return (
    <nav className="tce-bottom-tabs" aria-label="Primary navigation">
      <div className="tce-bottom-tabs-inner">
        {navigationItems.map(item => {
          const href = normalizeBottomTabHref(item.href);
          if (!href) return null;

          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn('tce-bottom-tab', active && 'tce-bottom-tab-active')}
            >
              <span
                className={cn(
                  'tce-bottom-tab-icon',
                  active && 'bg-primary/10',
                )}
              >
                <Icon className="size-[19px]" aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
