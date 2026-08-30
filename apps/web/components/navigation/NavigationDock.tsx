'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
  return (
    <Card
      asChild
      className="fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-50 mx-auto w-auto max-w-xl border-white/10 bg-[#100c16]/90 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:inset-y-24 md:inset-x-auto md:left-5 md:bottom-auto md:mx-0 md:w-[76px] md:max-w-none md:p-2"
    >
      <nav aria-label="Dashboard navigation" className="grid grid-cols-6 gap-1 md:grid-cols-1">
        {items.map(({ id, label, icon: Icon, active }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group h-14 min-h-14 w-full flex-col gap-1 rounded-xl px-1 text-[9px] font-semibold text-[#776b80] hover:bg-white/[0.06] hover:text-white md:h-[68px] md:min-h-[68px] md:gap-1.5 md:text-[9px]',
              active && 'bg-violet-500/15 text-[#f6edf9] shadow-sm hover:bg-violet-500/20',
            )}
          >
            <span
              className={cn(
                'grid size-8 place-items-center rounded-xl transition-colors',
                active && 'bg-violet-500/15 text-[#d5b5fa]',
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
            </span>
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </nav>
    </Card>
  );
}
