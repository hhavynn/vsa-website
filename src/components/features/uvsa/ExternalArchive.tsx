import { useMemo, useState } from "react";
import { ExternalEvent } from "../../../types";
import { formatDateOnly } from "../../../lib/dateOnly";
import { cn } from "../../../lib/utils";
import { groupArchiveByAcademicYear } from "../../../lib/uvsaNetwork";
import { Skeleton } from "../../ui/Skeleton";
import { ChevronDownIcon } from "./icons";
import { resolveExternalHost } from "../../../lib/externalEventLinking";
import { SchoolVisualMark } from "./SchoolVisualMark";

export function ExternalArchive({
  heading,
  description,
  events,
  loading,
}: {
  heading: string;
  description: string;
  events: ExternalEvent[];
  loading: boolean;
}) {
  const groups = useMemo(() => groupArchiveByAcademicYear(events), [events]);
  // The most recent year starts open; older years stay collapsed to keep the page short.
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null);
  const open =
    openKeys ?? new Set(groups.slice(0, 1).map((group) => group.key));

  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenKeys(next);
  };

  if (!loading && events.length === 0) return null;

  return (
    <section
      id="archive"
      aria-labelledby="archive-heading"
      className="scroll-mt-24 space-y-5"
    >
      <div>
        <h2
          id="archive-heading"
          className="font-serif text-2xl text-text-primary sm:text-3xl"
        >
          {heading}
        </h2>
        {description && (
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = open.has(group.key);
            const panelId = `archive-${group.key}`;
            return (
              <div
                key={group.key}
                className="rounded-lg border border-[var(--color-border)] bg-surface"
              >
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
                >
                  <span className="font-serif text-lg text-text-primary">
                    {group.label}
                  </span>
                  <span className="inline-flex items-center gap-2 font-sans text-xs text-text-secondary">
                    {group.events.length}{" "}
                    {group.events.length === 1 ? "event" : "events"}
                    <ChevronDownIcon
                      size={11}
                      aria-hidden
                      className={cn(
                        "transition-transform duration-150",
                        isOpen && "rotate-180",
                      )}
                    />
                  </span>
                </button>

                {isOpen && (
                  <ul
                    id={panelId}
                    className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]"
                  >
                    {group.events.map((event) => (
                      <ArchiveRow key={event.id} event={event} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ArchiveRow({ event }: { event: ExternalEvent }) {
  const hostIdentity = resolveExternalHost(event);
  const host = hostIdentity.shortName;
  const meta = [
    host,
    event.event_type,
    event.date ? formatDateOnly(event.date, "MMM d, yyyy") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const links = [
    { label: "Info", url: event.host_info_url },
    { label: "IG Post", url: event.instagram_url },
    { label: "Photos", url: event.photo_album_url },
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <SchoolVisualMark
        school={hostIdentity.school}
        fallbackLabel={hostIdentity.markLabel}
        size="xs"
      />
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-sans text-sm font-semibold text-text-primary">
          {event.title}
        </p>
        <p className="font-sans text-xs text-text-secondary">{meta}</p>
      </div>
      {links.length > 0 && (
        <div className="flex gap-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} for ${event.title}`}
              className="inline-flex min-h-[32px] items-center font-sans text-xs font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-400 dark:focus-visible:ring-brand-400"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
