import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-xl border bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)] shadow-sm outline-none border-[var(--border)] placeholder:text-[var(--muted)]',
        'focus-visible:border-[var(--primary)] focus-visible:bg-[var(--surface-strong)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
