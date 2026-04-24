import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

const baseClass =
  'w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded ' +
  'font-sans text-[var(--color-text)] placeholder:text-[var(--color-text3)] ' +
  'outline-none focus:border-brand-600 dark:focus:border-brand-400 ' +
  'transition-colors duration-150';

/* ── Text input ─────────────────────────────────────────────────────────── */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  small?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, small = false, style, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text3)] text-sm">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          baseClass,
          small
            ? 'py-[6px] text-xs'
            : 'py-[9px] text-sm',
          icon ? (small ? 'pl-8 pr-3' : 'pl-9 pr-3') : (small ? 'px-2.5' : 'px-3'),
          className
        )}
        style={style}
        {...props}
      />
    </div>
  )
);
Input.displayName = 'Input';

/* ── Textarea ───────────────────────────────────────────────────────────── */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  small?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, small = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        baseClass,
        small ? 'py-[6px] px-2.5 text-xs' : 'py-[9px] px-3 text-sm',
        'resize-none leading-relaxed',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
