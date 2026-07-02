import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { PageTitle } from '../components/common/PageTitle';
import { WrappedSection } from '../components/features/wrapped/WrappedSection';
import { StatCard } from '../components/features/wrapped/StatCard';
import { HouseCup } from '../components/features/wrapped/HouseCup';
import { PhotoWall } from '../components/features/wrapped/PhotoWall';
import { eventsRepository } from '../data/repos/events';
import { galleryRepository } from '../data/repos/gallery';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { vcnArchivesRepository } from '../data/repos/vcnArchives';
import { cabinetYearsRepository } from '../data/repos/cabinetYears';
import { WRAPPED_2026 } from '../data/wrapped2026';
import {
  buildPublicHouseStandings,
  countEventsInWindow,
  formatStatNumber,
  roundToFriendlyFloor,
  sumCommunityPoints,
} from '../utils/wrapped';
import { addDaysToDateOnly } from '../utils/calendar';
import { getSupabaseImageUrl } from '../lib/supabaseImages';

// Aggregate-only data. This page intentionally never queries member-level
// tables/views (yearly member leaderboard, attendance rows, rankings) — see
// docs/vsa-wrapped.md for the privacy rules.
const QUERY_OPTIONS = { staleTime: 10 * 60 * 1000, retry: 1 } as const;

const W = WRAPPED_2026;

// Internal nav link color — matches the text-brand-600/dark:text-brand-400
// idiom used for this exact purpose across every other public page.
const LINK_CLASS = 'text-brand-600 dark:text-brand-400';

function CtaLink({ to, label, external = false }: { to: string; label: string; external?: boolean }) {
  const className =
    'inline-flex items-center justify-center rounded-lg border border-border-strong px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.05em] text-text-primary transition-colors duration-150 hover:bg-surface2';
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {label}
    </Link>
  );
}

