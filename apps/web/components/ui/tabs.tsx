'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn('flex min-w-0 min-h-11 w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1', className)} {...props} />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger ref={ref} className={cn('inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted transition-colors data-[state=active]:bg-surface-strong data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30', className)} {...props} />
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4 min-w-0 focus-visible:outline-none', className)} {...props} />
);
TabsContent.displayName = TabsPrimitive.Content.displayName;
