'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn('inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/[0.05] p-1', className)} {...props} />); TabsList.displayName=TabsPrimitive.List.displayName;
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => <TabsPrimitive.Trigger ref={ref} className={cn('inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-400 transition-colors data-[state=active]:bg-white/[0.1] data-[state=active]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60', className)} {...props} />); TabsTrigger.displayName=TabsPrimitive.Trigger.displayName;
export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />); TabsContent.displayName=TabsPrimitive.Content.displayName;
