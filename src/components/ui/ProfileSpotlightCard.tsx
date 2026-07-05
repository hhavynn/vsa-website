import { type CSSProperties, type ReactNode, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "../../lib/utils";

type ProfileSpotlightCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Behavior-only wrapper that adds a React Bits-style spotlight to leadership
 * profile cards: a soft brand glow tracks the cursor on pointer devices and a
 * gentle lift on hover. It does NOT impose its own border/background — pass the
 * card's surface styling via `className` so it composes with existing scrapbook
 * cards without double borders. The glow is a real child element (not a
 * pseudo-element) to avoid colliding with existing tape/pin decorations.
 *
 * Degrades gracefully: on touch (no hover) the glow is a static, subtle hint,
 * and with reduced-motion the cursor tracking and lift are disabled. Content
 * always sits above the glow so names, roles, and years stay readable.
 */
export function ProfileSpotlightCard({
  children,
  className,
  style,
}: ProfileSpotlightCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--spot-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("profile-spotlight group/profile", className)}
      style={style}
    >
      <span aria-hidden className="profile-spotlight__glow" />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
