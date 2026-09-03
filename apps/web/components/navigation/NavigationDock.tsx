'use client';

import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    window.location.replace('/login');
  };

  const handleSelect = (id: string) => {
    setOpen(false);
    onSelect?.(id);
  };

  const renderItem = ({ id, label, icon: Icon, active, href }: NavigationItem) => {
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

      <div className="fixed right-4 top-[max(12px,env(safe-area-inset-top))] z-[70] md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="touch-target rounded-full border-[#d2d2d7] bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.10)] backdrop-blur-xl"
          onClick={() => setOpen(true)}
          aria-label="Open Services"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </Button>
      </div>

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
