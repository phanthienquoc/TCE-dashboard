'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

type NavigationItem = { id: string; label: string; icon: LucideIcon; active?: boolean };
type NavigationDockProps = { items: NavigationItem[]; onSelect: (id: string) => void };

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
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

  const navItems = items.map(({ id, label, icon: Icon, active }) => (
    <Button
      key={id}
      type="button"
      variant="ghost"
      onClick={() => handleSelect(id)}
      aria-current={active ? 'page' : undefined}
      className={cn('navigation-item', active && 'is-active')}
    >
      <span className="navigation-item-icon"><Icon className="size-[18px]" /></span>
      <span>{label}</span>
    </Button>
  ));

  return (
    <>
      <aside className="desktop-navigation" aria-label="Dashboard navigation">
        <div className="navigation-brand"><span>T</span><small>TCE</small></div>
        <nav>{navItems}</nav>
        <Button type="button" variant="ghost" onClick={() => void handleLogout()} className="navigation-logout" aria-label="Log out">
          <LogOut className="size-[18px]" />
          <span>Log out</span>
        </Button>
      </aside>

      <div className="mobile-navigation-trigger">
        <Button type="button" variant="outline" size="icon" className="touch-target" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <div className="mobile-navigation-layer" role="dialog" aria-modal="true" aria-label="TCE menu">
          <button className="mobile-navigation-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="mobile-navigation-drawer">
            <header className="mobile-navigation-header">
              <div className="account-identity">
                <div className="brand-orb"><span>T</span></div>
                <div className="min-w-0">
                  <p className="eyebrow">Signed in</p>
                  <p className="account-email">{user?.email ?? 'TCE account'}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="touch-target" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </Button>
            </header>
            <nav className="mobile-navigation-list" aria-label="Dashboard navigation">{navItems}</nav>
            <div className="mobile-navigation-footer">
              <Button type="button" variant="outline" className="w-full justify-start gap-3" onClick={() => void handleLogout()}>
                <LogOut className="size-4" />
                Log out
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
