'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={className} {...props} />;
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return <div className="flex items-center border-b border-white/10 px-3">
    <Search className="mr-2 size-4 shrink-0 text-[var(--tce-muted)]" />
    <CommandPrimitive.Input className={`flex h-10 w-full bg-transparent py-3 text-sm text-[var(--tce-text)] outline-none placeholder:text-[var(--tce-muted)] ${className ?? ''}`} {...props} />
  </div>;
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={`max-h-60 overflow-y-auto p-1 ${className ?? ''}`} {...props} />;
}

export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={`py-6 text-center text-sm text-[var(--tce-muted)] ${className ?? ''}`} {...props} />;
}

export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-[var(--tce-text)] aria-selected:bg-white/10 ${className ?? ''}`} {...props} />;
}