export function Wrapped() {
  const shouldReduceMotion = useReducedMotion();

  const eventsQuery = useQuery(
    ['wrapped-events', W.windowStart, W.windowEnd],
    () =>
      eventsRepository.getEvents({
        date_from: W.windowStart,
        // +1 day: events.date is a timestamptz, so an inclusive .lte() bound of
        // windowEnd would drop any event later than midnight on that day.
        date_to: addDaysToDateOnly(W.windowEnd, 1),
        limit: 400,
      }),
    QUERY_OPTIONS
  );
  const albumsQuery = useQuery(
    ['wrapped-albums', W.windowStart, W.windowEnd],
    // gallery_events.date is a plain DATE column, so an inclusive bound here
    // is correct (no off-by-one). Fetch the full year rather than a capped
    // "newest N" slice so older albums aren't pushed out as new ones are added.
    () => galleryRepository.getAlbums({ date_from: W.windowStart, date_to: W.windowEnd, limit: 400 }),
    QUERY_OPTIONS
  );
  const housesQuery = useQuery(
    ['wrapped-houses', W.academicYearStart],
    () => leaderboardRepository.getYearlyHouseLeaderboard(W.academicYearStart),
    QUERY_OPTIONS
  );
  const vcnQuery = useQuery(['wrapped-vcn'], () => vcnArchivesRepository.getPublishedArchives(), QUERY_OPTIONS);
  const cabinetQuery = useQuery(['wrapped-cabinet'], () => cabinetYearsRepository.getYears(), QUERY_OPTIONS);

  const eventCount = useMemo(() => {
    if (!eventsQuery.data) return null;
    const count = countEventsInWindow(eventsQuery.data, W.windowStart, W.windowEnd);
    return count > 0 ? count : null;
  }, [eventsQuery.data]);

  // Already year-scoped by the query itself (date_from/date_to), so no
  // client-side re-filtering or "newest N" capping is needed here.
  const yearAlbums = albumsQuery.data ?? [];
  const albumCount = yearAlbums.length > 0 ? yearAlbums.length : null;

  // Same placeholder-injection + official public point overrides as /leaderboard.
  const houses = useMemo(
    () => buildPublicHouseStandings(housesQuery.data ?? [], W.academicYearStart),
    [housesQuery.data]
  );
  const communityPoints = useMemo(() => {
    const total = sumCommunityPoints(houses);
    return total > 0 ? total : null;
  }, [houses]);

  const vcnArchive = useMemo(() => {
    const archives = vcnQuery.data ?? [];
    return (
      archives.find((a) => a.year === W.academicYearStart + 1) ??
      archives.find((a) => a.is_current) ??
      null
    );
  }, [vcnQuery.data]);

  const cabinetYear = useMemo(
    () => (cabinetQuery.data ?? []).find((y) => y.start_year === W.academicYearStart) ?? null,
    [cabinetQuery.data]
  );

  const vcnCover = vcnArchive?.cover_thumbnail_url || vcnArchive?.cover_image_url || null;

  return (
    <>
      <PageTitle title={`VSA Wrapped ${W.yearLabel}`} />

      {/* ── 01 · Hero ─────────────────────────────────────────────────────── */}
      <div className="scrapbook-board relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--brand) 16%, transparent) 0%, transparent 70%), radial-gradient(50% 40% at 85% 20%, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%), radial-gradient(45% 45% at 60% 90%, color-mix(in srgb, var(--gold-t) 12%, transparent) 0%, transparent 70%)',
          }}
        />
        <div className="vsa-container relative z-10 py-20 text-center sm:py-28">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="scrapbook-sticker scrapbook-sticker-coral rotate-[-2deg]">
              That's a wrap on {W.yearLabel}
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl font-serif text-[52px] font-black leading-[0.95] tracking-[-0.03em] text-text-primary sm:text-[84px]">
              VSA <span className={`italic ${LINK_CLASS}`}>Wrapped</span>
            </h1>
            <p className="mt-3 font-mono text-[13px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
              {W.yearLabel}
            </p>
            <p className="mx-auto mt-5 max-w-xl font-sans text-[16px] leading-[1.8] text-text-secondary">
              {W.hero.tagline}
            </p>
            <a
              href="#numbers"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-surface2"
            >
              {W.hero.scrollCta} ↓
            </a>
          </motion.div>
        </div>
      </div>

      <div className="vsa-container">
        {/* ── 02 · Year by the numbers ──────────────────────────────────────── */}
        <WrappedSection
          id="numbers"
          number="02"
          sticker="Year by the Numbers"
          heading="We really did all that."
          subheading="Community totals from the whole year — every GBM, social, House battle, and photo dump combined."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              emoji="🎉"
              label="Events hosted"
              value={eventCount ? formatStatNumber(eventCount) : null}
              fallback={W.fallbacks.events}
              caption="GBMs, mixers, retreats, culture nights, and everything between."
              rotate="left"
            />
            <StatCard
              emoji="🏆"
              label="House points earned together"
              value={communityPoints ? `${formatStatNumber(roundToFriendlyFloor(communityPoints))}+` : null}
              fallback={W.fallbacks.points}
              caption="Every check-in, every House, all year. Counted as one community."
            />
            <StatCard
              emoji="📸"
              label="Photo albums dropped"
              value={albumCount ? formatStatNumber(albumCount) : null}
              fallback={W.fallbacks.photos}
              caption="Approved album drops in the public gallery."
              rotate="right"
            />
          </div>
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 03 · Events that defined the year ─────────────────────────────── */}
        <WrappedSection
          number="03"
          sticker="Signature Events"
          stickerTone="coral"
          heading="The events that defined the year."
          subheading="A curated recap of the moments everyone kept talking about."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {W.signatureEvents.map((event, index) => (
              <div
                key={event.name}
                className={`scrapbook-paper relative p-5 ${index % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right'}`}
              >
                <span className="scrapbook-pin" aria-hidden />
                <div className="text-3xl" aria-hidden>
                  {event.emoji}
                </div>
                <h3 className="mt-2 font-sans text-[18px] font-bold text-text-primary">{event.name}</h3>
                <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7] text-text-secondary">{event.blurb}</p>
              </div>
            ))}
          </div>
          <Link to="/events" className={`mt-6 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider ${LINK_CLASS}`}>
            Relive the full event archive →
          </Link>
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 04 · House Cup ────────────────────────────────────────────────── */}
        <WrappedSection
          number="04"
          sticker="House Cup"
          stickerTone="gold"
          heading="Four houses walked in. One took the cup."
          subheading="A year of check-ins, challenges, and friendly sabotage — settled on the leaderboard."
        >
          <HouseCup houses={houses} />
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 05 · Photo wall ───────────────────────────────────────────────── */}
        <WrappedSection
          number="05"
          sticker="Photo Wall"
          stickerTone="coral"
          heading="Proof it all happened."
          subheading="Straight from the public gallery — the moments we kept."
        >
          <PhotoWall albums={yearAlbums} />
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 06 · Culture highlights ───────────────────────────────────────── */}
        <WrappedSection number="06" sticker="Culture Nights" heading="The stages we filled.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="scrapbook-photo relative overflow-hidden scrapbook-rotate-sm-left">
              {vcnCover && (
                <img
                  src={getSupabaseImageUrl(vcnCover, { width: 800 }) || vcnCover}
                  alt={vcnArchive?.title ? `${vcnArchive.title} cover` : 'VCN cover'}
                  className="h-48 w-full object-cover sm:h-56"
                  loading="lazy"
                />
              )}
              <div className="p-5">
                <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">VCN</span>
                <h3 className="mt-2 font-sans text-[18px] font-bold text-text-primary">
                  {vcnArchive?.theme_name || vcnArchive?.title || W.vcn.fallbackTitle}
                </h3>
                <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7] text-text-secondary">
                  {vcnArchive?.description || W.vcn.fallbackBlurb}
                </p>
                <Link to="/vcn" className={`mt-3 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider ${LINK_CLASS}`}>
                  Visit the VCN archive →
                </Link>
              </div>
            </div>

            <div className="scrapbook-paper relative p-5 scrapbook-rotate-sm-right">
              <span className="scrapbook-pin" aria-hidden />
              <span className="scrapbook-sticker scrapbook-sticker-coral px-2 py-0.5 text-[9px]">WNC</span>
              <h3 className="mt-2 font-sans text-[18px] font-bold text-text-primary">{W.wnc.title}</h3>
              <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7] text-text-secondary">{W.wnc.blurb}</p>
              <Link to="/wild-n-culture" className={`mt-3 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider ${LINK_CLASS}`}>
                Wild n' Culture →
              </Link>
            </div>
          </div>
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 07 · Fun awards ───────────────────────────────────────────────── */}
        <WrappedSection
          number="07"
          sticker="Community Recap Awards"
          stickerTone="gold"
          heading="The completely official, totally unscientific awards."
          subheading="Curated by cabinet from the year's inside jokes — editorial, not analytics."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {W.awards.map((award, index) => (
              <div
                key={award.title}
                className={`scrapbook-note relative border p-5 ${index % 2 === 0 ? 'scrapbook-rotate-sm-right' : 'scrapbook-rotate-sm-left'}`}
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="text-3xl" aria-hidden>
                  {award.emoji}
                </div>
                <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  {award.title}
                </div>
                <div className="mt-1 font-serif text-[24px] font-black leading-tight" style={{ color: 'var(--accent)' }}>
                  {award.winner}
                </div>
                <p className="mt-1.5 font-sans text-[13px] leading-[1.7] text-text-secondary">{award.blurb}</p>
              </div>
            ))}
          </div>

          <div className="scrapbook-paper mt-6 p-5 text-center">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{W.vibe.title}</div>
            <div className={`mt-1 font-serif text-[32px] font-black ${LINK_CLASS}`}>{W.vibe.value}</div>
            <p className="mx-auto mt-1.5 max-w-xl font-sans text-[13.5px] leading-[1.7] text-text-secondary">{W.vibe.blurb}</p>
          </div>
        </WrappedSection>

        <div className="scrapbook-rule" aria-hidden />

        {/* ── 08 · Thank you ────────────────────────────────────────────────── */}
        <WrappedSection
          number="08"
          sticker="Thank You"
          stickerTone="coral"
          heading="Thank you for making this year what it was."
          subheading={
            cabinetYear?.theme_name
              ? `${cabinetYear.label} — theme: ${cabinetYear.theme_name} — and every member behind it.`
              : undefined
          }
        >
          <p className="max-w-2xl font-sans text-[15px] leading-[1.9] text-text-secondary">{W.cabinet.thankYou}</p>
          <Link to="/cabinet" className={`mt-4 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider ${LINK_CLASS}`}>
            Meet the cabinet →
          </Link>
        </WrappedSection>
      </div>

      {/* ── 09 · Closing CTA ─────────────────────────────────────────────────── */}
      <div className="scrapbook-board border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="vsa-container py-16 text-center sm:py-20">
          <h2 className="font-serif text-[36px] font-black tracking-[-0.02em] text-text-primary sm:text-[48px]">
            {W.closing.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-[1.8] text-text-secondary">{W.closing.blurb}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <CtaLink to="/events" label="Upcoming events" />
            <CtaLink to="/house" label="The House system" />
            <CtaLink to="/get-involved" label="Get involved" />
            <CtaLink to={W.closing.instagramUrl} label="@vsaatucsd" external />
          </div>
        </div>
      </div>
    </>
  );
}
