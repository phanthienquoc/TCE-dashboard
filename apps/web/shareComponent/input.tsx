import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted focus-visible:border-primary focus-visible:bg-surface-strong focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
