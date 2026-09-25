import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { EVENT_TYPE_LABELS } from "../constants/eventTypes";
import { PageTitle } from "../components/common/PageTitle";
import { Badge, BadgeColor } from "../components/ui/Badge";
import { usePresidentsContent } from "../hooks/usePresidentsContent";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { eventsRepository, PublicEventPreview } from "../data/repos/events";
import { EventInterestButtons } from "../components/features/events/EventInterestButtons";
import { splitPresidentsMessage } from "../data/presidentsContent";
import {
  getSupabaseImageSrcSet,
  getSupabaseImageUrl,
} from "../lib/supabaseImages";
import {
  formatEventDateRange,
  formatEventTime,
  formatEventTimeRange,
} from "../lib/eventTime";
import { ThisWeekInVSA } from "../components/features/home/ThisWeekInVSA";
import { OpenOpportunities } from "../components/features/home/OpenOpportunities";
import { WrappedRecapCard } from "../components/features/home/WrappedRecapCard";
import { type ComponentType, useRef } from "react";
import { type IconBaseProps } from "react-icons";
import { RevealOnScrollWrapper } from "../components/common/RevealOnScrollWrapper";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { DegradedModeBanner } from "../components/common/DegradedModeBanner";
import { FALLBACK_LINKS } from "../config/publicFallbackContent";
import { SplitText } from "../components/ui/SplitText";
import { ThreadsBackground } from "../components/ui/ThreadsBackground";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";
import { cn } from "../lib/utils";

const CalendarIcon = FiCalendar as ComponentType<IconBaseProps>;
const ClockIcon = FiClock as ComponentType<IconBaseProps>;
const MapPinIcon = FiMapPin as ComponentType<IconBaseProps>;

const pillars = [
  {
    n: "01",
    label: "Social",
  },
  {
    n: "02",
    label: "Community",
  },
  {
    n: "03",
    label: "Cultural",
  },
  {
    n: "04",
    label: "Academic",
  },
];

const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: "green",
  mixer: "red",
  vcn: "yellow",
  wildn_culture: "yellow",
  winter_retreat: "red",
  other: "gray",
  external_event: "gray",
};

function getTodayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEventTimeLabel(
  event: Pick<PublicEventPreview, "start_time" | "end_time">,
): string | null {
  if (event.start_time && event.end_time)
    return formatEventTimeRange(event.start_time, event.end_time);
  if (event.start_time) return formatEventTime(event.start_time);
  return null;
}

