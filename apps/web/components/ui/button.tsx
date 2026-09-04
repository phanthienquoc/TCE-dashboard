'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-surface text-foreground hover:brightness-[0.97]',
        outline: 'border border-border bg-surface-strong text-foreground hover:bg-surface',
        ghost: 'text-muted hover:bg-surface hover:text-foreground',
        destructive: 'bg-danger/10 text-danger hover:bg-danger/15',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'min-h-10 px-3 text-xs',
        lg: 'min-h-12 px-5',
        icon: 'size-11 px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(variants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = 'Button';
