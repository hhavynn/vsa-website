import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { eventsRepository } from "../../../data/repos/events";
import { galleryRepository } from "../../../data/repos/gallery";
import { leaderboardRepository } from "../../../data/repos/leaderboard";
import { WRAPPED_2026 } from "../../../data/wrapped2026";
import { addDaysToDateOnly } from "../../../utils/calendar";
import {
  buildPublicHouseStandings,
  countEventsInWindow,
  formatStatNumber,
  roundToFriendlyFloor,
} from "../../../utils/wrapped";

const QUERY_OPTIONS = { staleTime: 10 * 60 * 1000, retry: 1 } as const;

const W = WRAPPED_2026;

function WrappedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <div className="font-serif text-[32px] font-black leading-none text-text-primary sm:text-[40px]">
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}

function WrappedCardLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-lg border border-border-strong px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-text-primary transition-colors duration-150 hover:bg-surface2"
    >
      {children}
    </Link>
  );
}

function WrappedMiniFeature({
  eyebrow,
  title,
  body,
  emoji,
}: {
  eyebrow: string;
  title: string;
  body: string;
  emoji?: string;
}) {
  return (
    <div className="border-t border-[var(--border)] pt-5">
      <div className="flex items-start gap-3">
        {emoji && (
          <span className="mt-0.5 text-[22px]" aria-hidden>
            {emoji}
          </span>
        )}
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
            {eyebrow}
          </div>
          <h3 className="mt-1 font-serif text-[24px] font-black leading-tight text-text-primary">
            {title}
          </h3>
        </div>
      </div>
      <p className="mt-3 font-sans text-[13.5px] leading-[1.75] text-text-secondary">
        {body}
      </p>
    </div>
  );
}

export function WrappedRecapCard() {
  const eventsQuery = useQuery(
    ["home-wrapped-events", W.windowStart, W.windowEnd],
    () =>
      eventsRepository.getEvents({
        date_from: W.windowStart,
        date_to: addDaysToDateOnly(W.windowEnd, 1),
        limit: 400,
      }),
    QUERY_OPTIONS,
  );

  const albumsQuery = useQuery(
    ["home-wrapped-albums", W.windowStart, W.windowEnd],
    () =>
      galleryRepository.getAlbums({
        date_from: W.windowStart,
        date_to: W.windowEnd,
        limit: 400,
      }),
    QUERY_OPTIONS,
  );

  const housesQuery = useQuery(
    ["home-wrapped-houses", W.academicYearStart],
    () => leaderboardRepository.getYearlyHouseLeaderboard(W.academicYearStart),
    QUERY_OPTIONS,
  );

  const eventCount = eventsQuery.data
    ? countEventsInWindow(eventsQuery.data, W.windowStart, W.windowEnd)
    : null;
  const albumCount = albumsQuery.data?.length ?? null;
  const houseStandings = buildPublicHouseStandings(
    housesQuery.data ?? [],
    W.academicYearStart,
  );
  const topHouse = houseStandings[0] ?? null;
  const topHousePoints = topHouse
    ? roundToFriendlyFloor(topHouse.total_points)
    : null;
  const spotlightEvents = W.signatureEvents.slice(0, 3);
  const featuredAwards = W.awards.slice(0, 3);

  return (
    <section className="scrapbook-board border-t border-[var(--border)]">
      <div className="vsa-container py-12 sm:py-16">
        <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <span className="scrapbook-pin" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,color-mix(in_srgb,var(--brand)_14%,transparent)_0%,transparent_70%),radial-gradient(48%_42%_at_86%_18%,color-mix(in_srgb,var(--accent)_12%,transparent)_0%,transparent_72%),radial-gradient(44%_48%_at_58%_92%,color-mix(in_srgb,var(--gold-t)_10%,transparent)_0%,transparent_70%)]"
            aria-hidden
          />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <div className="vsa-section-label">Year in review</div>
              <h2 className="mt-3 max-w-2xl font-serif text-[38px] font-black leading-[0.98] text-text-primary sm:text-[52px]">
                VSA Wrapped {W.yearLabel}
              </h2>
              <p className="mt-5 max-w-2xl font-sans text-[15px] leading-[1.8] text-text-secondary">
                {W.hero.tagline}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <WrappedCardLink to="/events">Events</WrappedCardLink>
                <WrappedCardLink to="/gallery">Gallery</WrappedCardLink>
                <WrappedCardLink to="/house">House</WrappedCardLink>
                <WrappedCardLink to="/get-involved">
                  Get involved
                </WrappedCardLink>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <WrappedMetric
                label="events counted"
                value={
                  eventCount === null ? "--" : formatStatNumber(eventCount)
                }
              />
              <WrappedMetric
                label="gallery albums"
                value={
                  albumCount === null ? "--" : formatStatNumber(albumCount)
                }
              />
              <WrappedMetric
                label={
                  topHouse ? `${topHouse.display_name} points` : "house points"
                }
                value={
                  topHousePoints === null
                    ? "--"
                    : formatStatNumber(topHousePoints)
                }
              />
            </div>
          </div>

          <div className="relative mt-10 grid gap-8 border-t border-[var(--border)] pt-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                Highlight reel
              </div>
              <div className="mt-5 grid gap-4">
                {spotlightEvents.map((event) => (
                  <div
                    key={event.name}
                    className="scrapbook-note border border-[var(--border)] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[24px]" aria-hidden>
                        {event.emoji}
                      </span>
                      <div>
                        <h3 className="font-serif text-[22px] font-black leading-tight text-text-primary">
                          {event.name}
                        </h3>
                        <p className="mt-2 font-sans text-[13.5px] leading-[1.7] text-text-secondary">
                          {event.blurb}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <WrappedMiniFeature
                eyebrow="VCN"
                title={W.vcn.fallbackTitle}
                body={W.vcn.fallbackBlurb}
              />
              <WrappedMiniFeature
                eyebrow="WNC"
                title={W.wnc.title}
                body={W.wnc.blurb}
              />
              <WrappedMiniFeature
                eyebrow="Cabinet"
                title={W.cabinet.fallbackTheme}
                body={W.cabinet.thankYou}
              />
            </div>
          </div>

          <div className="relative mt-8 border-t border-[var(--border)] pt-8">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              Wrapped awards
            </div>
            <h3 className="mt-2 max-w-2xl font-serif text-[30px] font-black leading-tight text-text-primary">
              The moments that became the group chat lore
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {featuredAwards.map((award) => (
                <div
                  key={award.title}
                  className="scrapbook-note border border-[var(--border)] p-4"
                >
                  <div className="text-[26px]" aria-hidden>
                    {award.emoji}
                  </div>
                  <div className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                    {award.title}
                  </div>
                  <div className="mt-1 font-serif text-[22px] font-black leading-tight text-[var(--accent)]">
                    {award.winner}
                  </div>
                  <p className="mt-2 font-sans text-[13px] leading-[1.65] text-text-secondary">
                    {award.blurb}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-8 border-t border-[var(--border)] pt-8">
            <p className="max-w-3xl font-sans text-[15px] leading-[1.85] text-text-secondary">
              {W.closing.blurb}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
