'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-violet-500 text-white hover:bg-violet-400',
        secondary: 'bg-white/[0.08] text-white hover:bg-white/[0.12]',
        outline: 'border border-white/10 bg-transparent text-white hover:bg-white/[0.06]',
        ghost: 'text-zinc-300 hover:bg-white/[0.06] hover:text-white',
        destructive: 'bg-red-500/15 text-red-200 hover:bg-red-500/25',
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
