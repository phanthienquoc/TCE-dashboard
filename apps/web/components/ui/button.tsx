'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#0071e3] text-white hover:bg-[#0077ed]',
        secondary: 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]',
        outline: 'border border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]',
        ghost: 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]',
        destructive: 'bg-[#fff1f2] text-[#b4232f] hover:bg-[#ffe4e6]',
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
