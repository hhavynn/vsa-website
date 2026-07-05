import { ReactNode } from "react";

import { cn } from "../../lib/utils";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  return (
    <div
      className={cn(
        "group/spotlight relative overflow-hidden rounded-lg border border-border-strong/70 bg-surface transition-[border-color,box-shadow,transform] duration-300",
        "before:pointer-events-none before:absolute before:inset-[-1px] before:z-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(59,189,181,0.24),transparent_42%)] before:opacity-0 before:transition-opacity before:duration-300",
        "after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.08)_42%,transparent_58%)] after:opacity-0 after:transition-opacity after:duration-300",
        "hover:-translate-y-1 hover:border-brand-400/70 hover:shadow-[0_18px_42px_rgba(15,23,42,0.18)] hover:before:opacity-100 hover:after:opacity-100",
        "dark:hover:shadow-[0_18px_42px_rgba(0,0,0,0.38)]",
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
