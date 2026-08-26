import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input=React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(({className,type,...props},ref)=><input ref={ref} type={type} className={cn('flex h-12 w-full min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus-visible:border-violet-400/60 focus-visible:ring-2 focus-visible:ring-violet-400/10 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',className)} {...props}/>);
Input.displayName='Input';
