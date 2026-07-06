import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type FadeContentProps = {
  children: ReactNode;
  /** Stagger offset in seconds — pass index * step for a cascade. */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
  className?: string;
};

/**
 * Subtle "fade content" reveal for dashboard cards and lists. Fades + gently
 * rises into place as it scrolls into view (once). Respects reduced-motion by
 * rendering the final state immediately. Utility-focused: no scale, no bounce —
 * just a quiet settle so dense admin layouts stay readable.
 */
export function FadeContent({ children, delay = 0, y = 12, className }: FadeContentProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
