import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input=React.forwardRef<HTMLInputElement,React.ComponentProps<'input'>>(({className,type,...props},ref)=><input type={type} ref={ref} className={cn('flex h-11 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-base text-slate-100 shadow-sm outline-none placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/30 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',className)} {...props}/>);
Input.displayName='Input';
