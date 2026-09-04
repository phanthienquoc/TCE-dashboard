'use client';

import type { LucideIcon } from 'lucide-react';
import { Check, LogOut, Menu, Palette, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { TCE_THEMES, themeNames, type ThemeName } from '@/shareComponent/theme';
import { useTheme } from '@/shareComponent/theme-provider';

type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  href?: string;
};
type NavigationDockProps = { items: NavigationItem[]; onSelect?: (id: string) => void };

const iconTones: Record<string, string> = {
  overview: 'text-blue-500',
  positions: 'text-violet-500',
  orders: 'text-amber-500',
  engine: 'text-cyan-500',
  notifications: 'text-rose-500',
  settings: 'text-emerald-500',
};

function normalizeNavigationHref(href?: string) {
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

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const logout = useAuthStore(s => s.logout);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => setOpen(false), [pathname, searchParams]);
  const isActive = (item: NavigationItem) => {
    const href = normalizeNavigationHref(item.href);
    if (!href) return Boolean(item.active);
    try {
      return new URL(href, window.location.origin).pathname === pathname;
    } catch {
      return Boolean(item.active);
    }
  };
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    window.location.replace('/login');
  };
  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon,
      active = isActive(item),
      href = normalizeNavigationHref(item.href);
    const iconTone = iconTones[item.id] ?? 'text-muted';
    const className = cn(
      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[.98]',
      active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface hover:text-foreground'
    );
    const content = (
      <>
        <Icon className={cn('size-[19px] shrink-0', iconTone)} />
        <span className="truncate">{item.label}</span>
      </>
    );
    if (href)
      return (
        <Link
          key={item.id}
          href={href}
          prefetch
          aria-current={active ? 'page' : undefined}
          aria-label={item.label}
          onClick={() => setOpen(false)}
          className={className}
        >
          {content}
        </Link>
      );
    return (
      <Button
        key={item.id}
        type="button"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          onSelect?.(item.id);
        }}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        className={className}
      >
        {content}
      </Button>
    );
  };
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[70] border-b border-border bg-surface-strong/95 px-[max(12px,env(safe-area-inset-left))] pt-[max(6px,env(safe-area-inset-top))] pr-[max(12px,env(safe-area-inset-right))] shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full items-center justify-between">
          <Link
            href="/overview"
            aria-label="TCE Dashboard"
            className="flex min-w-0 items-center gap-2 rounded-xl py-1.5 pr-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-foreground text-[11px] font-bold text-background">
              TCE
            </span>
            <span className="truncate text-[15px] font-semibold tracking-[-.02em] text-foreground">
              Treasury Cash Extraction
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            onClick={() => setOpen(true)}
            aria-label="Open Services"
            aria-expanded={open}
          >
            <Menu className="size-[22px] text-primary" />
          </Button>
        </div>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label="Services menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close Services"
          />
          <aside className="absolute right-0 top-0 h-full w-[min(86vw,340px)] border-l border-border bg-surface-strong p-5 shadow-[-18px_0_50px_rgb(0_0_0/.16)]">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="eyebrow">TCE</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  Services
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                onClick={() => setOpen(false)}
                aria-label="Close Services"
              >
                <X className="size-5 text-primary" />
              </Button>
            </div>
            <nav className="mt-5 grid gap-1" aria-label="Mobile dashboard services">
              {items.map(renderItem)}
            </nav>
            <section className="mt-5 border-t border-border pt-4" aria-labelledby="theme-heading">
              <div className="mb-3 flex items-center gap-2 px-3">
                <Palette className="size-4 text-primary" />
                <p
                  id="theme-heading"
                  className="text-xs font-bold uppercase tracking-[.08em] text-muted"
                >
                  Theme
                </p>
              </div>
              <div className="grid gap-1">
                {themeNames.map((name: ThemeName) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTheme(name)}
                    aria-pressed={theme === name}
                    className={cn(
                      'flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold',
                      theme === name
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-surface hover:text-foreground'
                    )}
                  >
                    <span>{TCE_THEMES[name].label}</span>
                    {theme === name && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            </section>
            <div className="mt-5 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleLogout()}
                className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10"
              >
                <LogOut className="size-[19px] text-danger" />
                <span>Logout</span>
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
