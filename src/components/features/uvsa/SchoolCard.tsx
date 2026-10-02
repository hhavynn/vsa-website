import { useId, useState } from "react";
import { UVSASchool } from "../../../types";
import { Badge } from "../../ui/Badge";
import { cn } from "../../../lib/utils";
import { isHomeBaseSchool } from "../../../lib/uvsaNetwork";
import { getInstagramHandle } from "../../../lib/uvsaSchoolLogos";
import {
  ChevronDownIcon,
  HomeIcon,
  InstagramIcon,
  MapPinIcon,
  ExternalLinkIcon,
} from "./icons";
import { LinkButton } from "./LinkButton";
import { SchoolVisualMark } from "./SchoolVisualMark";

const SYSTEM_BADGE_COLOR = {
  UC: "blue",
  CSU: "green",
  Private: "purple",
} as const;

type SchoolLink = { label: string; url: string };

/** Links shown behind the "Details" toggle; Instagram is the card's primary action. */
function getSecondaryLinks(
  school: UVSASchool,
  primaryUrl: string | null,
): SchoolLink[] {
  return [
    { label: "Linktree", url: school.linktree_url },
    { label: "Website", url: school.website_url },
    { label: "Instagram", url: school.instagram_url },
    { label: "Facebook", url: school.facebook_url },
    { label: "YouTube", url: school.youtube_url },
    { label: "TikTok", url: school.tiktok_url },
  ].filter(
    (link): link is SchoolLink => Boolean(link.url) && link.url !== primaryUrl,
  );
}

export function SchoolCard({ school }: { school: UVSASchool }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const isHome = isHomeBaseSchool(school);

  // Instagram is the primary social action; fall back so a card never has none.
  const primary = school.instagram_url
    ? { label: "Instagram", url: school.instagram_url, icon: true }
    : school.linktree_url
      ? { label: "Linktree", url: school.linktree_url, icon: false }
      : school.website_url
        ? { label: "Website", url: school.website_url, icon: false }
        : null;

  const secondaryLinks = getSecondaryLinks(school, primary?.url ?? null);
  const knownFor = school.known_for || [];
  const recurringEvents = school.recurring_events || [];
  const hasDetails =
    Boolean(school.description) ||
    knownFor.length > 0 ||
    recurringEvents.length > 0 ||
    secondaryLinks.length > 0;

  return (
    <article
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-lg border bg-surface p-4 transition-colors sm:flex sm:flex-col sm:p-5 sm:text-center",
        isHome
          ? "border-brand-600/40 ring-1 ring-brand-600/15 dark:border-brand-400/40 dark:ring-brand-400/15"
          : "border-[var(--color-border)]",
      )}
      aria-label={school.short_name}
    >
      {isHome && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-brand-700 dark:bg-brand-600/15 dark:text-brand-400">
          <HomeIcon size={9} aria-hidden /> Home Base
        </span>
      )}

      <SchoolVisualMark school={school} size="card" />

      <div className="flex min-w-0 flex-col items-start gap-2 sm:mt-1 sm:w-full sm:items-center">
        <div>
          <h3 className="font-serif text-xl leading-tight text-text-primary">
            {school.short_name}
          </h3>
          {school.vsa_name && (
            <p className="mt-0.5 font-sans text-xs text-text-secondary">
              {school.vsa_name}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:justify-center">
          {school.city && (
            <span className="inline-flex items-center gap-1 font-sans text-xs text-text-secondary">
              <MapPinIcon size={11} aria-hidden /> {school.city}
            </span>
          )}
          <Badge
            label={school.system_type}
            color={SYSTEM_BADGE_COLOR[school.system_type] ?? "gray"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:w-full sm:flex-col sm:pt-1">
          {primary && (
            <LinkButton
              href={primary.url}
              variant="primary"
              className="sm:w-full sm:max-w-[200px]"
              aria-label={`${school.short_name} on ${primary.label}`}
            >
              {primary.icon && <InstagramIcon size={13} aria-hidden />}{" "}
              {primary.icon
                ? (getInstagramHandle(primary.url) ?? primary.label)
                : primary.label}
            </LinkButton>
          )}

          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded px-2 font-sans text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
            >
              {expanded ? "Hide details" : "Details"}
              <ChevronDownIcon
                size={10}
                aria-hidden
                className={cn(
                  "transition-transform duration-150",
                  expanded && "rotate-180",
                )}
              />
            </button>
          )}
        </div>
      </div>

      {hasDetails && expanded && (
        <div
          id={detailsId}
          className="col-span-2 w-full animate-fade-in space-y-3 border-t border-[var(--color-border)] pt-4 text-left"
        >
          {school.description && (
            <p className="font-sans text-sm leading-relaxed text-text-secondary">
              {school.description}
            </p>
          )}
          {knownFor.length > 0 && (
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-label text-text-muted">
                Known for
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {knownFor.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-[var(--color-border)] px-2 py-0.5 font-sans text-[11px] text-text-secondary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recurringEvents.length > 0 && (
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-label text-text-muted">
                Recurring events
              </p>
              <p className="mt-1 font-sans text-sm text-text-secondary">
                {recurringEvents.join(" · ")}
              </p>
            </div>
          )}
          {secondaryLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {secondaryLinks.map((link) => (
                <LinkButton
                  key={link.label}
                  href={link.url}
                  aria-label={`${school.short_name} ${link.label}`}
                >
                  {link.label} <ExternalLinkIcon size={9} aria-hidden />
                </LinkButton>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
