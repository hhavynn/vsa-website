import { type ComponentType, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type IconBaseProps } from 'react-icons';
import { FiEye, FiMonitor, FiSmartphone, FiX } from 'react-icons/fi';
import { cn } from '../../../../lib/utils';
import { PreviewFrame } from './PreviewFrame';

const EyeIcon = FiEye as ComponentType<IconBaseProps>;
const MonitorIcon = FiMonitor as ComponentType<IconBaseProps>;
const PhoneIcon = FiSmartphone as ComponentType<IconBaseProps>;
const CloseIcon = FiX as ComponentType<IconBaseProps>;

export type PreviewViewport = 'desktop' | 'mobile';

export interface PreviewPlacement {
  key: string;
  label: string;
}

interface PublicPreviewDialogProps {
  /** What is being previewed, e.g. the event name. */
  title: string;
  /** Public route the content appears on, e.g. "/events". */
  surface: string;
  /** Visibility note, e.g. "Draft — hidden from the public site". */
  notice?: ReactNode;
  /** Optional switcher for the different spots the content renders in. */
  placements?: PreviewPlacement[];
  placement?: string;
  onPlacementChange?: (key: string) => void;
  onClose: () => void;
  children: ReactNode;
}

const segmentCls = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400',
    active
      ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300'
      : 'text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
  );

/**
 * Full-screen "Preview as public" workspace. Renders the real public
 * components inside a {@link PreviewFrame}, so admins see draft values exactly
 * as the public site would draw them — nothing is saved or published.
 */
export function PublicPreviewDialog({
  title,
  surface,
  notice,
  placements,
  placement,
  onPlacementChange,
  onClose,
  children,
}: PublicPreviewDialogProps) {
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    // Keep focus inside the preview while it is open (the editor underneath
    // stays mounted so unsaved changes survive closing the preview).
    const handleFocusIn = (event: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex bg-black/70 backdrop-blur-sm sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-preview-title"
        className="flex min-h-0 w-full flex-col overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)] sm:rounded-lg sm:border"
      >
        <div className="h-1 shrink-0 bg-amber-500" aria-hidden />
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                <EyeIcon aria-hidden className="h-3 w-3" />
                ADMIN PREVIEW — NOT PUBLIC
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text3)]">{surface}</span>
            </div>
            <h2 id="public-preview-title" className="mt-1 truncate font-serif text-lg font-bold text-[var(--color-text)]">
              {title}
            </h2>
            {notice && <p className="mt-0.5 font-sans text-xs text-[var(--color-text2)]">{notice}</p>}
          </div>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Preview width"
              className="hidden overflow-hidden rounded border border-[var(--color-border)] sm:inline-flex"
            >
              <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')} className={segmentCls(viewport === 'desktop')}>
                <MonitorIcon aria-hidden className="h-3.5 w-3.5" /> Desktop
              </button>
              <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')} className={cn(segmentCls(viewport === 'mobile'), 'border-l border-[var(--color-border)]')}>
                <PhoneIcon aria-hidden className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-1.5 font-sans text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
            >
              <CloseIcon aria-hidden className="h-3.5 w-3.5" /> Back to editing
            </button>
          </div>
        </header>

        {placements && placements.length > 1 && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-border)] px-4 py-2 sm:px-5">
            <span id="public-preview-placement-label" className="font-sans text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text2)]">
              Where it appears
            </span>
            <div role="group" aria-labelledby="public-preview-placement-label" className="flex w-full overflow-hidden rounded border border-[var(--color-border)] sm:w-auto">
              {placements.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={placement === option.key}
                  onClick={() => onPlacementChange?.(option.key)}
                  className={cn(segmentCls(placement === option.key), 'flex-1 justify-center sm:flex-none', index > 0 && 'border-l border-[var(--color-border)]')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 justify-center bg-[var(--color-surface2)] sm:p-4">
          <PreviewFrame
            title={`Public preview of ${title}`}
            onEscape={onClose}
            className={cn(
              'h-full border-0 bg-[var(--color-bg)]',
              viewport === 'mobile'
                ? 'w-[390px] max-w-full sm:rounded-lg sm:border sm:border-[var(--color-border)]'
                : 'w-full sm:rounded',
            )}
          >
            {children}
          </PreviewFrame>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Secondary action that opens a {@link PublicPreviewDialog}. */
export function PreviewAsPublicButton({
  onClick,
  disabledReason,
  className,
}: {
  onClick: () => void;
  /** When set, the button is disabled and this explains why. */
  disabledReason?: string | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabledReason}
      title={disabledReason ?? 'See this draft exactly as the public site will show it. Nothing is saved.'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded border border-[var(--color-border)] bg-transparent px-5 py-2.5 font-sans text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-brand-400',
        className,
      )}
    >
      <EyeIcon aria-hidden className="h-4 w-4" />
      Preview As Public
    </button>
  );
}
