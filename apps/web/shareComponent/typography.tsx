import * as React from 'react';
import { cn } from '@/lib/utils';

type TextProps = React.HTMLAttributes<HTMLElement>;
export function LargeTitle({ className, ...props }: TextProps) {
  return (
    <h1
      className={cn('text-[34px] leading-[1.12] font-bold tracking-[-0.03em]', className)}
      {...props}
    />
  );
}
export function Title1({ className, ...props }: TextProps) {
  return (
    <h1
      className={cn('text-[28px] leading-[1.14] font-bold tracking-[-0.025em]', className)}
      {...props}
    />
  );
}
export function Title2({ className, ...props }: TextProps) {
  return (
    <h2
      className={cn('text-[22px] leading-[1.18] font-bold tracking-[-0.022em]', className)}
      {...props}
    />
  );
}
export function Title3({ className, ...props }: TextProps) {
  return (
    <h3
      className={cn('text-[20px] leading-[1.2] font-semibold tracking-[-0.02em]', className)}
      {...props}
    />
  );
}
export function Headline({ className, ...props }: TextProps) {
  return (
    <h4
      className={cn('text-[17px] leading-[1.3] font-semibold tracking-[-0.018em]', className)}
      {...props}
    />
  );
}
export function Body({ className, ...props }: TextProps) {
  return <p className={cn('text-[17px] leading-[1.41176]', className)} {...props} />;
}
export function Subheadline({ className, ...props }: TextProps) {
  return <p className={cn('text-[15px] leading-[1.33] text-muted', className)} {...props} />;
}
export function Footnote({ className, ...props }: TextProps) {
  return <p className={cn('text-[13px] leading-[1.38] text-muted', className)} {...props} />;
}
export function Caption({ className, ...props }: TextProps) {
  return <span className={cn('text-[12px] leading-[1.33] text-muted', className)} {...props} />;
}
export function Eyebrow({ className, ...props }: TextProps) {
  return (
    <span
      className={cn(
        'text-[11px] leading-[1.2] font-bold tracking-[0.08em] uppercase text-subtle',
        className
      )}
      {...props}
    />
  );
}
