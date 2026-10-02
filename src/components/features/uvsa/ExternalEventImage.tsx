import { useEffect, useRef, useState } from "react";
import { ExternalEvent } from "../../../types";
import { cn } from "../../../lib/utils";
import {
  getExternalDateTile,
  getExternalFlyerCandidates,
} from "../../../lib/externalEventDisplay";
import {
  getSupabaseImageSrcSet,
  getSupabaseImageUrl,
} from "../../../lib/supabaseImages";

type FlyerEvent = Pick<
  ExternalEvent,
  "title" | "date" | "event_type" | "image_url" | "source_event"
>;

const DEFAULT_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";

/**
 * The event flyer, or a branded date tile when there is none. It walks the
 * flyer candidates (linked event thumbnail, then its full image, then the
 * listing's own image) so one broken URL never leaves a broken-image icon.
 */
export function ExternalEventImage({
  event,
  className,
  fallbackClassName,
  width = 640,
  height = 800,
  sizes = DEFAULT_SIZES,
}: {
  event: FlyerEvent;
  /** Frame sizing when a flyer is shown (aspect ratio / height). */
  className?: string;
  /** Frame sizing for the no-flyer date tile. */
  fallbackClassName?: string;
  width?: number;
  height?: number;
  sizes?: string;
}) {
  const candidates = getExternalFlyerCandidates(event);
  // Keyed by the candidate list so a changed flyer starts with a fresh state.
  return (
    <FlyerFrame
      key={candidates.join("|")}
      event={event}
      candidates={candidates}
      className={className}
      fallbackClassName={fallbackClassName}
      width={width}
      height={height}
      sizes={sizes}
    />
  );
}

function FlyerFrame({
  event,
  candidates,
  className,
  fallbackClassName,
  width,
  height,
  sizes,
}: {
  event: FlyerEvent;
  candidates: string[];
  className?: string;
  fallbackClassName?: string;
  width: number;
  height: number;
  sizes: string;
}) {
  const [failedCount, setFailedCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const source = candidates[failedCount];

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [source]);

  if (!source) return <DateTile event={event} className={fallbackClassName} />;

  return (
    <div
      className={cn(
        "relative aspect-[4/5] overflow-hidden border-b border-[var(--color-border)] bg-surface2",
        className,
      )}
      data-flyer-status={loaded ? "loaded" : "loading"}
    >
      {!loaded && (
        <span className="skeleton-shimmer absolute inset-0" aria-hidden />
      )}
      <img
        ref={imgRef}
        src={getSupabaseImageUrl(source, {
          width,
          height,
          resize: "contain",
          quality: 72,
        })}
        srcSet={getSupabaseImageSrcSet(source, [Math.round(width / 2), width], {
          resize: "contain",
          quality: 72,
        })}
        sizes={sizes}
        alt={`${event.title} flyer`}
        className={cn(
          "h-full w-full object-contain transition duration-300 motion-safe:group-hover:scale-[1.02]",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setFailedCount((count) => count + 1);
        }}
      />
    </div>
  );
}

/** No flyer: a quiet date tile so the card still reads as an event, not a blank. */
function DateTile({
  event,
  className,
}: {
  event: FlyerEvent;
  className?: string;
}) {
  const tile = getExternalDateTile(event);
  return (
    <div
      aria-hidden
      data-flyer-status="fallback"
      className={cn(
        "flex aspect-[16/9] flex-col items-center justify-center gap-1 border-b border-[var(--color-border)]",
        "bg-brand-600/10 text-center dark:bg-brand-400/10",
        className,
      )}
    >
      {tile && (
        <>
          <span className="font-sans text-xs font-semibold uppercase tracking-label text-brand-600 dark:text-brand-400">
            {tile.month}
          </span>
          <span className="font-serif text-5xl leading-none text-text-primary">
            {tile.day}
          </span>
        </>
      )}
      <span className="mt-1 font-sans text-2xs font-semibold uppercase tracking-label text-text-secondary">
        {event.event_type || "SoCal VSA external"}
      </span>
    </div>
  );
}
