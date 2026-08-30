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
  const { logout } = useAuthStore();

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
      className={cn(
        'h-[58px] min-w-0 flex-1 flex-col gap-1 rounded-2xl px-1 text-[9px] font-semibold text-[#776b80] hover:bg-white/[0.06] hover:text-white',
        active && 'bg-violet-500/15 text-[#f6edf9]'
      )}
    >
      <span className="grid size-[30px] place-items-center rounded-xl">
        <Icon className="size-[18px]" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Button>
  ));

  return (
    <nav aria-label="Dashboard navigation" className="mobile-bottom-nav">
      {navItems}
      <Button
        type="button"
        variant="ghost"
        onClick={() => void handleLogout()}
        className="h-[58px] min-w-0 flex-1 flex-col gap-1 rounded-2xl px-1 text-[9px] font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200"
        aria-label="Log out"
      >
        <span className="grid size-[30px] place-items-center rounded-xl">
          <LogOut className="size-[18px]" />
        </span>
        <span className="truncate">Log out</span>
      </Button>
    </nav>
  );
}
