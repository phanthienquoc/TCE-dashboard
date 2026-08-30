'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';

type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

type NavigationDockProps = {
  items: NavigationItem[];
  onSelect: (id: string) => void;
};

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleSelect = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace('/login');
  };

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          .app-header .account-identity,
          .app-header > .app-container > .touch-target {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed right-4 top-[max(12px,env(safe-area-inset-top))] z-[70] md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="touch-target rounded-full border-white/10 bg-[#100c16]/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
          onClick={() => setOpen(true)}
          aria-label="Open account menu"
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
          aria-label="Mobile menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute right-0 top-0 h-full w-[min(88vw,360px)] border-l border-white/10 bg-[#100c16] p-5 shadow-[-24px_0_70px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="min-w-0 pr-3">
                <p className="eyebrow">TCE account</p>
                <p className="account-email max-w-full">{user?.email ?? 'Signed in'}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>

            <nav aria-label="Mobile navigation" className="mt-5 grid gap-1">
              {items.map(({ id, label, icon: Icon, active }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelect(id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'h-12 justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-[#a99caf] hover:bg-white/[0.06] hover:text-white',
                    active && 'bg-violet-500/15 text-[#f6edf9]'
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span>{label}</span>
                </Button>
              ))}
            </nav>

            <div className="mt-5 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleLogout()}
                className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="size-[18px]" />
                <span>Log out</span>
              </Button>
            </div>
          </aside>
        </div>
      )}

      <Card className="fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-50 mx-auto w-auto max-w-xl border-white/10 bg-[#100c16]/90 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:inset-y-24 md:inset-x-auto md:left-5 md:bottom-auto md:mx-0 md:w-[76px] md:max-w-none md:p-2">
        <nav aria-label="Dashboard navigation" className="grid grid-cols-6 gap-1 md:grid-cols-1">
          {items.map(({ id, label, icon: Icon, active }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSelect(id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group h-14 min-h-14 w-full flex-col gap-1 rounded-xl px-1 text-[9px] font-semibold text-[#776b80] hover:bg-white/[0.06] hover:text-white md:h-[68px] md:min-h-[68px] md:gap-1.5 md:text-[9px]',
                active && 'bg-violet-500/15 text-[#f6edf9] shadow-sm hover:bg-violet-500/20'
              )}
            >
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-xl transition-colors',
                  active && 'bg-violet-500/15 text-[#d5b5fa]'
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
              </span>
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </nav>
      </Card>
    </>
  );
}
