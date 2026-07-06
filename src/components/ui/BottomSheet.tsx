import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';

import { cn } from '../../lib/utils';

type BottomSheetProps = {
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the sheet panel (background, border, etc.). */
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

const SM_BREAKPOINT = '(max-width: 639px)';
// Drag distance / velocity past which a downward flick dismisses the sheet.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

/**
 * Mobile-first modal surface: on phones it slides up from the bottom with a
 * drag handle and drag-to-dismiss; on `sm+` it's a centered fade/scale dialog.
 * Handles backdrop click, Escape, body scroll-lock, and focus. Self-manages its
 * exit animation (via an internal `closing` state) so callers can keep using a
 * plain conditional render — no AnimatePresence wiring needed. Reduced-motion
 * collapses the slide/scale to a simple fade.
 */
export function BottomSheet({ onClose, children, className, ariaLabel, ariaLabelledBy }: BottomSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  // Resolve viewport synchronously so the initial + animate variants match on
  // the very first render (a post-mount flip would strand opacity/scale).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SM_BREAKPOINT).matches,
  );
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(SM_BREAKPOINT);
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const beginClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beginClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [beginClose]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      beginClose();
    }
  };

  const handleAnimationComplete = () => {
    if (closing) onClose();
  };

  const draggable = isMobile && !prefersReducedMotion;

  const panelInitial = prefersReducedMotion
    ? { opacity: 0 }
    : isMobile
      ? { y: '100%' }
      : { opacity: 0, scale: 0.96, y: 8 };

  const panelOpen = prefersReducedMotion
    ? { opacity: 1 }
    : isMobile
      ? { y: 0 }
      : { opacity: 1, scale: 1, y: 0 };

  const panelClosed = prefersReducedMotion
    ? { opacity: 0 }
    : isMobile
      ? { y: '100%' }
      : { opacity: 0, scale: 0.96, y: 8 };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      role="presentation"
      onClick={beginClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl outline-none sm:rounded-2xl',
          className,
        )}
        initial={panelInitial}
        animate={closing ? panelClosed : panelOpen}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', damping: 34, stiffness: 340 }
        }
        onAnimationComplete={handleAnimationComplete}
        drag={draggable ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
      >
        {draggable && (
          <div
            className="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => dragControls.start(e)}
            aria-hidden
          >
            <span className="h-1.5 w-10 rounded-full bg-[var(--color-border-strong)]" />
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}
