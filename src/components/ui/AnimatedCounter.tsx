import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

type AnimatedCounterProps = {
  value: number;
  /** Custom formatter. Defaults to `toLocaleString()`. */
  format?: (value: number) => string;
  className?: string;
  /** Animation duration in seconds. */
  duration?: number;
};

/**
 * Counts up (or down) to `value` on mount and whenever `value` changes.
 * Respects reduced-motion: renders the final formatted value immediately.
 * Rendered inside a fixed-width `tabular-nums` span so the surrounding
 * layout does not shift while the digits tick.
 */
export function AnimatedCounter({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  duration = 1.1,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    });

    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, prefersReducedMotion]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(display)}
    </span>
  );
}
