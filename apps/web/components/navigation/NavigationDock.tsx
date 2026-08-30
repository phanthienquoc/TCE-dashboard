'use client';

import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

type NavigationItem = { id: string; label: string; icon: LucideIcon; active?: boolean };
type NavigationDockProps = { items: NavigationItem[]; onSelect: (id: string) => void };

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const router = useRouter();
  const logout = useAuthStore(s => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const navItems = items.map(({ id, label, icon: Icon, active }) => (
    <Button
      key={id}
      type="button"
      variant="ghost"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={cn(
        'h-[52px] min-w-0 flex-1 rounded-2xl px-1 transition-all duration-200 ease-out',
        'text-[#776b80] hover:bg-white/[0.06] hover:text-white hover:-translate-y-0.5',
        active && 'bg-violet-500/15 text-[#f6edf9] scale-105'
      )}
    >
      <span
        className={cn(
          'grid size-[34px] place-items-center rounded-xl transition-transform duration-200 ease-out',
          active && 'scale-110'
        )}
      >
        <Icon className="size-[19px]" />
      </span>
    </Button>
  ));

  return (
    <nav aria-label="Dashboard navigation" className="mobile-bottom-nav">
      {navItems}
      <Button
        type="button"
        variant="ghost"
        onClick={() => void handleLogout()}
        aria-label="Log out"
        title="Log out"
        className="h-[52px] min-w-0 flex-1 rounded-2xl px-1 text-red-300 transition-all duration-200 ease-out hover:bg-red-500/10 hover:text-red-200 hover:-translate-y-0.5"
      >
        <span className="grid size-[34px] place-items-center rounded-xl">
          <LogOut className="size-[19px]" />
        </span>
      </Button>
    </nav>
  );
}
