'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';

const labels: Record<string, string> = {
  overview: 'Home',
  pools: 'Pools',
  pool: 'Pool',
  position: 'Positions',
  order: 'Orders',
  engines: 'Engine',
  engine: 'Engine',
  settings: 'Settings',
  profile: 'Profile',
  notifications: 'Notifications',
  stock: 'Stock',
  'stock-events': 'Stock Events',
  dre: 'DRE',
  xau: 'XAU Futures',
};

function humanize(segment: string) {
  return labels[segment] ??
    segment
      .replace(/^\[|\]$/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (!segments.length) return null;

  const items = segments.map((segment, index) => ({
    label: humanize(segment),
    href: `/${segments.slice(0, index + 1).join('/')}`,
  }));

  return (
    <nav className="tce-breadcrumbs" aria-label="Breadcrumb">
      <Link className="tce-breadcrumb-home" href="/overview" aria-label="Home">
        <Home className="size-3.5" aria-hidden="true" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span className="tce-breadcrumb-item" key={item.href}>
            <ChevronRight className="tce-breadcrumb-separator" aria-hidden="true" />
            {isLast ? (
              <span className="tce-breadcrumb-current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="tce-breadcrumb-link">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
