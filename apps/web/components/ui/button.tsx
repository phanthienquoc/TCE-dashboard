import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 min-h-11', {
  variants: {
    variant: { default: 'bg-white text-slate-950 hover:bg-slate-100', secondary: 'bg-white/10 text-slate-100 hover:bg-white/15', outline: 'border border-white/10 bg-transparent text-slate-200 hover:bg-white/5', ghost: 'text-slate-300 hover:bg-white/10 hover:text-white', destructive: 'bg-red-500/15 text-red-300 hover:bg-red-500/25' },
    size: { default: 'h-11 px-4', sm: 'h-9 px-3', lg: 'h-12 px-5', icon: 'h-11 w-11' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,...props},ref)=><button ref={ref} className={cn(buttonVariants({variant,size,className}))} {...props}/>);
Button.displayName='Button';
export {buttonVariants};
