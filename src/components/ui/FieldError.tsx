import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-testid="error-icon">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 8.5a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface FieldErrorProps {
  /** Wire to the field with aria-describedby. */
  id?: string;
  /** The message; renders nothing when empty. `children` works too. */
  message?: ReactNode;
  children?: ReactNode;
  /** Announce on appearance (role="alert"). Turn off when a form summary already does. */
  announce?: boolean;
  className?: string;
}

/**
 * Field validation message. The error is carried by an icon and the message
 * text — never by red alone — and the text uses a red that clears 4.5:1 on
 * both the cream page and the midnight dark surface.
 */
export function FieldError({ id, message, children, announce = true, className }: FieldErrorProps) {
  const content = message ?? children;
  if (!content) return null;

  return (
    <p
      id={id}
      role={announce ? 'alert' : undefined}
      className={cn(
        'mt-1 flex items-start gap-1.5 font-sans text-xs font-medium leading-snug text-red-700 dark:text-red-300',
        className
      )}
    >
      <ErrorIcon className="mt-px h-3.5 w-3.5" />
      <span>{content}</span>
    </p>
  );
}

/** Form-level error banner: icon + message on a tinted surface, announced to assistive tech. */
export function FormAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded border border-red-300 bg-red-50 p-3 font-sans text-sm leading-snug text-red-800',
        'dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-300',
        className
      )}
    >
      <ErrorIcon className="mt-0.5 h-4 w-4" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
