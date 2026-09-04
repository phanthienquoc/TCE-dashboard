'use client';

import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  href?: string;
};

type NavigationDockProps = {
  items: NavigationItem[];
  onSelect?: (id: string) => void;
};

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const logout = useAuthStore(s => s.logout);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  const isActive = (item: NavigationItem) => {
    if (!item.href) return Boolean(item.active);
    try {
      const target = new URL(item.href, window.location.origin);
      if (target.pathname !== pathname) return false;
      const targetTab = target.searchParams.get('tab');
      const currentTab = searchParams.get('tab');
      if (targetTab) return currentTab === targetTab;
      if (target.pathname === '/dashboard') return currentTab == null;
      return true;
    } catch {
      return Boolean(item.active);
    }
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    window.location.replace('/login');
  };

  const handleSelect = (id: string) => {
    setOpen(false);
    onSelect?.(id);
  };

  const renderItem = (item: NavigationItem) => {
    const { id, label, icon: Icon, href } = item;
    const active = isActive(item);
    const className = cn(
      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold',
      'text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]',
      'md:h-14 md:min-h-0 md:flex-col md:justify-center md:gap-1 md:px-1 md:text-[11px]',
      active && 'bg-[#eee8ff] text-[#6f42c1] hover:bg-[#eee8ff] hover:text-[#6f42c1]'
    );
    const content = (
      <>
        <Icon className="size-[19px] shrink-0" />
        <span className="truncate md:max-w-full">{label}</span>
      </>
    );

    if (href) {
      return (
        <Link
          key={id}
          href={href}
          prefetch
          aria-current={active ? 'page' : undefined}
          aria-label={label}
          onClick={() => setOpen(false)}
          className={className}
        >
          {content}
        </Link>
      );
    }

    return (
      <Button
        key={id}
        type="button"
        variant="ghost"
        onClick={() => handleSelect(id)}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={className}
      >
        {content}
      </Button>
    );
  };

  return (
    <>
      <aside
        aria-label="Services"
        className="fixed left-3 top-1/2 z-50 hidden w-[82px] -translate-y-1/2 rounded-2xl border border-[#d2d2d7] bg-white/95 p-2 shadow-[0_12px_36px_rgba(0,0,0,0.10)] backdrop-blur-xl md:block"
      >
        <div className="mb-2 px-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          Services
        </div>
        <nav className="grid gap-1" aria-label="Dashboard services">
          {items.map(renderItem)}
        </nav>
        <div className="mt-2 border-t border-[#e8e8ed] pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleLogout()}
            aria-label="Log out"
            className="h-14 w-full flex-col justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-[#ff3b30] hover:bg-[#fff1f0] hover:text-[#d70015]"
          >
            <LogOut className="size-[19px]" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-[70] border-b border-[#e8e8ed]/80 bg-white/90 px-4 pt-[max(8px,env(safe-area-inset-top))] shadow-[0_4px_18px_rgba(0,0,0,0.05)] backdrop-blur-xl md:hidden">
        <div className="flex h-12 items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="TCE Dashboard"
            className="flex items-center gap-2 rounded-xl py-1.5 pr-3 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#1d1d1f] text-[12px] font-bold tracking-[-0.02em] text-white shadow-sm">
              TCE
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
              Treasury Cash Extraction
            </span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="touch-target size-10 shrink-0 rounded-xl text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => setOpen(true)}
            aria-label="Open Services"
            aria-expanded={open}
          >
            <Menu className="size-[22px]" />
          </Button>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-[80] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Services menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close Services"
          />
          <aside className="absolute right-0 top-0 h-full w-[min(86vw,340px)] border-l border-[#d2d2d7] bg-white p-5 shadow-[-18px_0_50px_rgba(0,0,0,0.16)]">
            <div className="flex items-center justify-between border-b border-[#e8e8ed] pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
                  TCE
                </p>
                <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                  Services
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target rounded-full"
                onClick={() => setOpen(false)}
                aria-label="Close Services"
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="mt-5 grid gap-1" aria-label="Mobile dashboard services">
              {items.map(renderItem)}
            </nav>
            <div className="mt-5 border-t border-[#e8e8ed] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleLogout()}
                className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-[#ff3b30] hover:bg-[#fff1f0] hover:text-[#d70015]"
              >
                <LogOut className="size-[19px]" />
                <span>Logout</span>
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
