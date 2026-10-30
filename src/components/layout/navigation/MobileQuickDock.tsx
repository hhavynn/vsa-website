import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { cn } from "../../../lib/utils";
import { DOCK_ITEMS } from "./navConfig";

type DockItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type IconProps = { className?: string; "aria-hidden"?: boolean };

// Local copies of the four Feather glyphs this dock uses, so the only public
// main-chunk import of `react-icons/fi` disappears: webpack keeps the unused
// Feather functions when the set module enters the entry chunk, which cost
// ~2 kB gzipped for no render benefit. Geometry matches react-icons/fi.
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FiHome({ className, ...props }: IconProps) {
  return (
    <svg {...svgProps} className={className} {...props}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FiCalendar({ className, ...props }: IconProps) {
  return (
    <svg {...svgProps} className={className} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function FiFlag({ className, ...props }: IconProps) {
  return (
    <svg {...svgProps} className={className} {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function FiTarget({ className, ...props }: IconProps) {
  return (
    <svg {...svgProps} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

const DOCK_ICONS: Record<string, DockItem["icon"]> = {
  "/": FiHome,
  "/events": FiCalendar,
  "/house": FiFlag,
  "/points": FiTarget,
};

// Sourced from the shared nav config (navConfig.ts) so this stays in sync
// with the desktop Explore panel and the mobile drawer. Points here
// deliberately routes to /points, not /leaderboard — the previous version's
// "Points" label pointed at the roster instead of the personal lookup it
// promised.
const dockItems: DockItem[] = DOCK_ITEMS.map((item) => ({
  label: item.label === "Find My Points" ? "Points" : item.label,
  to: item.path,
  icon: DOCK_ICONS[item.path] ?? FiHome,
}));

const hiddenPathPrefixes = ["/admin", "/signin"];

// Below this scroll offset the dock is always shown (page top / hero area).
const ALWAYS_SHOW_THRESHOLD = 80;
// Ignore tiny scroll jitters when deciding direction.
const DIRECTION_DELTA = 6;

export function MobileQuickDock() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [hidden, setHidden] = useState(false);

  const isHiddenRoute = hiddenPathPrefixes.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  // Reveal again whenever the route changes (each page starts at the top).
  useEffect(() => {
    setHidden(false);
  }, [location.pathname]);

  // Auto-hide on scroll-down, reveal on scroll-up. Always shown near the top.
  useEffect(() => {
    if (isHiddenRoute) return;
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < ALWAYS_SHOW_THRESHOLD) {
          setHidden(false);
        } else if (y > lastY + DIRECTION_DELTA) {
          setHidden(true);
        } else if (y < lastY - DIRECTION_DELTA) {
          setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHiddenRoute]);

  if (isHiddenRoute) {
    return null;
  }

  return (
    <motion.nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 top-[68px] z-[45] px-4 lg:hidden"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
      animate={{
        opacity: hidden ? 0 : 1,
        y: hidden ? -96 : 0,
        scale: 1,
      }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ pointerEvents: hidden ? "none" : "auto" }}
      aria-hidden={hidden}
    >
      <div className="mx-auto grid max-w-[284px] grid-cols-4 gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-border-strong)_70%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        {dockItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex h-12 min-w-0 flex-col items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                isActive
                  ? "bg-brand-500 text-[var(--color-on-brand)] shadow-[0_10px_24px_rgba(59,189,181,0.3)] dark:bg-brand-400"
                  : "text-text-secondary hover:bg-surface2 hover:text-text-primary",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="mb-1 h-4 w-4" aria-hidden />
                <span className="max-w-full truncate">{label}</span>
                {isActive && (
                  <motion.span
                    layoutId="mobile-quick-dock-active"
                    className="absolute -top-1 h-1.5 w-1.5 rounded-full bg-white/90"
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.2,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  );
}
