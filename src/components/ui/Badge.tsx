import { cn } from '../../lib/utils';

export type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';

export interface BadgeProps {
  label: string;
  color?: BadgeColor;
  className?: string;
}

const colorMap: Record<BadgeColor, string> = {
  blue:   'bg-brand-100 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400',
  green:  'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400',
  gray:   'bg-[var(--color-surface2)] text-[var(--color-text2)]',
};

export function Badge({ label, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-sm px-[7px] py-[2px]',
        'font-sans text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap',
        colorMap[color],
        className
      )}
    >
      {label}
    </span>
  );
}
