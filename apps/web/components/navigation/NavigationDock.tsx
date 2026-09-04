'use client';

import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

type NavigationItem = { id:string; label:string; icon:LucideIcon; active?:boolean; href?:string };
type NavigationDockProps = { items:NavigationItem[]; onSelect?:(id:string)=>void };

export function NavigationDock({ items, onSelect }: NavigationDockProps) {
  const logout=useAuthStore(s=>s.logout); const pathname=usePathname(); const searchParams=useSearchParams(); const [open,setOpen]=useState(false);
  useEffect(()=>{ if(!open)return; const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)}; window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey); },[open]);
  useEffect(()=>{setOpen(false)},[pathname,searchParams]);
  const isActive=(item:NavigationItem)=>{if(!item.href)return Boolean(item.active); try {const target=new URL(item.href,window.location.origin); if(target.pathname!==pathname)return false; const targetTab=target.searchParams.get('tab'); const currentTab=searchParams.get('tab'); if(targetTab)return currentTab===targetTab; if(target.pathname==='/dashboard')return currentTab==null; return true;}catch{return Boolean(item.active)}};
  const handleLogout=async()=>{setOpen(false);await logout();window.location.replace('/login')};
  const renderItem=(item:NavigationItem)=>{const Icon=item.icon;const active=isActive(item);const className=cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',active?'bg-primary/10 text-primary':'text-muted hover:bg-surface hover:text-foreground');const content=<><Icon className="size-[19px] shrink-0"/><span className="truncate">{item.label}</span></>; if(item.href)return <Link key={item.id} href={item.href} prefetch aria-current={active?'page':undefined} aria-label={item.label} onClick={()=>setOpen(false)} className={className}>{content}</Link>; return <Button key={item.id} type="button" variant="ghost" onClick={()=>{setOpen(false);onSelect?.(item.id)}} aria-current={active?'page':undefined} aria-label={item.label} className={className}>{content}</Button>};
  return <>
    <header className="fixed inset-x-0 top-0 z-[70] border-b border-border bg-surface-strong/95 px-3 pt-[max(6px,env(safe-area-inset-top))] shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-[430px] items-center justify-between">
        <Link href="/dashboard" aria-label="TCE Dashboard" className="flex min-w-0 items-center gap-2 rounded-xl py-1.5 pr-3 active:opacity-70">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-foreground text-[11px] font-bold tracking-[-.02em] text-background">TCE</span>
          <span className="truncate text-[15px] font-semibold tracking-[-.02em] text-foreground">Treasury Cash Extraction</span>
        </Link>
        <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl" onClick={()=>setOpen(true)} aria-label="Open Services" aria-expanded={open}><Menu className="size-[22px]"/></Button>
      </div>
    </header>
    {open&&<div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Services menu">
      <button type="button" className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" onClick={()=>setOpen(false)} aria-label="Close Services"/>
      <aside className="absolute right-0 top-0 h-full w-[min(86vw,340px)] border-l border-border bg-surface-strong p-5 shadow-[-18px_0_50px_rgb(0_0_0/.16)]">
        <div className="flex items-center justify-between border-b border-border pb-4"><div><p className="eyebrow">TCE</p><p className="mt-1 text-xl font-semibold tracking-tight text-foreground">Services</p></div><Button type="button" variant="ghost" size="icon" className="size-10 rounded-full" onClick={()=>setOpen(false)} aria-label="Close Services"><X className="size-5"/></Button></div>
        <nav className="mt-5 grid gap-1" aria-label="Mobile dashboard services">{items.map(renderItem)}</nav>
        <div className="mt-5 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={()=>void handleLogout()} className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10"><LogOut className="size-[19px]"/><span>Logout</span></Button></div>
      </aside>
    </div>}
  </>;
}