function UpcomingEventCard({ event }: { event: PublicEventPreview }) {
  const imageUrl = event.thumbnail_url || event.image_url;
  const timeLabel = getEventTimeLabel(event);

  return (
    <article
      className={cn(
        "scrapbook-paper flex min-w-0 flex-col sm:flex-row",
        !imageUrl && "sm:justify-center",
      )}
    >
      {imageUrl && (
        <div className="flex shrink-0 items-center justify-center rounded-t-lg border-b border-border-strong bg-surface2 p-4 sm:w-2/5 sm:rounded-l-lg sm:rounded-tr-none sm:border-b-0 sm:border-r">
          <img
            src={getSupabaseImageUrl(imageUrl, {
              width: 640,
              resize: "contain",
              quality: 80,
            })}
            alt={`${event.name} event poster`}
            className="h-64 w-full object-contain sm:h-72"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start p-5 sm:p-6">
        <Badge
          label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          color={TYPE_COLOR[event.event_type] ?? "gray"}
        />
        <h3 className="mt-3 font-serif text-3xl leading-tight text-text-primary sm:text-4xl">
          {event.name}
        </h3>
        <dl className="my-5 space-y-2 font-sans text-sm text-text-primary">
          <div className="flex items-start gap-2">
            <dt>
              <CalendarIcon className="mt-0.5 shrink-0" aria-hidden />
              <span className="sr-only">Date</span>
            </dt>
            <dd>{formatEventDateRange(event.date, event.end_date)}</dd>
          </div>
          {timeLabel && (
            <div className="flex items-start gap-2">
              <dt>
                <ClockIcon className="mt-0.5 shrink-0" aria-hidden />
                <span className="sr-only">Time</span>
              </dt>
              <dd>{timeLabel}</dd>
            </div>
          )}
          {event.location && (
            <div className="flex items-start gap-2">
              <dt>
                <MapPinIcon className="mt-0.5 shrink-0" aria-hidden />
                <span className="sr-only">Location</span>
              </dt>
              <dd>{event.location}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-4">
          <Link
            to="/events"
            aria-label={`View details for ${event.name}`}
            className="inline-flex min-h-[44px] items-center gap-2 font-sans text-sm font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-400"
          >
            Event details <span aria-hidden>→</span>
          </Link>
          {event.points > 0 && (
            <span className="font-mono text-xs text-text-primary">
              {event.points} {event.points === 1 ? "point" : "points"}
            </span>
          )}
        </div>
        <div className="mt-3 w-full">
          <EventInterestButtons
            eventId={event.id}
            initialCounts={event.interest_counts ?? null}
            compact
          />
        </div>
      </div>
    </article>
  );
}

export function Home() {
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  // Scoped to the hero element (not whole-page scroll) -- progress 0 when the
  // hero's top hits the viewport top, 1 when its bottom does. No pinning: the
  // hero occupies exactly the same scroll distance as before, this just
  // derives a value from scrolling past it.
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroBgY = useTransform(heroScrollProgress, [0, 1], [0, -60]);
  const heroContentOpacity = useTransform(heroScrollProgress, [0, 0.8], [1, 0]);
  // Only hold the compositor-layer promotion while the hero is in/approaching
  // view; release it (-> "auto") once the hero has scrolled past so we don't
  // retain two full-viewport GPU textures for the whole page lifetime. These
  // are MotionValues, so they only write to the DOM when the string actually
  // changes (once each way at the boundary), not on every scroll frame.
  const heroBgWillChange = useTransform(heroScrollProgress, (p) =>
    p < 1 ? "transform" : "auto",
  );
  const heroContentWillChange = useTransform(heroScrollProgress, (p) =>
    p < 0.8 ? "opacity" : "auto",
  );
  const { content: presidentsContent } = usePresidentsContent();
  const { settings: siteSettings } = useSiteSettings();
  const today = getTodayDateOnly();
  const { data: upcomingEvents = [], isError: eventsError } = useQuery<
    PublicEventPreview[]
  >({
    queryKey: ["home", "upcoming-events-section", today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 4),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const logoSrc =
    siteSettings.logoUrl ||
    `${process.env.PUBLIC_URL || ""}/images/vsa-logo.jpg`;
  const presidentParagraphs = splitPresidentsMessage(presidentsContent.message);
  const [presidentsHeading, ...presidentsBody] = presidentParagraphs;
  const possibleSignature = presidentsBody[presidentsBody.length - 1];
  const signatureLines =
    possibleSignature
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const hasSignatureBlock =
    signatureLines.length >= 2 &&
    signatureLines[0].toLowerCase().startsWith("with love");
  const presidentBodyParagraphs = hasSignatureBlock
    ? presidentsBody.slice(0, -1)
    : presidentsBody;
  const signatureName = presidentsContent.names;
  const signatureRole = presidentsContent.role;
  const presidentsPhotoUrl =
    presidentsContent.photoThumbnailUrl || presidentsContent.photoUrl;

  const featured = upcomingEvents[0];
  return (
    <>
      <PageTitle title="Home" />
      {eventsError && <DegradedModeBanner sourceName="events" />}

      <section
        ref={heroRef}
        className="scrapbook-board relative flex min-h-[calc(100vh-60px)] items-center justify-center overflow-hidden pt-12 sm:pt-16"
      >
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            y: shouldReduceMotion ? 0 : heroBgY,
            // Promote to its own compositor layer so the scroll-linked parallax
            // translate runs on the GPU instead of repainting the large
            // ThreadsBackground SVG + mix-blend tape on every scroll frame.
            // Released to "auto" once the hero is out of view (see above).
            willChange: shouldReduceMotion ? undefined : heroBgWillChange,
          }}
        >
          <ThreadsBackground reducedMotion={Boolean(shouldReduceMotion)} />
          {/* Tape accent for the whole board */}
          <div
            className="absolute top-6 left-1/4 right-1/4 h-6 opacity-40 mix-blend-multiply dark:mix-blend-screen pointer-events-none z-20"
            style={{
              background:
                "repeating-linear-gradient(-45deg, var(--tape-gold) 0 10px, rgba(255,255,255,0.1) 10px 14px)",
              transform: "rotate(-0.5deg)",
              borderRadius: "2px",
            }}
          />
        </motion.div>

        <motion.div
          className="vsa-container relative z-10 w-full"
          style={{
            opacity: shouldReduceMotion ? 1 : heroContentOpacity,
            // Promote to its own compositor layer so the scroll-linked fade is a
            // GPU alpha composite on a cached texture, not a per-frame
            // group-opacity re-render of the entire foreground subtree.
            // Released to "auto" once the content has fully faded (see above).
            willChange: shouldReduceMotion ? undefined : heroContentWillChange,
          }}
        >
          <div className="grid min-h-[calc(100vh-60px)] items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
            <div className="relative mx-auto mb-[-1.5rem] w-[min(210px,58vw)] rotate-[3deg] lg:hidden">
              <div
                className="scrapbook-photo overflow-hidden rounded-lg shadow-[0_18px_42px_rgba(15,23,42,0.24)]"
                style={{
                  animation: shouldReduceMotion
                    ? "none"
                    : "vsa-float 7s ease-in-out infinite",
                }}
              >
                <img
                  src={logoSrc}
                  alt="VSA at UC San Diego lantern artwork"
                  className="aspect-square w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <div className="scrapbook-tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-[-2deg] opacity-70" />
            </div>
            <div className="scrapbook-paper flex flex-col justify-center p-6 sm:p-8 lg:p-10 scrapbook-rotate-sm-left">
              <span className="scrapbook-pin" aria-hidden />
              <div
                className="vsa-animate-slide-up mb-6 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--text3)" }}
              >
                <span className="h-[1.5px] w-8 bg-[var(--brand)]" />
                Vietnamese Student Association / UC San Diego
              </div>
              <h1
                className="vsa-animate-slide-up vsa-delay-1 font-serif text-[clamp(52px,8vw,82px)] leading-[0.9] tracking-[-0.03em]"
                style={{ color: "var(--text)" }}
              >
                <SplitText
                  text="Culture,"
                  disabled={Boolean(shouldReduceMotion)}
                  stagger={0.032}
                />
                <br />
                <span className="italic" style={{ color: "var(--brand)" }}>
                  <SplitText
                    text="Community."
                    disabled={Boolean(shouldReduceMotion)}
                    delay={0.18}
                    stagger={0.028}
                  />
                </span>
              </h1>
              <p
                className="vsa-animate-slide-up vsa-delay-2 mt-7 max-w-[400px] font-sans text-[15px] leading-[1.8]"
                style={{ color: "var(--text2)" }}
              >
                A Vietnamese cultural and social community at UC San Diego since
                1977.
              </p>
              <div className="vsa-animate-slide-up vsa-delay-3 mt-10 flex flex-wrap gap-3">
                <Link to="/get-involved" className="vsa-btn-primary">
                  Join VSA
                </Link>
                <Link to="/events" className="vsa-btn-ghost">
                  View Events -&gt;
                </Link>
              </div>

              <div className="vsa-animate-fade-in vsa-delay-4 mt-12">
                <div
                  className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--text3)" }}
                >
                  VSA Pillars
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {pillars.map((pillar, idx) => (
                    <motion.div
                      key={pillar.label}
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 12 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { delay: 0.45 + idx * 0.08 }
                      }
                      whileHover={
                        shouldReduceMotion ? undefined : { y: -4, scale: 1.02 }
                      }
                      className={`scrapbook-note flex min-h-[76px] flex-col justify-center gap-1 px-4 py-3 ${idx % 2 === 0 ? "scrapbook-rotate-sm-left" : "scrapbook-rotate-sm-right"}`}
                    >
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: "var(--accent)" }}
                      >
                        {pillar.n}
                      </span>
                      <span
                        className="font-sans text-[13px] font-semibold leading-none"
                        style={{ color: "var(--text)" }}
                      >
                        {pillar.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div
                className="vsa-animate-fade-in vsa-delay-4 mt-8 flex gap-8 border-t pt-8"
                style={{ borderColor: "var(--border)" }}
              >
                {[
                  ["1977", "Est."],
                  ["500+", "Members"],
                  ["20+", "Events/Year"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div
                      className="font-serif text-[32px] leading-none"
                      style={{ color: "var(--text)" }}
                    >
                      {value}
                    </div>
                    <div
                      className="mt-1 font-sans text-[11px] tracking-[0.04em]"
                      style={{ color: "var(--text3)" }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[340px] flex-col items-center justify-center py-8 lg:flex lg:p-10">
              <div
                className="scrapbook-photo relative aspect-square w-[min(360px,80%)] rotate-[2deg]"
                style={{
                  animation: shouldReduceMotion
                    ? "none"
                    : "vsa-float 7s ease-in-out infinite",
                }}
              >
                <img
                  src={getSupabaseImageUrl(logoSrc, {
                    width: 420,
                    height: 420,
                    resize: "contain",
                    quality: 78,
                  })}
                  srcSet={getSupabaseImageSrcSet(logoSrc, [240, 420, 720], {
                    resize: "contain",
                    quality: 78,
                  })}
                  sizes="(min-width: 1024px) 360px, 80vw"
                  alt={siteSettings.logoAlt || "VSA logo lantern"}
                  className="h-full w-full object-contain"
                  decoding="async"
                />
              </div>
              <p className="scrapbook-sticker scrapbook-sticker-gold mt-8 text-center scrapbook-rotate-sm-right">
                Est. 1977 / Nonprofit / Open to all UCSD students
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      <ThisWeekInVSA />

      <RevealOnScrollWrapper>
        <section className="py-12 sm:py-16 bg-[var(--surface2)]">
          <div className="vsa-container">
            <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10 lg:p-12 scrapbook-rotate-sm-right">
              <span className="scrapbook-pin" aria-hidden />
              <div className="grid gap-10 lg:grid-cols-[1fr_0.5fr] lg:items-center">
                <div>
                  <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">
                    Start Your Journey
                  </span>
                  <h2 className="vsa-section-title mb-6">
                    New to VSA?
                    <br />
                    <span className="italic" style={{ color: "var(--brand)" }}>
                      Begin here.
                    </span>
                  </h2>
                  <p
                    className="max-w-xl font-sans text-base leading-relaxed"
                    style={{ color: "var(--text2)" }}
                  >
                    We've put together a friendly "Passport" checklist to help
                    you navigate our programs, meet new people, and make the
                    most of your time with us.
                  </p>
                  <div className="mt-8">
                    <Link to="/get-involved" className="vsa-btn-primary">
                      View the Checklist -&gt;
                    </Link>
                  </div>
                </div>
                <div className="relative hidden lg:block">
                  <div className="scrapbook-note rotate-[-2deg] p-6 text-center shadow-lg">
                    <div
                      className="mb-2 font-serif text-3xl"
                      style={{ color: "var(--brand)" }}
                    >
                      8
                    </div>
                    <div
                      className="font-sans text-xs font-bold uppercase tracking-widest"
                      style={{ color: "var(--text3)" }}
                    >
                      Ways to Connect
                    </div>
                  </div>
                  <div className="absolute -bottom-4 -right-4 scrapbook-note rotate-[4deg] p-4 text-center shadow-md">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mx-auto h-6 w-6 text-green-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </RevealOnScrollWrapper>

      <RevealOnScrollWrapper>
        <OpenOpportunities compact />
      </RevealOnScrollWrapper>

      <RevealOnScrollWrapper>
        <section className="vsa-section scrapbook-board">
          <div className="vsa-container">
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <div className="vsa-section-label">Events</div>
                  <h2 className="vsa-section-title">
                    Upcoming <em>events.</em>
                  </h2>
                  <p className="mt-3 max-w-md font-sans text-base text-text-primary">
                    Make room for your next VSA memory.
                  </p>
                </div>
                <div>
                  <Link to="/events" className="vsa-btn-primary">
                    See All Events
                  </Link>
                </div>
              </div>
              <div>
                {eventsError ? (
                  <div
                    className="scrapbook-empty font-sans text-sm scrapbook-rotate-sm-right space-y-3"
                    style={{ color: "var(--text3)" }}
                  >
                    <p
                      className="font-serif text-lg leading-tight"
                      style={{ color: "var(--text)" }}
                    >
                      Events are temporarily unavailable
                    </p>
                    <p className="font-sans text-sm leading-relaxed">
                      Check{" "}
                      <a
                        href={FALLBACK_LINKS.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                        style={{ color: "var(--brand)" }}
                      >
                        Instagram
                      </a>{" "}
                      or{" "}
                      <a
                        href={FALLBACK_LINKS.linktree}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                        style={{ color: "var(--brand)" }}
                      >
                        Linktree
                      </a>{" "}
                      for the latest updates.
                    </p>
                    <Link
                      to="/events"
                      className="font-mono text-[11px] uppercase tracking-wider"
                      style={{ color: "var(--brand)" }}
                    >
                      View events page
                    </Link>
                  </div>
                ) : !featured ? (
                  <div
                    className="scrapbook-empty font-sans text-sm scrapbook-rotate-sm-right"
                    style={{ color: "var(--text3)" }}
                  >
                    <p>No upcoming events posted yet.</p>
                    <Link
                      to="/events#memory-wall"
                      className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-wider"
                      style={{ color: "var(--brand)" }}
                    >
                      View past events
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-6 xl:grid-cols-2">
                    {upcomingEvents.slice(0, 3).map((event) => (
                      <UpcomingEventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </RevealOnScrollWrapper>

      <RevealOnScrollWrapper>
        <section className="vsa-message-section scrapbook-board">
          <div className="vsa-container">
            <div className="grid gap-12 lg:grid-cols-[1fr_240px] lg:items-start">
              <div className="scrapbook-paper p-6 sm:p-8 scrapbook-rotate-sm-left">
                <span className="scrapbook-pin" aria-hidden />
                <div className="vsa-section-label">Presidents</div>
                <h2 className="vsa-section-title max-w-[720px]">
                  {presidentsHeading}
                </h2>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  {presidentBodyParagraphs.map((paragraph, index) => (
                    <p
                      key={`${paragraph.slice(0, 24)}-${index}`}
                      className="whitespace-pre-line font-sans text-sm leading-[1.9]"
                      style={{ color: "var(--text2)" }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                {hasSignatureBlock && (
                  <div
                    className="mt-7 border-t pt-5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="font-sans text-sm"
                      style={{ color: "var(--text3)" }}
                    >
                      {signatureLines[0]}
                    </div>
                    <div
                      className="mt-1 font-serif text-xl italic"
                      style={{ color: "var(--accent)" }}
                    >
                      {signatureName}
                    </div>
                    <div
                      className="mt-1 font-sans text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--text3)" }}
                    >
                      {signatureRole}
                    </div>
                  </div>
                )}
              </div>
              <div>
                {presidentsPhotoUrl ? (
                  <div className="scrapbook-photo rotate-[1.5deg]">
                    <img
                      src={getSupabaseImageUrl(presidentsPhotoUrl, {
                        width: 440,
                        height: 586,
                        resize: "cover",
                        quality: 74,
                      })}
                      srcSet={getSupabaseImageSrcSet(
                        presidentsPhotoUrl,
                        [320, 440, 640],
                        {
                          resize: "cover",
                          quality: 74,
                        },
                      )}
                      sizes="(min-width: 1024px) 220px, 70vw"
                      alt={presidentsContent.names}
                      className="aspect-[3/4] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="scrapbook-photo flex aspect-[3/4] items-center justify-center">
                    <span
                      className="font-serif text-[28px] italic"
                      style={{ color: "var(--text3)" }}
                    >
                      A + H
                    </span>
                  </div>
                )}
                <div
                  className="mt-3 border-t py-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="font-sans text-sm font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {presidentsContent.names}
                  </div>
                  <div
                    className="mt-1 font-sans text-[11px] uppercase tracking-[0.07em]"
                    style={{ color: "var(--text3)" }}
                  >
                    {presidentsContent.role}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </RevealOnScrollWrapper>

      <RevealOnScrollWrapper>
        <WrappedRecapCard />
      </RevealOnScrollWrapper>
    </>
  );
}
