import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Editorial button primitives — zinc/slate base, indigo-600 accent.
 * No animated scale; subtle background transitions only.
 * Matches the 1px-border-only structure of the design system.
 */
const buttonVariants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-indigo-600 text-white border border-indigo-600 ' +
    'hover:bg-indigo-700 hover:border-indigo-700 ' +
    'dark:bg-indigo-600 dark:hover:bg-indigo-700 ' +
    'focus-visible:ring-indigo-500',
  secondary:
    'bg-zinc-800 text-zinc-100 border border-zinc-700 ' +
    'hover:bg-zinc-700 ' +
    'dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-600 ' +
    'focus-visible:ring-zinc-500',
  outline:
    'bg-transparent text-zinc-700 border border-zinc-300 ' +
    'hover:bg-zinc-50 hover:text-zinc-900 ' +
    'dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ' +
    'focus-visible:ring-zinc-400',
  ghost:
    'bg-transparent text-zinc-600 border border-transparent ' +
    'hover:bg-zinc-100 hover:text-zinc-900 ' +
    'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ' +
    'focus-visible:ring-zinc-400',
  danger:
    'bg-red-600 text-white border border-red-600 ' +
    'hover:bg-red-700 hover:border-red-700 ' +
    'focus-visible:ring-red-500',
};

const buttonSizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs font-medium',
  md: 'h-9 px-4 text-sm font-medium',
  lg: 'h-10 px-5 text-sm font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    children,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'dark:focus-visible:ring-offset-zinc-950',
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
          <svg
            className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
