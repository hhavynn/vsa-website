import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const buttonVariants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-600 text-white border border-brand-600 ' +
    'hover:bg-brand-700 hover:border-brand-700 ' +
    'dark:bg-brand-400 dark:border-brand-400 dark:text-[#050810] ' +
    'dark:hover:bg-brand-300 dark:hover:border-brand-300 ' +
    'focus-visible:ring-brand-600',
  secondary:
    'bg-brand-100 text-brand-600 border border-[#b8cce8] ' +
    'hover:bg-brand-200 ' +
    'dark:bg-brand-600/10 dark:text-brand-400 dark:border-[#2a3f6e] ' +
    'dark:hover:bg-brand-600/20 ' +
    'focus-visible:ring-brand-400',
  outline:
    'bg-transparent text-[var(--color-text2)] border border-[var(--color-border)] ' +
    'hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] ' +
    'focus-visible:ring-[var(--color-border-strong)]',
  ghost:
    'bg-transparent text-[var(--color-text2)] border border-transparent ' +
    'hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] ' +
    'focus-visible:ring-[var(--color-border)]',
  danger:
    'bg-red-700 text-white border border-red-700 ' +
    'hover:bg-red-800 hover:border-red-800 ' +
    'dark:bg-red-500 dark:border-red-500 ' +
    'focus-visible:ring-red-500',
  success:
    'bg-green-700 text-white border border-green-700 ' +
    'hover:bg-green-800 ' +
    'dark:bg-green-500 dark:border-green-500 ' +
    'focus-visible:ring-green-500',
};

const buttonSizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'py-[5px] px-3 text-xs font-medium gap-1.5',
  md: 'py-[9px] px-[18px] text-sm font-medium gap-1.5',
  lg: 'py-[11px] px-5 text-sm font-semibold gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded',
        'font-sans tracking-[-0.01em] whitespace-nowrap',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--color-bg)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
