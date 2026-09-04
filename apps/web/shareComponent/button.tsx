'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-surface text-foreground hover:brightness-95',
  outline: 'border border-border bg-surface-strong text-foreground hover:bg-surface',
  ghost: 'text-muted hover:bg-surface hover:text-foreground',
  destructive: 'bg-danger/10 text-danger hover:bg-danger/15',
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const sizeClass = {
      sm: 'min-h-9 rounded-lg px-3 text-xs',
      md: 'min-h-11 rounded-xl px-4 text-sm',
      lg: 'min-h-12 rounded-xl px-5 text-sm',
      icon: 'size-11 rounded-xl px-0',
    }[size];
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50',
          sizeClass,
          buttonVariants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
