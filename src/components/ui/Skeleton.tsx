import type { CSSProperties } from "react";

import { cn } from "../../lib/utils";

/**
 * Base skeleton block — a shimmering placeholder shaped by its className
 * (width/height/rounding passed in by the caller). Respects reduced-motion
 * via the `.skeleton-shimmer` CSS (falls back to a static fill, no animation).
 */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("skeleton-shimmer rounded-md", className)} style={style} aria-hidden />;
}
