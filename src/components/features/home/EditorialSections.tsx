import { type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { type IconBaseProps } from "react-icons";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";
import { OptimizedImage } from "../../common/OptimizedImage";
import { EventInterestButtons } from "../events/EventInterestButtons";
import { Skeleton } from "../../ui/Skeleton";
import {
  EditorialArrow as Arrow,
  Eyebrow,
  SectionHeading,
  editorialDisplay as editorialFont,
  editorialLinkClass,
} from "../../ui/Editorial";
import { FALLBACK_LINKS } from "../../../config/publicFallbackContent";
import { galleryRepository } from "../../../data/repos/gallery";
import { type PublicEventPreview } from "../../../data/repos/events";
import { getAcademicYearStart } from "../../../lib/academicTerms";
import { OFFICIAL_LOGO } from "../../../config/brandAssets";
import {
  formatEventDateRange,
  formatEventTime,
  formatEventTimeRange,
} from "../../../lib/eventTime";

/** "2026—27", derived from the calendar so it rolls over without a code edit. */
function academicYearCaption(date = new Date()): string {
  const start = getAcademicYearStart(date);
  return `${start}—${String(start + 1).slice(-2)}`;
}

const CalendarIcon = FiCalendar as ComponentType<IconBaseProps>;
const ClockIcon = FiClock as ComponentType<IconBaseProps>;
const MapPinIcon = FiMapPin as ComponentType<IconBaseProps>;

const archivePhotos = {
  fallGbm: "/images/gallery/fall-26-gbm-1_2026-09-30.webp",
  cultureNight: "/images/gallery/vietnamese-culture-night-2026_2026-04-18.webp",
};

// The VCN Polaroid never renders wider than ~350px, so the 720px rendition
// covers 2x screens and saves ~57KB over the 1200px original.
const cultureNightThumb = {
  src: "/images/gallery/vietnamese-culture-night-2026_2026-04-18_thumb.webp",
  width: 720,
};


export function EditorialHero({
  logoSrc,
  logoAlt,
}: {
  logoSrc: string;
  logoAlt: string;
}) {
  const isOfficialLogo = logoSrc === OFFICIAL_LOGO.src;
  return (
    <section className="home-editorial-hero home-editorial-grain relative isolate min-h-[640px] overflow-hidden text-white lg:min-h-[max(740px,calc(100svh-60px))]">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <OptimizedImage
          src={archivePhotos.fallGbm}
          width={1400}
          height={900}
          sizes="100vw"
          alt=""
          className="h-full w-full object-cover opacity-[0.17] mix-blend-soft-light"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[43%] h-[17%] border-y border-white/10 bg-indigo-950/25"
      />
      <div
        aria-hidden="true"
        className="home-editorial-bubble pointer-events-none absolute -right-[13vw] -top-[12vw] h-[40vw] w-[40vw]"
      />
      <div
        aria-hidden="true"
        className="home-editorial-bubble pointer-events-none absolute -bottom-[8vw] left-[44%] h-[18vw] w-[18vw]"
      />
      <div
        aria-hidden="true"
        className="home-editorial-bubble pointer-events-none absolute bottom-[8%] right-[3%] h-[8vw] w-[8vw]"
      />
      <span
        aria-hidden="true"
        className="absolute left-[80%] top-[17%] text-[2.8rem] text-white [text-shadow:0_0_20px_#fff] sm:left-[55%] sm:top-[9%] sm:text-6xl lg:left-[43%] lg:text-[4rem]"
      >
        ✦
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-[8%] right-[4%] hidden text-4xl text-white lg:block"
      >
        ✧
      </span>

      <div className="relative z-10 mx-auto grid w-full max-w-[1520px] grid-cols-1 items-center gap-10 px-5 pb-10 pt-[92px] sm:px-10 sm:pt-28 lg:min-h-[max(740px,calc(100svh-60px))] lg:grid-cols-[52%_48%] lg:gap-0 lg:px-[4vw] lg:py-[clamp(3rem,7vw,7.5rem)]">
        <div className="relative z-20 min-w-0 lg:pr-0">
          <Eyebrow className="mb-6 text-white [text-shadow:0_1px_14px_rgba(20,35,86,0.45)]">
            Vietnamese Student Association · UC San Diego
          </Eyebrow>
          <h1
            className={`${editorialFont} relative w-max max-w-full text-[clamp(4.25rem,18vw,8rem)] leading-[0.78] drop-shadow-[0_4px_24px_rgba(20,35,86,0.22)] lg:text-[clamp(5rem,11vw,10.5rem)] lg:leading-[0.72]`}
          >
            Culture,
            <br />
            <em className="relative font-normal">Community.</em>
          </h1>
          <p aria-hidden="true" className="ml-auto mt-8 w-max font-mono text-[10px] font-semibold tracking-[0.18em] sm:mr-[12%] lg:mr-[14%]">
            {academicYearCaption()}
          </p>
          <p className="mb-7 mt-8 max-w-[20rem] text-[15px] leading-[1.7] sm:mt-12 sm:max-w-[27rem] sm:text-[17px] lg:ml-[5.5rem]">
            A Vietnamese cultural and social community at UC San Diego since
            1977.
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6 lg:ml-[5.5rem]">
            <Link
              to="/get-involved"
              className="inline-flex min-h-12 items-center gap-10 bg-white px-5 py-3 text-[13px] font-semibold text-figma-ink shadow-[0_8px_30px_rgba(21,34,74,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none"
            >
              Join VSA <Arrow />
            </Link>
            <a
              href="#upcoming-events"
              className="inline-flex min-h-12 items-center gap-10 border-b border-white/70 px-1 py-3 text-[13px] font-semibold transition-colors hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              View Events <Arrow direction="down" />
            </a>
          </div>
        </div>

        <div
          className="relative z-10 mx-auto mt-2 h-[410px] w-full max-w-[560px] sm:h-[530px] lg:mt-0 lg:h-[620px] lg:max-w-none"
          aria-label="VSA community photography"
        >
          <figure className="home-editorial-polaroid absolute left-0 top-[1%] h-[57%] w-[78%] -rotate-[2deg] p-2 pb-8 sm:left-[3%] sm:h-[62%] sm:w-[68%] sm:pb-10">
            <OptimizedImage
              src={archivePhotos.fallGbm}
              width={740}
              height={600}
              priority
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 460px, 75vw"
              alt="VSA members together at Fall 2026 GBM 1"
              className="h-full w-full object-cover"
            />
            <figcaption className="mt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
              Fall ’26 / GBM 01
            </figcaption>
          </figure>
          <figure className="home-editorial-polaroid absolute bottom-[2%] right-0 z-20 h-[49%] w-[64%] rotate-[3deg] p-2 pb-8 sm:-right-[2%] sm:h-[50%] sm:w-[52%] sm:pb-10">
            <OptimizedImage
              src={archivePhotos.cultureNight}
              srcWidth={1200}
              lowRes={cultureNightThumb}
              width={640}
              height={500}
              sizes="(min-width: 1024px) 350px, (min-width: 640px) 360px, 65vw"
              alt="Performers at Vietnamese Culture Night 2026"
              className="h-full w-full object-cover"
            />
            <figcaption className="mt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
              VCN / 2026
            </figcaption>
          </figure>
          <div className="absolute right-0 top-[2%] z-30 h-[104px] w-[104px] rotate-[2deg] border border-white/60 bg-white/20 p-1.5 shadow-[0_18px_45px_rgba(26,38,86,0.3)] backdrop-blur-md sm:right-[1%] sm:top-[4%] sm:h-[140px] sm:w-[140px] lg:h-[154px] lg:w-[154px]">
            <OptimizedImage
              src={logoSrc}
              srcWidth={isOfficialLogo ? OFFICIAL_LOGO.width : undefined}
              lowRes={isOfficialLogo ? OFFICIAL_LOGO.small : null}
              width={200}
              height={200}
              resize="contain"
              priority
              sizes="(min-width: 640px) 154px, 104px"
              alt={logoAlt}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
      <p
        aria-hidden="true"
        className="absolute right-[4vw] top-8 hidden text-right font-mono text-[10px] leading-[1.6] tracking-[0.1em] sm:block"
      >
        {academicYearCaption()}
        <br />
        San Diego, CA
      </p>
    </section>
  );
}

export function EditorialPillars() {
  return (
    <div
      aria-label="VSA pillars"
      className="flex min-h-[72px] items-center justify-start gap-8 overflow-hidden border-y border-ed-line bg-ed-paper px-5 sm:justify-around sm:gap-0 sm:px-[4vw]"
    >
      {["Social", "Community", "Cultural", "Academic"].map((pillar) => (
        <span
          key={pillar}
          className={`${editorialFont} flex shrink-0 items-center whitespace-nowrap text-[clamp(1.2rem,2vw,1.9rem)] text-ed-ink`}
        >
          {pillar}
          <span
            aria-hidden="true"
            className="home-editorial-star ml-[3vw] hidden text-[0.7em] sm:inline"
          >
            ✦
          </span>
        </span>
      ))}
    </div>
  );
}

function getEventTimeLabel(event: PublicEventPreview): string | null {
  if (event.start_time && event.end_time)
    return formatEventTimeRange(event.start_time, event.end_time);
  if (event.start_time) return formatEventTime(event.start_time);
  return null;
}

function EditorialEventRow({
  event,
  index,
}: {
  event: PublicEventPreview;
  index: number;
}) {
  const image = event.thumbnail_url || event.image_url;
  const time = getEventTimeLabel(event);
  return (
    <article className="home-editorial-event grid min-w-0 grid-cols-[1.5rem_28%_minmax(0,1fr)] items-center gap-x-3 gap-y-4 border-b border-ed-line py-6 sm:grid-cols-[2.5rem_26%_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[7%_19%_minmax(0,1fr)_auto] lg:gap-x-[clamp(1rem,3vw,3rem)] lg:py-8">
      <span
        aria-hidden="true"
        className="self-start pt-1 font-mono text-[10.5px] text-ed-muted sm:self-center sm:pt-0"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      {/* Figma crops flyers to 4:3. Real flyers are portrait posters, so the
          poster is contained over a blurred fill of itself (same cached URL). */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface2">
        {image ? (
          <>
            <OptimizedImage
              src={image}
              width={360}
              height={270}
              sizes="(min-width: 1024px) 19vw, 28vw"
              widths={[360]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
            />
            <OptimizedImage
              src={image}
              width={360}
              height={270}
              sizes="(min-width: 1024px) 19vw, 28vw"
              widths={[360, 540]}
              resize="contain"
              alt={`${event.name} flyer`}
              className="home-editorial-flyer relative h-full w-full object-contain"
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className={`${editorialFont} flex h-full w-full items-center justify-center text-3xl text-ed-muted`}
          >
            VSA
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ed-muted">
          {formatEventDateRange(event.date, event.end_date, event.start_time)}
        </p>
        <h3
          className={`${editorialFont} my-1.5 text-[clamp(1.45rem,3.3vw,4rem)] leading-none text-ed-ink sm:my-2.5`}
        >
          {event.name}
        </h3>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ed-muted sm:text-[13px]">
          {time && (
            <div className="flex items-center gap-1.5">
              <dt>
                <ClockIcon aria-hidden="true" />
                <span className="sr-only">Time</span>
              </dt>
              <dd>{time}</dd>
            </div>
          )}
          {event.location && (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt>
                <MapPinIcon aria-hidden="true" />
                <span className="sr-only">Location</span>
              </dt>
              <dd className="min-w-0 truncate">{event.location}</dd>
            </div>
          )}
          {event.points > 0 && (
            <div className="flex items-center gap-1.5">
              <dt>
                <CalendarIcon aria-hidden="true" />
                <span className="sr-only">Points</span>
              </dt>
              <dd>
                {event.points} {event.points === 1 ? "point" : "points"}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:col-start-3 lg:row-start-2 lg:-mt-2">
        <div className="max-w-lg">
          <EventInterestButtons
            eventId={event.id}
            initialCounts={event.interest_counts ?? null}
            compact
          />
        </div>
        <Link
          to={`/events#event-${event.id}`}
          aria-label={`Event details for ${event.name}`}
          className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-ed-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ed-ink lg:hidden"
        >
          Event details <Arrow />
        </Link>
      </div>
      <Link
        to={`/events#event-${event.id}`}
        aria-label={`Event details for ${event.name}`}
        className="hidden h-[50px] w-[50px] items-center justify-center rounded-full border border-ed-line text-2xl text-ed-ink transition-colors hover:border-ed-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:inline-flex"
      >
        <Arrow />
      </Link>
    </article>
  );
}

export function EditorialEvents({
  events,
  isLoading,
  isError,
}: {
  events: PublicEventPreview[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section
      id="upcoming-events"
      aria-labelledby="upcoming-events-title"
      className="relative overflow-hidden bg-ed-paper px-5 py-[5.5rem] text-ed-ink sm:px-[6vw] sm:py-[clamp(5rem,10vw,10rem)]"
    >
      <div
        aria-hidden="true"
        className="home-editorial-event-dots pointer-events-none absolute -right-[7vw] top-[3vw] h-[30vw] w-[30vw] opacity-100"
      />
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading
          id="upcoming-events-title"
          eyebrow="On the calendar"
          title="Upcoming"
          accent="Events"
          action={
            <Link to="/events" className={editorialLinkClass()}>
              View all events <Arrow />
            </Link>
          }
        />
        {isError ? (
          <div className="space-y-3 py-10 text-sm text-ed-ink">
            <p className={`${editorialFont} text-3xl`}>
              Events are temporarily unavailable
            </p>
            <p className="text-text-secondary">
              Check{" "}
              <a
                href={FALLBACK_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Instagram
              </a>{" "}
              or{" "}
              <a
                href={FALLBACK_LINKS.linktree}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Linktree
              </a>{" "}
              for the latest updates.
            </p>
            <Link to="/events" className={editorialLinkClass()}>
              View events page <Arrow />
            </Link>
          </div>
        ) : isLoading ? (
          <div role="status" aria-live="polite" className="space-y-6 py-9">
            <span className="sr-only">Loading upcoming events…</span>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-32 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="space-y-3 py-10 text-sm text-ed-ink">
            <p className={`${editorialFont} text-3xl`}>
              No upcoming events posted yet.
            </p>
            <Link to="/events#memory-wall" className={editorialLinkClass()}>
              View past events <Arrow />
            </Link>
          </div>
        ) : (
          <div>
            {events.slice(0, 3).map((event, index) => (
              <EditorialEventRow key={event.id} event={event} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function EditorialAbout() {
  return (
    <section
      id="about-vsa"
      aria-labelledby="about-vsa-title"
      className="home-editorial-about relative grid items-center gap-12 overflow-hidden px-5 py-[5.5rem] sm:px-[6vw] sm:py-[clamp(5rem,10vw,10rem)] lg:grid-cols-[42%_58%] lg:gap-0"
    >
      <div
        aria-hidden="true"
        className="home-editorial-orb mx-auto flex aspect-square w-[70%] max-w-[420px] items-center justify-center rounded-full sm:w-[55%] lg:mx-0 lg:w-[75%] lg:max-w-[460px]"
      >
        <span
          className={`${editorialFont} text-[clamp(4rem,8vw,8rem)] italic text-white [text-shadow:0_2px_20px_rgba(40,53,77,0.18)]`}
        >
          ’77
        </span>
      </div>
      <div className="relative z-10 min-w-0">
        <Eyebrow className="text-figma-ink">About VSA</Eyebrow>
        <h2
          id="about-vsa-title"
          className={`${editorialFont} my-5 text-[clamp(3.25rem,7vw,7.5rem)] leading-[0.86] text-figma-ink`}
        >
          Vietnamese Student
          <br className="hidden sm:block" /> Association{" "}
          <em className="font-normal text-figma-accent">at UCSD</em>
        </h2>
        <p className="my-8 max-w-[42rem] text-[15px] leading-[1.8] text-figma-ink sm:my-10">
          VSA at UC San Diego is a cultural and social student organization
          established in 1977. Our programming includes general body meetings,
          cultural events, community programs, and academic support.
        </p>
        <Link
          to="/get-involved"
          className="inline-flex min-h-11 items-center gap-4 border-b border-figma-ink text-[13px] font-semibold text-figma-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-figma-ink"
        >
          Learn about VSA <Arrow />
        </Link>
      </div>
    </section>
  );
}

const galleryPlacements = [
  "lg:left-[2%] lg:top-[3%] lg:h-[42%] lg:w-[32%] lg:-rotate-3",
  "lg:left-[30%] lg:top-[15%] lg:z-20 lg:h-[54%] lg:w-[38%] lg:rotate-2",
  "lg:right-[1%] lg:top-0 lg:h-[37%] lg:w-[35%] lg:rotate-[4deg]",
  "lg:bottom-0 lg:left-[8%] lg:h-[38%] lg:w-[29%] lg:rotate-3",
  "lg:bottom-0 lg:right-[6%] lg:h-[40%] lg:w-[35%] lg:-rotate-3",
];

/* Below lg the five albums keep a collage feel with alternating tilts. */
const galleryMobileTilt = [
  "-rotate-2",
  "rotate-2",
  "rotate-1",
  "-rotate-1",
  "rotate-2",
];

const GALLERY_ALBUM_COUNT = 5;
const GALLERY_FETCH_LIMIT = 12;

export function EditorialGallery() {
  const {
    data: albums = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["home", "recent-public-gallery-albums"],
    queryFn: () => galleryRepository.getAlbums({ limit: GALLERY_FETCH_LIMIT }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 1,
  });
  // Cap after dropping cover-less albums so one missing cover never leaves a
  // gap in the five-photo collage or an empty state.
  const visibleAlbums = albums
    .filter((album) => album.cover_thumbnail_url || album.cover_image_url)
    .slice(0, GALLERY_ALBUM_COUNT);

  return (
    <section
      id="recent-photos"
      aria-labelledby="recent-photos-title"
      className="home-editorial-gallery home-editorial-grain relative isolate overflow-hidden px-5 py-[5.5rem] text-white sm:px-[6vw] sm:py-[clamp(5rem,10vw,10rem)]"
    >
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <SectionHeading
          id="recent-photos-title"
          eyebrow="From the archive"
          title="Recent"
          accent="Photos"
          tone="inverse"
        />
        {isLoading ? (
          <div
            className="grid grid-cols-2 gap-5 py-10 sm:grid-cols-3"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">Loading recent photos…</span>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-56 w-full" />
            ))}
          </div>
        ) : isError || visibleAlbums.length === 0 ? (
          <p className="py-14 text-sm">
            {isError
              ? "Recent photos are temporarily unavailable."
              : "No photo albums posted yet."}
          </p>
        ) : (
          <div className="relative mx-auto mt-10 grid max-w-[1300px] grid-cols-2 gap-x-4 gap-y-6 pb-4 sm:mt-14 sm:grid-cols-3 sm:gap-7 lg:mt-16 lg:block lg:h-[720px] lg:pb-0">
            {visibleAlbums.map((album, index) => (
              <a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${album.title} photo album`}
                className={`home-editorial-polaroid flex min-w-0 flex-col p-2 pb-3 transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none sm:p-2.5 lg:absolute lg:pb-4 lg:hover:z-30 lg:hover:-translate-y-2 ${galleryMobileTilt[index] ?? ""} ${galleryPlacements[index] ?? ""} ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
              >
                <OptimizedImage
                  src={album.cover_thumbnail_url || album.cover_image_url || ""}
                  width={540}
                  height={400}
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 30vw, 45vw"
                  alt={album.title}
                  className="aspect-[4/3] h-auto w-full object-cover lg:aspect-auto lg:min-h-0 lg:flex-1"
                />
                <p className="mt-2.5 line-clamp-2 font-mono text-[9px] uppercase tracking-[0.08em] sm:text-[10px]">
                  {album.title}
                </p>
              </a>
            ))}
          </div>
        )}
        <Link
          to="/gallery"
          className="relative z-20 mt-10 flex min-h-12 items-center justify-end gap-4 border-t border-white/25 pt-5 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Open the gallery <Arrow />
        </Link>
      </div>
    </section>
  );
}

const programLinks = [
  { label: "House System", href: "/house" },
  { label: "ACE", href: "/ace" },
  { label: "Intern Program", href: "/intern-program" },
  { label: "Vietnamese Culture Night", href: "/vcn" },
];

export function EditorialGetInvolved() {
  return (
    <section
      id="get-involved"
      aria-labelledby="get-involved-title"
      className="home-editorial-involved grid gap-10 px-5 py-[5.5rem] sm:px-[6vw] sm:py-[clamp(5rem,10vw,10rem)] lg:grid-cols-2 lg:gap-[10vw]"
    >
      <div>
        <Eyebrow className="text-ed-muted">Get involved</Eyebrow>
        <h2
          id="get-involved-title"
          className={`${editorialFont} mt-5 text-[clamp(3.6rem,8vw,9rem)] leading-[0.84] text-ed-ink`}
        >
          There’s more
          <br />
          to <em className="font-normal text-ed-accent">explore.</em>
        </h2>
      </div>
      <nav
        aria-label="VSA programs"
        className="self-center border-t border-ed-line"
      >
        {programLinks.map(({ label, href }, index) => (
          <Link
            key={href}
            to={href}
            className="grid min-h-[76px] grid-cols-[3rem_1fr_auto] items-center border-b border-ed-line py-5 text-ed-ink transition-colors hover:text-ed-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink sm:py-7"
          >
            <span className="font-mono text-[10px] tracking-[0.08em]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={`${editorialFont} text-[1.5rem] sm:text-[2rem]`}>
              {label}
            </span>
            <Arrow />
          </Link>
        ))}
      </nav>
    </section>
  );
}
