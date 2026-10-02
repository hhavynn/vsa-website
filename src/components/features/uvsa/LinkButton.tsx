import { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { sanitizeHref } from "../../../utils/sanitizeUrl";

type LinkButtonVariant = "primary" | "outline";

const variants: Record<LinkButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700 " +
    "dark:bg-brand-400 dark:border-brand-400 dark:text-[#050810] dark:hover:bg-brand-300 dark:hover:border-brand-300 " +
    "focus-visible:ring-brand-600",
  outline:
    "bg-transparent text-[var(--color-text2)] border border-[var(--color-border)] " +
    "hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] " +
    "focus-visible:ring-[var(--color-border-strong)]",
};

/** Anchor styled like `Button`, for outbound links that should be real links. */
export function LinkButton({
  href,
  variant = "outline",
  className,
  external = true,
  children,
  ...aria
}: {
  href: string;
  variant?: LinkButtonVariant;
  className?: string;
  external?: boolean;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <a
      href={href.startsWith("#") ? href : sanitizeHref(href)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded px-3.5 py-1.5",
        "font-sans text-xs font-medium tracking-[-0.01em] whitespace-nowrap transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        variants[variant],
        className,
      )}
      {...aria}
    >
      {children}
    </a>
  );
}
