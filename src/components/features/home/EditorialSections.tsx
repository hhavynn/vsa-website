import { type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { type IconBaseProps } from "react-icons";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";
import { OptimizedImage } from "../../common/OptimizedImage";
import { EventInterestButtons } from "../events/EventInterestButtons";
import { Skeleton } from "../../ui/Skeleton";
import { Sparkle } from "../../ui/Sparkle";
import { CameraFrame, cameraDateStamp } from "../gallery/CameraFrame";
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
  getEventDateOnly,
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

const aboutPhoto = {
  src: "/images/gallery/vietnamese-culture-night-2026_2026-04-18.webp",
  thumb: { src: "/images/gallery/vietnamese-culture-night-2026_2026-04-18_thumb.webp", width: 720 },
  caption: "Vietnamese Culture Night · April 2026",
  alt: "The Vietnamese Culture Night 2026 cast and crew together on stage",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day, month and weekday of an event's San Diego calendar day. */
function dateParts(date: string, startTime?: string | null) {
  const [year, month, day] = getEventDateOnly(date, startTime).split("-").map(Number);
  return {
    day,
    month: MONTHS[month - 1] ?? "",
    weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "",
  };
}

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
            Vietnamese Student Association · UC{"\u00a0"}San{"\u00a0"}Diego
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

function getEventTimeLabel(event: PublicEventPreview): string | null {
  if (event.start_time && event.end_time)
    return formatEventTimeRange(event.start_time, event.end_time);
  if (event.start_time) return formatEventTime(event.start_time);
  return null;
}

function EditorialEventRow({ event }: { event: PublicEventPreview }) {
  const image = event.thumbnail_url || event.image_url;
  const time = getEventTimeLabel(event);
  const { day, month, weekday } = dateParts(event.date, event.start_time);
  const isMultiDay = Boolean(
    event.end_date && event.end_date !== getEventDateOnly(event.date, event.start_time),
  );
  return (
    <article className="grid min-w-0 grid-cols-[3.25rem_6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-4 border-b border-ed-line py-6 sm:grid-cols-[4.5rem_10rem_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[5.5rem_15rem_minmax(0,1fr)_auto] lg:items-center lg:gap-x-10 lg:py-8">
      <p className="flex flex-col items-start pt-0.5 lg:pt-0">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ed-accent">
          {month}
        </span>
        <span className={`${editorialFont} text-[2.75rem] leading-[0.95] text-ed-ink sm:text-[3.5rem]`}>
          {day}
        </span>
        <span className="text-[12px] text-ed-muted">{weekday}</span>
      </p>
      {/* Real flyers are portrait posters: contain the poster over a blurred
          fill of itself (same cached URL) instead of cropping its type. */}
      <div className="relative aspect-[4/5] overflow-hidden bg-surface2 sm:aspect-[4/3]">
        {image ? (
          <>
            <OptimizedImage
              src={image}
              width={360}
              height={270}
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 160px, 104px"
              widths={[360]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
            />
            <OptimizedImage
              src={image}
              width={360}
              height={270}
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 160px, 104px"
              widths={[360, 540]}
              resize="contain"
              alt={`${event.name} flyer`}
              className="relative h-full w-full object-contain"
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
        {isMultiDay && (
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ed-muted">
            {formatEventDateRange(event.date, event.end_date, event.start_time)}
          </p>
        )}
        <h3
          className={`${editorialFont} text-[clamp(1.5rem,3vw,2.75rem)] leading-[1.02] text-ed-ink [text-wrap:balance]`}
        >
          {event.name}
        </h3>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ed-muted sm:text-[13px]">
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
      <div className="col-span-3 flex min-w-0 flex-wrap items-center justify-between gap-3 sm:col-span-2 sm:col-start-2 lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:-mt-3">
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
        className="hidden h-[52px] w-[52px] items-center justify-center rounded-full border border-ed-line text-xl text-ed-ink transition-colors hover:border-ed-accent hover:bg-ed-accent hover:text-ed-on-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:inline-flex"
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
      className="vsa-halftone relative isolate scroll-mt-16 bg-ed-paper px-5 pb-20 pt-16 text-ed-ink sm:px-[6vw] sm:pb-28 sm:pt-24"
    >
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading
          id="upcoming-events-title"
          title="Upcoming events"
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
            {events.slice(0, 3).map((event) => (
              <EditorialEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const pillars = ["Social", "Community", "Cultural", "Academic"];

export function EditorialAbout() {
  return (
    <section
      id="about-vsa"
      aria-labelledby="about-vsa-title"
      className="home-about-field vsa-halftone vsa-halftone--left relative isolate overflow-hidden px-5 py-20 sm:px-[6vw] sm:py-28"
    >
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-[6vw]">
        <figure className="relative m-0 -rotate-[1.2deg] bg-ed-paper p-2.5 pb-10 shadow-[0_24px_60px_rgba(40,44,110,0.18)] dark:bg-surface sm:p-3 sm:pb-12">
          <div className="overflow-hidden bg-figma-mist">
            <OptimizedImage
              src={aboutPhoto.src}
              srcWidth={1200}
              lowRes={aboutPhoto.thumb}
              width={1200}
              height={627}
              sizes="(min-width: 1024px) 52vw, 100vw"
              alt={aboutPhoto.alt}
              className="aspect-[1200/627] h-auto w-full object-cover"
            />
          </div>
          <figcaption className="absolute bottom-3 left-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-figma-ink dark:text-ed-ink sm:bottom-4 sm:left-4">
            {aboutPhoto.caption}
          </figcaption>
          <div
            aria-hidden="true"
            className="home-editorial-bubble absolute -right-6 -top-8 h-24 w-24 sm:-right-10 sm:-top-12 sm:h-36 sm:w-36"
          />
        </figure>
        <div className="relative min-w-0">
          <p className={`${editorialFont} flex items-center gap-3 text-[2.1rem] italic leading-none text-ed-accent`}>
            Since 1977
            <Sparkle glow className="h-6 w-6 text-white dark:text-ed-accent" />
          </p>
          <h2
            id="about-vsa-title"
            className={`${editorialFont} mt-5 text-[clamp(2.6rem,5vw,4.5rem)] leading-[0.92] text-ed-ink [text-wrap:balance]`}
          >
            Vietnamese Student Association{" "}
            <em className="font-normal text-ed-accent">at UC San Diego</em>
          </h2>
          <p className="mt-6 max-w-[38rem] text-[15.5px] leading-[1.8] text-ed-ink">
            A cultural and social student organization at UC San Diego. Our
            programming includes general body meetings, cultural events,
            community programs, and academic support.
          </p>
          <ul
            aria-label="VSA pillars"
            className="mt-8 grid grid-cols-2 border-t border-ed-line sm:grid-cols-4"
          >
            {pillars.map((pillar) => (
              <li
                key={pillar}
                className={`${editorialFont} flex items-center gap-2 border-b border-ed-line py-3 text-[1.35rem] text-ed-ink`}
              >
                <Sparkle className="h-2.5 w-2.5 text-ed-accent" />
                {pillar}
              </li>
            ))}
          </ul>
          <Link
            to="/get-involved"
            className="mt-8 inline-flex min-h-11 items-center gap-4 border-b border-ed-ink text-[13.5px] font-semibold text-ed-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ed-ink"
          >
            Find your way in <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* Supporting prints beside the camera: alternating tilts like loose photos. */
const printTilts = ["-rotate-[2deg]", "rotate-[1.5deg]", "rotate-[1deg]", "-rotate-[1.5deg]"];

type HomeAlbum = Awaited<ReturnType<typeof galleryRepository.getAlbums>>[number];

function albumCover(album: HomeAlbum): string {
  return album.cover_thumbnail_url || album.cover_image_url || "";
}

/** The newest album on the camera screen; the screen is the album link. */
function CameraAlbum({ album, total }: { album: HomeAlbum; total: number }) {
  return (
    <CameraFrame hud={{ date: cameraDateStamp(album.date), counter: `1 / ${total}` }}>
      <a
        href={album.google_photos_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${album.title} photo album`}
        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
      >
        <OptimizedImage
          src={albumCover(album)}
          width={960}
          height={640}
          sizes="(min-width: 1024px) 50vw, 90vw"
          alt={album.title}
          className="aspect-[3/2] h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white sm:px-4 sm:pb-3">
          <span className="line-clamp-1">{album.title}</span>
          <span aria-hidden="true">↗</span>
        </span>
      </a>
    </CameraFrame>
  );
}

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
  // gap in the grid or an empty state.
  const visibleAlbums = albums
    .filter((album) => album.cover_thumbnail_url || album.cover_image_url)
        .slice(0, GALLERY_ALBUM_COUNT);

  return (
    <section
      id="recent-photos"
      aria-labelledby="recent-photos-title"
      className="home-gallery-field home-editorial-grain relative isolate overflow-hidden px-5 py-20 text-white sm:px-[6vw] sm:py-28"
    >
      <Sparkle glow className="absolute left-[46%] top-12 h-10 w-10 text-white sm:h-14 sm:w-14" />
      <Sparkle glow className="absolute bottom-16 right-[6%] hidden h-7 w-7 text-white lg:block" />
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <SectionHeading
          id="recent-photos-title"
          title="Recent"
          accent="photos"
          tone="inverse"
          action={
            <Link to="/gallery" className={editorialLinkClass("inverse")}>
              Open the gallery <Arrow />
            </Link>
          }
        />
        {isLoading ? (
          <div
            className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3"
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
          <div className="relative mt-12 grid gap-10 sm:mt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-[4vw]">
            <div className="relative">
              <CameraAlbum album={visibleAlbums[0]} total={visibleAlbums.length} />
              <div
                aria-hidden="true"
                className="home-editorial-bubble absolute -bottom-10 -left-6 h-24 w-24 sm:h-32 sm:w-32"
              />
            </div>
            {visibleAlbums.length > 1 && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6">
                {visibleAlbums.slice(1).map((album, index) => (
                  <li key={album.id} className={`min-w-0 ${printTilts[index] ?? ""}`}>
                    <a
                      href={album.google_photos_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${album.title} photo album`}
                      className="home-editorial-polaroid group block p-1.5 pb-2 transition-transform duration-300 ease-out hover:-translate-y-1 hover:rotate-0 focus-visible:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-2 sm:pb-2.5"
                    >
                      <OptimizedImage
                        src={albumCover(album)}
                        width={540}
                        height={360}
                        sizes="(min-width: 1024px) 20vw, 45vw"
                        alt={album.title}
                        className="aspect-[3/2] w-full bg-figma-mist object-cover"
                      />
                      <span className="mt-2 flex items-baseline justify-between gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]">
                        <span className="line-clamp-1">{album.title}</span>
                        <span aria-hidden="true">↗</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const programLinks = [
  { label: "House System", href: "/house", note: "A year-long community competition inside VSA." },
  { label: "ACE", href: "/ace", note: "VSA’s Big/Little family program." },
  { label: "Intern Program", href: "/intern-program", note: "A year-long leadership class on how VSA runs." },
  { label: "Vietnamese Culture Night", href: "/vcn", note: "Our annual culture show, built by students." },
  { label: "Wild N’ Culture", href: "/wild-n-culture", note: "An intercollegiate comedy competition." },
];

export function EditorialGetInvolved() {
  return (
    <section
      id="get-involved"
      aria-labelledby="get-involved-title"
      className="home-involved-field relative isolate overflow-hidden px-5 py-20 sm:px-[6vw] sm:py-28"
    >
      <div aria-hidden="true" className="home-editorial-bubble absolute -left-10 bottom-[-4rem] h-48 w-48 sm:h-72 sm:w-72" />
      <div aria-hidden="true" className="home-editorial-bubble absolute right-[38%] top-10 hidden h-16 w-16 lg:block" />
      <Sparkle glow className="absolute left-[34%] top-[18%] hidden h-9 w-9 text-white sm:block" />
      <Sparkle glow className="absolute bottom-[14%] left-[8%] h-5 w-5 text-white" />
      <div className="relative mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-[6vw]">
        <div>
          <h2
            id="get-involved-title"
            className={`${editorialFont} text-[clamp(3rem,6.5vw,6rem)] leading-[0.88] text-ed-ink`}
          >
            There’s more
            <br />
            to <em className="font-normal text-ed-accent">explore.</em>
          </h2>
          <p className="mt-6 max-w-[26rem] text-[15.5px] leading-[1.75] text-ed-muted">
            Start at a general body meeting, then explore Houses, ACE, VCN,
            and more.
          </p>
        </div>
        <nav aria-label="VSA programs" className="self-end border-t border-ed-line">
          {programLinks.map(({ label, href, note }) => (
            <Link
              key={href}
              to={href}
              className="group grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 border-b border-ed-line py-5 text-ed-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]"
            >
              <span className={`${editorialFont} text-[1.6rem] leading-tight transition-colors group-hover:text-ed-accent sm:text-[1.9rem]`}>
                {label}
              </span>
              <span className="col-start-1 row-start-2 text-[13px] text-ed-muted sm:col-start-2 sm:row-start-1">
                {note}
              </span>
              <span className="col-start-2 row-span-2 row-start-1 text-lg transition-transform group-hover:translate-x-1 motion-reduce:transition-none sm:col-start-3 sm:row-span-1">
                <Arrow />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
