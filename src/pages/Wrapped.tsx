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
import { toDateOnlyString } from '../lib/dateOnly';
import { getSupabaseImageUrl } from '../lib/supabaseImages';

// Aggregate-only data. This page intentionally never queries member-level
// tables/views (yearly member leaderboard, attendance rows, rankings) — see
// docs/vsa-wrapped.md for the privacy rules.
const QUERY_OPTIONS = { staleTime: 10 * 60 * 1000, retry: 1 } as const;

const W = WRAPPED_2026;

function CtaLink({ to, label, external = false }: { to: string; label: string; external?: boolean }) {
  const className =
    'inline-flex items-center justify-center rounded-lg border px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.05em] transition-colors duration-150 hover:bg-[var(--surface2)]';
  const style = { borderColor: 'var(--color-border-strong)', color: 'var(--text)' };
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={className} style={style}>
      {label}
    </Link>
  );
}

export function Wrapped() {
  const shouldReduceMotion = useReducedMotion();

  const eventsQuery = useQuery(
    ['wrapped-events', W.windowStart, W.windowEnd],
    () => eventsRepository.getEvents({ date_from: W.windowStart, date_to: W.windowEnd, limit: 400 }),
    QUERY_OPTIONS
  );
  const albumsQuery = useQuery(
    ['wrapped-albums'],
    () => galleryRepository.getAlbums({ limit: 60 }),
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

  const yearAlbums = useMemo(() => {
    const albums = albumsQuery.data ?? [];
    const inYear = albums.filter((album) => {
      const day = toDateOnlyString(album.date);
      return day >= W.windowStart && day <= W.windowEnd;
    });
    return inYear.length > 0 ? inYear : albums;
  }, [albumsQuery.data]);

  const albumCount = useMemo(() => {
    const albums = albumsQuery.data ?? [];
    const count = albums.filter((album) => {
      const day = toDateOnlyString(album.date);
      return day >= W.windowStart && day <= W.windowEnd;
    }).length;
    return count > 0 ? count : null;
  }, [albumsQuery.data]);

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
            <h1
              className="mx-auto mt-6 max-w-3xl font-serif text-[52px] font-black leading-[0.95] tracking-[-0.03em] sm:text-[84px]"
              style={{ color: 'var(--text)' }}
            >
              VSA <span className="italic" style={{ color: 'var(--brand)' }}>Wrapped</span>
            </h1>
            <p className="mt-3 font-mono text-[13px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
              {W.yearLabel}
            </p>
            <p className="mx-auto mt-5 max-w-xl font-sans text-[16px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
              {W.hero.tagline}
            </p>
            <a
              href="#numbers"
              className="mt-8 inline-flex items-center gap-2 rounded-full border px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-[var(--surface2)]"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--text)' }}
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
                <h3 className="mt-2 font-sans text-[18px] font-bold" style={{ color: 'var(--text)' }}>
                  {event.name}
                </h3>
                <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
                  {event.blurb}
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/events"
            className="mt-6 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand)' }}
          >
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
        <WrappedSection
          number="06"
          sticker="Culture Nights"
          heading="The stages we filled."
        >
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
                <h3 className="mt-2 font-sans text-[18px] font-bold" style={{ color: 'var(--text)' }}>
                  {vcnArchive?.theme_name || vcnArchive?.title || W.vcn.fallbackTitle}
                </h3>
                <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
                  {vcnArchive?.description || W.vcn.fallbackBlurb}
                </p>
                <Link
                  to="/vcn"
                  className="mt-3 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--brand)' }}
                >
                  Visit the VCN archive →
                </Link>
              </div>
            </div>

            <div className="scrapbook-paper relative p-5 scrapbook-rotate-sm-right">
              <span className="scrapbook-pin" aria-hidden />
              <span className="scrapbook-sticker scrapbook-sticker-coral px-2 py-0.5 text-[9px]">WNC</span>
              <h3 className="mt-2 font-sans text-[18px] font-bold" style={{ color: 'var(--text)' }}>
                {W.wnc.title}
              </h3>
              <p className="mt-1.5 font-sans text-[13.5px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
                {W.wnc.blurb}
              </p>
              <Link
                to="/wild-n-culture"
                className="mt-3 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--brand)' }}
              >
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
                <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
                  {award.title}
                </div>
                <div className="mt-1 font-serif text-[24px] font-black leading-tight" style={{ color: 'var(--accent)' }}>
                  {award.winner}
                </div>
                <p className="mt-1.5 font-sans text-[13px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
                  {award.blurb}
                </p>
              </div>
            ))}
          </div>

          <div className="scrapbook-paper mt-6 p-5 text-center">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
              {W.vibe.title}
            </div>
            <div className="mt-1 font-serif text-[32px] font-black" style={{ color: 'var(--brand)' }}>
              {W.vibe.value}
            </div>
            <p className="mx-auto mt-1.5 max-w-xl font-sans text-[13.5px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
              {W.vibe.blurb}
            </p>
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
          <p className="max-w-2xl font-sans text-[15px] leading-[1.9]" style={{ color: 'var(--text2)' }}>
            {W.cabinet.thankYou}
          </p>
          <Link
            to="/cabinet"
            className="mt-4 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand)' }}
          >
            Meet the cabinet →
          </Link>
        </WrappedSection>
      </div>

      {/* ── 09 · Closing CTA ─────────────────────────────────────────────────── */}
      <div className="scrapbook-board border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="vsa-container py-16 text-center sm:py-20">
          <h2 className="font-serif text-[36px] font-black tracking-[-0.02em] sm:text-[48px]" style={{ color: 'var(--text)' }}>
            {W.closing.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            {W.closing.blurb}
          </p>
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
