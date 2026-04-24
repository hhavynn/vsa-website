import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: number | string;
}

// Minimal card — use sparingly. Prefer open border-divided layouts.
export function Card({ className, padding = 18, style, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded',
        className
      )}
      style={{ padding, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
