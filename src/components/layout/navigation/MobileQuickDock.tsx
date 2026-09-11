import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import { FiCalendar, FiFlag, FiHome, FiTarget } from "react-icons/fi";
import { NavLink, useLocation } from "react-router-dom";

import { cn } from "../../../lib/utils";
import { DOCK_ITEMS } from "./navConfig";

type DockItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const HomeIcon = FiHome as unknown as DockItem["icon"];
const EventsIcon = FiCalendar as unknown as DockItem["icon"];
const HouseIcon = FiFlag as unknown as DockItem["icon"];
const PointsIcon = FiTarget as unknown as DockItem["icon"];

const DOCK_ICONS: Record<string, DockItem["icon"]> = {
  "/": HomeIcon,
  "/events": EventsIcon,
  "/house": HouseIcon,
  "/points": PointsIcon,
};

// Sourced from the shared nav config (navConfig.ts) so this stays in sync
// with the desktop Explore panel and the mobile drawer. Points here
// deliberately routes to /points, not /leaderboard — the previous version's
// "Points" label pointed at the roster instead of the personal lookup it
// promised.
const dockItems: DockItem[] = DOCK_ITEMS.map((item) => ({
  label: item.label === 'Find My Points' ? 'Points' : item.label,
  to: item.path,
  icon: DOCK_ICONS[item.path] ?? HomeIcon,
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
      <div className="mx-auto grid max-w-[284px] grid-cols-4 gap-1 rounded-full border border-border-strong/70 bg-surface/90 p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        {dockItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex h-12 min-w-0 flex-col items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                isActive
                  ? "bg-brand-500 text-white shadow-[0_10px_24px_rgba(69,212,200,0.3)]"
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
