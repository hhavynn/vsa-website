import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends HTMLAttributes<HTMLDivElement> {
  // When false, renders as sentence-case with tighter tracking (for non-uppercase labels)
  uppercase?: boolean;
}

// Section label — 11px DM Sans, uppercase, wide tracking, muted color.
// Used for section headers, table column labels, metadata callouts.
export function Label({ uppercase = true, className, children, ...props }: LabelProps) {
  return (
    <div
      className={cn(
        'font-sans text-[11px] font-semibold text-[var(--color-text3)]',
        uppercase ? 'uppercase tracking-[0.07em]' : 'tracking-[0.02em]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
