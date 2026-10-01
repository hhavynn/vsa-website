import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";

import { cn } from "../../lib/utils";

type BottomSheetProps = {
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the sheet panel (background, border, etc.). */
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

const SM_BREAKPOINT = "(max-width: 639px)";
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
export function BottomSheet({
  onClose,
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
}: BottomSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalRoot] = useState(() => document.createElement("div"));
  const dragControls = useDragControls();
  // Resolve viewport synchronously so the initial + animate variants match on
  // the very first render (a post-mount flip would strand opacity/scale).
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(SM_BREAKPOINT).matches,
  );
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(SM_BREAKPOINT);
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const beginClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.appendChild(portalRoot);
    const backgroundElements = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== portalRoot,
      )
      .map((element) => ({ element, inert: element.getAttribute("inert") }));
    backgroundElements.forEach(({ element }) =>
      element.setAttribute("inert", ""),
    );

    const panel = panelRef.current;
    const focusableSelector =
      "a[href], button, input, select, textarea, [tabindex]";
    const getFocusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden",
      );
    const focusFirst = () => (getFocusable()[0] ?? panel)?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        beginClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        e.preventDefault();
        panel.focus();
      } else if (
        !panel.contains(document.activeElement) ||
        document.activeElement === panel
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel?.contains(event.target))
        focusFirst();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.body.style.overflow = "hidden";
    focusFirst();
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach(({ element, inert }) => {
        if (inert === null) element.removeAttribute("inert");
        else element.setAttribute("inert", inert);
      });
      portalRoot.remove();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [beginClose, portalRoot]);

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
      ? { y: "100%" }
      : { opacity: 0, scale: 0.96, y: 8 };

  const panelOpen = prefersReducedMotion
    ? { opacity: 1 }
    : isMobile
      ? { y: 0 }
      : { opacity: 1, scale: 1, y: 0 };

  const panelClosed = prefersReducedMotion
    ? { opacity: 0 }
    : isMobile
      ? { y: "100%" }
      : { opacity: 0, scale: 0.96, y: 8 };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
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
          "relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl outline-none sm:rounded-2xl",
          className,
        )}
        initial={panelInitial}
        animate={closing ? panelClosed : panelOpen}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", damping: 34, stiffness: 340 }
        }
        onAnimationComplete={handleAnimationComplete}
        drag={draggable ? "y" : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
      >
        {draggable && (
          <div
            className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
            aria-hidden
          >
            <span className="h-1.5 w-10 rounded-full bg-[var(--color-border-strong)]" />
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>,
    portalRoot,
  );
}
