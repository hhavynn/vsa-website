import { useEffect, useRef, useState } from "react";
import { UVSASchool } from "../../../types";
import { cn } from "../../../lib/utils";
import { sanitizeHref } from "../../../utils/sanitizeUrl";
import { InstagramIcon } from "./icons";
import { getSupabaseImageUrl } from "../../../lib/supabaseImages";
import {
  getFallbackPaletteClass,
  getSafeLogoUrl,
  getSchoolInitials,
} from "../../../lib/uvsaSchoolLogos";

export type SchoolMarkSize = "xs" | "sm" | "md" | "card" | "lg";

const SIZE_CLASS: Record<SchoolMarkSize, string> = {
  xs: "h-10 w-10 text-xs",
  sm: "h-12 w-12 text-sm",
  md: "h-14 w-14 text-sm",
  card: "h-20 w-20 text-lg sm:h-24 sm:w-24 sm:text-xl",
  lg: "h-28 w-28 text-2xl sm:h-32 sm:w-32 sm:text-3xl",
};

// Initials longer than 4 characters (e.g. CHAPMA) shrink so they stay inside the circle.
const LONG_INITIALS_CLASS: Record<SchoolMarkSize, string> = {
  xs: "text-[9px]",
  sm: "text-[10px] sm:text-xs",
  md: "text-xs",
  card: "text-base sm:text-lg",
  lg: "text-xl sm:text-2xl",
};

// Request roughly 2x the rendered size when image transforms are enabled.
const SIZE_PX: Record<SchoolMarkSize, number> = {
  xs: 80,
  sm: 96,
  md: 112,
  card: 192,
  lg: 256,
};

interface SchoolVisualMarkProps {
  school?:
    | (Pick<UVSASchool, "logo_url" | "short_name" | "slug"> &
        Partial<Pick<UVSASchool, "instagram_url">>)
    | null;
  fallbackLabel?: string;
  size?: SchoolMarkSize;
  /** Decorative marks are hidden from assistive tech. Ignored when the mark links out. */
  decorative?: boolean;
  /**
   * Link the mark to the school's Instagram (`instagram_url`) when it has one.
   * Pass `false` where the mark sits inside another interactive element, or in
   * admin previews.
   */
  interactive?: boolean;
  className?: string;
}

/**
 * Circular school logo / Instagram PFP. Falls back to generated initials when
 * there is no (safe) logo or the image fails to load, and shows a shimmer while
 * a logo is still loading.
 */
export function SchoolVisualMark({
  interactive = true,
  ...props
}: SchoolVisualMarkProps) {
  const { school, fallbackLabel = "VSA", size = "md" } = props;
  const rawUrl = interactive ? school?.instagram_url?.trim() : null;
  // sanitizeHref returns "#" for anything unsafe; render those as plain marks.
  const href = rawUrl ? sanitizeHref(rawUrl) : null;

  if (!href || href === "#") return <MarkImage {...props} />;

  const name = school?.short_name || fallbackLabel;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${name} VSA on Instagram`}
      className={cn(
        "group relative inline-flex shrink-0 rounded-full hover:ring-2 hover:ring-brand-600/30 dark:hover:ring-brand-400/30",
        "motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:scale-105",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:focus-visible:ring-brand-400",
      )}
    >
      {/* The link carries the accessible name; the image inside is presentational. */}
      <MarkImage {...props} decorative />
      {HOVER_BADGE_SIZES.has(size) && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-surface text-brand-600 opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-brand-400"
        >
          <InstagramIcon size={12} />
        </span>
      )}
    </a>
  );
}

// Too small to carry an indicator on the compact marks.
const HOVER_BADGE_SIZES = new Set<SchoolMarkSize>(["md", "card", "lg"]);

function MarkImage({
  school,
  fallbackLabel = "VSA",
  size = "md",
  decorative = false,
  className,
}: Omit<SchoolVisualMarkProps, "interactive">) {
  const label = school?.short_name || fallbackLabel;
  const logoUrl = getSafeLogoUrl(school?.logo_url);
  const fit =
    getSchoolInitials(label).length > 4 ? LONG_INITIALS_CLASS[size] : undefined;
  const frame = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    "border border-[var(--color-border)]",
    SIZE_CLASS[size],
    className,
  );

  if (!logoUrl) {
    return (
      <FallbackMark
        label={label}
        school={school}
        frame={frame}
        fit={fit}
        decorative={decorative}
      />
    );
  }

  // Keyed by URL so a replaced logo gets a fresh loading/failed state.
  return (
    <LogoImage
      key={logoUrl}
      url={getSupabaseImageUrl(logoUrl, {
        width: SIZE_PX[size],
        height: SIZE_PX[size],
        resize: "cover",
      })}
      label={label}
      school={school}
      frame={frame}
      fit={fit}
      decorative={decorative}
    />
  );
}

function LogoImage({
  url,
  label,
  school,
  frame,
  fit,
  decorative,
}: {
  url: string;
  label: string;
  school: SchoolVisualMarkProps["school"];
  frame: string;
  fit?: string;
  decorative: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setStatus("loaded");
  }, []);

  if (status === "failed") {
    return (
      <FallbackMark
        label={label}
        school={school}
        frame={frame}
        fit={fit}
        decorative={decorative}
      />
    );
  }

  return (
    <span className={cn(frame, "bg-surface2")} data-logo-status={status}>
      {status === "loading" && (
        <span className="skeleton-shimmer absolute inset-0" aria-hidden />
      )}
      <img
        ref={imgRef}
        src={url}
        alt={decorative ? "" : `${label} logo`}
        aria-hidden={decorative || undefined}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
      />
    </span>
  );
}

function FallbackMark({
  label,
  school,
  frame,
  fit,
  decorative,
}: {
  label: string;
  school: SchoolVisualMarkProps["school"];
  frame: string;
  fit?: string;
  decorative: boolean;
}) {
  return (
    <span
      className={cn(
        frame,
        fit,
        "border-transparent font-sans font-black uppercase tracking-[0.04em]",
        getFallbackPaletteClass(school ?? undefined),
      )}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": `${label} logo placeholder` })}
      data-logo-status="fallback"
    >
      {getSchoolInitials(label)}
    </span>
  );
}
