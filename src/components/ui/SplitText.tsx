import { motion, useReducedMotion } from "framer-motion";

import { cn } from "../../lib/utils";

type SplitTextProps = {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  disabled?: boolean;
};

export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.035,
  disabled = false,
}: SplitTextProps) {
  const shouldReduceMotion = useReducedMotion();

  // Reduced motion: no per-character blur/rise, just the final text.
  if (disabled || shouldReduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline-block", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((character, index) => (
          <motion.span
            className="inline-block will-change-transform"
            initial={{ opacity: 0, y: 34, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: delay + index * stagger,
              duration: 0.62,
              ease: [0.22, 1, 0.36, 1],
            }}
            key={`${character}-${index}`}
          >
            {character === " " ? "\u00A0" : character}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
