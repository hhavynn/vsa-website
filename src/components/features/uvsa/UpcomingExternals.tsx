import { ExternalEvent } from "../../../types";
import { FALLBACK_LINKS } from "../../../config/publicFallbackContent";
import { Skeleton } from "../../ui/Skeleton";
import { CalendarIcon } from "./icons";
import { ExternalEventCard } from "./ExternalEventCard";
import { FeaturedExternal } from "./FeaturedExternal";

export interface SummerEmptyCopy {
  badge: string;
  title: string;
  body: string;
}

export function UpcomingExternals({
  heading,
  events,
  featured,
  loading,
  error = false,
  summerEmpty,
  emptyTitle,
  emptyMessage,
}: {
  heading: string;
  events: ExternalEvent[];
  /** Set only when a featured event is genuinely upcoming. */
  featured?: ExternalEvent;
  loading: boolean;
  /** The listing query failed; show an error instead of any empty state. */
  error?: boolean;
  /** When set, replaces the generic empty state (summer break). */
  summerEmpty?: SummerEmptyCopy;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const gridEvents = featured
    ? events.filter((event) => event.id !== featured.id)
    : events;

  return (
    <section
      id="upcoming"
      aria-labelledby="upcoming-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div className="flex items-center gap-3">
        <CalendarIcon
          size={24}
          aria-hidden
          className="text-brand-600 dark:text-brand-400"
        />
        <h2
          id="upcoming-heading"
          className="font-serif text-3xl text-text-primary sm:text-4xl"
        >
          {heading}
        </h2>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-hidden
        >
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[28rem] rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--color-border)] bg-surface p-6 sm:p-8"
        >
          <p className="font-serif text-xl text-text-primary">
            Upcoming externals couldn&apos;t load right now.
          </p>
          <p className="mt-2 font-sans text-sm text-text-secondary">
            Try again in a bit, or check{" "}
            <a
              href={FALLBACK_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-400 dark:focus-visible:ring-brand-400"
            >
              our Instagram
            </a>{" "}
            for the latest.
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-surface p-8 text-center sm:p-10">
          {summerEmpty ? (
            <div className="mx-auto max-w-2xl space-y-3">
              <span className="scrapbook-sticker scrapbook-sticker-gold inline-flex">
                {summerEmpty.badge}
              </span>
              <p className="font-serif text-2xl leading-tight text-text-primary">
                {summerEmpty.title}
              </p>
              <p className="font-sans text-sm leading-relaxed text-text-secondary">
                {summerEmpty.body}
              </p>
              <p className="font-sans text-xs italic text-text-secondary">
                If VSA at UCSD is coordinating attendance, ride forms are
                usually posted through our Linktree.
              </p>
            </div>
          ) : (
            <>
              <p className="font-serif text-xl italic text-text-secondary">
                {emptyTitle}
              </p>
              <p className="mt-2 font-sans text-sm text-text-secondary">
                {emptyMessage}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {featured && <FeaturedExternal event={featured} />}
          {gridEvents.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gridEvents.map((event) => (
                <ExternalEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
