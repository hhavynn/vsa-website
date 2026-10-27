import { type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { type IconBaseProps } from "react-icons";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";
import { OptimizedImage } from "../../common/OptimizedImage";
import { EventInterestButtons } from "../events/EventInterestButtons";
import { Skeleton } from "../../ui/Skeleton";
import { FALLBACK_LINKS } from "../../../config/publicFallbackContent";
import { galleryRepository } from "../../../data/repos/gallery";
import { type PublicEventPreview } from "../../../data/repos/events";
import {
  formatEventDateRange,
  formatEventTime,
  formatEventTimeRange,
} from "../../../lib/eventTime";

const CalendarIcon = FiCalendar as ComponentType<IconBaseProps>;
const ClockIcon = FiClock as ComponentType<IconBaseProps>;
const MapPinIcon = FiMapPin as ComponentType<IconBaseProps>;

const archivePhotos = {
  fallGbm: "/images/gallery/fall-26-gbm-1_2026-09-30.webp",
  cultureNight: "/images/gallery/vietnamese-culture-night-2026_2026-04-18.webp",
};

const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-xs";
const editorialFont =
  "font-['Instrument_Serif',Georgia,serif] font-normal tracking-[-0.035em]";

function Arrow({ downward = false }: { downward?: boolean }) {
  return <span aria-hidden="true">{downward ? "↓" : "↗"}</span>;
}

export function EditorialHero({
  logoSrc,
  logoAlt,
}: {
  logoSrc: string;
  logoAlt: string;
}) {
  return (
    <section className="home-editorial-hero home-editorial-grain relative isolate min-h-[690px] overflow-hidden text-white lg:min-h-[740px]">
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
        className="absolute left-[55%] top-[8%] text-5xl text-white lg:left-[58%] lg:text-7xl"
      >
        ✦
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-[8%] right-[4%] hidden text-4xl text-white lg:block"
      >
        ✧
      </span>

      <div className="relative z-10 mx-auto grid w-full max-w-[1520px] grid-cols-1 items-center gap-10 px-5 pb-12 pt-16 sm:px-10 lg:min-h-[740px] lg:grid-cols-[54%_46%] lg:gap-0 lg:px-14 lg:py-20">
        <div className="relative z-20 min-w-0 lg:pr-0">
          <p className={`${eyebrow} mb-7 text-white/95`}>
            Vietnamese Student Association · UC San Diego
          </p>
          <h1
            className={`${editorialFont} relative w-max max-w-full text-[clamp(3.8rem,14vw,8rem)] leading-[0.73] drop-shadow-[0_4px_22px_rgba(20,35,86,0.24)] sm:text-[clamp(6rem,12vw,10rem)] lg:text-[clamp(6.6rem,10vw,11rem)]`}
          >
            Culture,
            <br />
            <em className="relative font-normal">Community.</em>
          </h1>
          <p className="mt-5 text-right font-mono text-[10px] font-semibold tracking-[0.18em] sm:mr-10">
            2026—27
          </p>
          <p className="mb-7 mt-12 max-w-[430px] text-[15px] leading-[1.7] sm:ml-12 sm:text-lg lg:ml-16">
            A Vietnamese cultural and social community at UC San Diego since
            1977.
          </p>
          <div className="flex flex-wrap items-center gap-4 sm:ml-12 lg:ml-16">
            <Link
              to="/get-involved"
              className="inline-flex min-h-12 items-center gap-10 bg-[#faf9f5] px-6 py-3 text-sm font-bold text-[#28354d] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none"
            >
              Join VSA <Arrow />
            </Link>
            <a
              href="#upcoming-events"
              className="inline-flex min-h-12 items-center gap-10 border-b border-white/70 px-3 py-3 text-sm font-semibold transition-colors hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              View Events <Arrow downward />
            </a>
          </div>
        </div>

        <div
          className="relative z-10 mx-auto mt-3 h-[375px] w-full max-w-[540px] sm:h-[520px] lg:mt-0 lg:h-[620px] lg:max-w-none"
          aria-label="VSA community photography"
        >
          <figure className="home-editorial-polaroid absolute left-[2%] top-[1%] h-[64%] w-[73%] -rotate-[2deg] p-2 pb-8 sm:pb-10">
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
          <figure className="home-editorial-polaroid absolute bottom-[3%] right-[1%] z-20 h-[51%] w-[59%] rotate-[3deg] p-2 pb-8 sm:pb-10">
            <OptimizedImage
              src={archivePhotos.cultureNight}
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
          <div className="absolute right-[1%] top-[2%] z-30 h-[92px] w-[92px] rotate-[2deg] border border-white/60 bg-white/20 p-1.5 shadow-[0_15px_40px_rgba(25,34,75,0.2)] backdrop-blur sm:h-[136px] sm:w-[136px] lg:h-[150px] lg:w-[150px]">
            <OptimizedImage
              src={logoSrc}
              width={200}
              height={200}
              resize="contain"
              priority
              sizes="(min-width: 640px) 150px, 92px"
              alt={logoAlt}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
      <p
        aria-hidden="true"
        className="absolute right-6 top-5 hidden text-right font-mono text-[10px] tracking-[0.14em] sm:block"
      >
        2026—27
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
      className="flex min-h-[76px] items-center justify-between gap-7 overflow-x-auto border-b border-border-strong bg-surface2 px-6 py-4 sm:px-[6vw]"
    >
      {["Social", "Community", "Cultural", "Academic"].map((pillar, index) => (
        <span
          key={pillar}
          className={`${editorialFont} flex shrink-0 items-center gap-7 text-2xl text-text-primary sm:text-3xl`}
        >
          {pillar}{" "}
          {index < 3 && (
            <span
              aria-hidden="true"
              className="text-lg text-brand-600 dark:text-brand-400"
            >
              ✦
            </span>
          )}
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
    <article className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-x-4 gap-y-5 border-b border-border-strong/50 py-7 sm:grid-cols-[34px_150px_minmax(0,1fr)_44px] sm:gap-6 lg:grid-cols-[50px_190px_minmax(0,1fr)_52px] lg:gap-10">
      <span
        aria-hidden="true"
        className="self-start pt-1 font-mono text-xs text-text-secondary sm:self-center"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="col-start-2 row-start-1 sm:col-start-2 sm:row-auto">
        {image ? (
          <OptimizedImage
            src={image}
            width={360}
            height={320}
            resize="contain"
            sizes="(min-width: 640px) 190px, 120px"
            widths={[360]}
            alt={`${event.name} flyer`}
            className="h-36 w-36 border border-border-strong/30 bg-surface2 object-contain sm:h-32 sm:w-full lg:h-40"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-full items-center justify-center border border-border-strong/30 bg-surface2 font-serif text-3xl text-text-secondary sm:h-32 lg:h-40"
          >
            VSA
          </div>
        )}
      </div>
      <div className="col-start-2 min-w-0 sm:col-start-3 sm:row-auto">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-text-secondary">
          {formatEventDateRange(event.date, event.end_date, event.start_time)}
        </p>
        <h3
          className={`${editorialFont} my-2 text-[clamp(2rem,4vw,3.5rem)] leading-[0.99] text-text-primary`}
        >
          {event.name}
        </h3>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
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
            <div className="flex items-center gap-1.5">
              <dt>
                <MapPinIcon aria-hidden="true" />
                <span className="sr-only">Location</span>
              </dt>
              <dd>{event.location}</dd>
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
        <div className="mt-3 max-w-lg">
          <EventInterestButtons
            eventId={event.id}
            initialCounts={event.interest_counts ?? null}
            compact
          />
        </div>
      </div>
      <Link
        to={`/events#event-${event.id}`}
        aria-label={`Event details for ${event.name}`}
        className="col-start-2 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-400 sm:col-start-4 sm:row-auto sm:h-11 sm:w-11 sm:justify-center sm:rounded-full sm:border sm:border-border-strong sm:text-xl"
      >
        <span className="sm:sr-only">Event details</span>
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
      className="relative overflow-hidden bg-surface2 px-5 py-20 text-text-primary sm:px-[6vw] sm:py-28"
    >
      <div
        aria-hidden="true"
        className="home-editorial-event-dots pointer-events-none absolute -right-16 top-0 h-[350px] w-[350px] opacity-70"
      />
      <div className="relative mx-auto max-w-[1400px]">
        <div className="grid items-end gap-4 border-b border-border-strong pb-8 sm:grid-cols-[1fr_auto]">
          <div>
            <p className={`${eyebrow} mb-5 text-text-secondary`}>
              On the calendar
            </p>
            <h2
              className={`${editorialFont} text-[clamp(4rem,9vw,8rem)] leading-[0.86]`}
            >
              Upcoming{" "}
              <em className="font-normal text-brand-700 dark:text-brand-400">
                Events
              </em>
            </h2>
          </div>
          <Link
            to="/events"
            className="inline-flex min-h-11 items-center gap-5 text-sm font-semibold text-text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            View all events <Arrow />
          </Link>
        </div>
        {isError ? (
          <div className="space-y-3 py-10 text-sm text-text-primary">
            <p className="font-serif text-2xl">
              Events are temporarily unavailable
            </p>
            <p>
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
            <Link
              to="/events"
              className="inline-flex min-h-11 items-center text-brand-700 underline dark:text-brand-400"
            >
              View events page
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
          <div className="py-10 text-sm text-text-primary">
            <p>No upcoming events posted yet.</p>
            <Link
              to="/events#memory-wall"
              className="mt-3 inline-flex min-h-11 items-center text-brand-700 underline dark:text-brand-400"
            >
              View past events
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
      className="home-editorial-about relative grid min-h-[620px] items-center gap-12 overflow-hidden px-5 py-20 sm:px-[6vw] lg:grid-cols-[40%_60%] lg:gap-0 lg:py-28"
    >
      <div
        aria-hidden="true"
        className="home-editorial-orb mx-auto flex aspect-square w-[min(66vw,380px)] items-center justify-center rounded-full lg:mx-0 lg:w-[min(32vw,460px)]"
      >
        <span
          className={`${editorialFont} text-[clamp(6rem,13vw,10rem)] italic text-white drop-shadow-md`}
        >
          ’77
        </span>
      </div>
      <div className="relative z-10 max-w-3xl">
        <p className={`${eyebrow} mb-6`}>About VSA</p>
        <h2
          className={`${editorialFont} text-[clamp(4rem,7vw,7.5rem)] leading-[0.89]`}
        >
          Vietnamese Student Association{" "}
          <em className="font-normal text-[#6c628d]">at UCSD</em>
        </h2>
        <p className="my-8 max-w-[600px] text-[15px] leading-[1.85] sm:text-lg">
          VSA at UC San Diego is a cultural and social student organization
          established in 1977. We host general body meetings, cultural events,
          community programs, and academic activities.
        </p>
        <Link
          to="/get-involved"
          className="inline-flex min-h-11 items-center gap-8 border-b border-[#28354d] text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Learn about VSA <Arrow />
        </Link>
      </div>
    </section>
  );
}

export function EditorialGallery() {
  const {
    data: albums = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["home", "recent-public-gallery-albums"],
    queryFn: () => galleryRepository.getAlbums({ limit: 5 }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 1,
  });
  const visibleAlbums = albums.filter(
    (album) => album.cover_thumbnail_url || album.cover_image_url,
  );

  return (
    <section
      id="recent-photos"
      className="home-editorial-gallery home-editorial-grain relative isolate overflow-hidden px-5 py-20 text-white sm:px-[6vw] sm:py-28"
    >
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <div className="border-b border-white/30 pb-8">
          <p className={`${eyebrow} mb-5`}>From the gallery</p>
          <h2
            className={`${editorialFont} text-[clamp(4rem,9vw,8rem)] leading-[0.86]`}
          >
            Recent <em className="font-normal text-[#f0ccd9]">Photos</em>
          </h2>
        </div>
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
          <div className="relative mx-auto mt-10 grid max-w-[1200px] grid-cols-2 gap-5 pb-8 sm:mt-14 sm:grid-cols-3 sm:gap-7 lg:h-[700px] lg:block lg:pb-0">
            {visibleAlbums.map((album, index) => (
              <a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${album.title} photo album`}
                className={`home-editorial-polaroid block min-w-0 p-2 pb-8 transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none sm:p-2.5 sm:pb-10 lg:absolute lg:hover:z-30 lg:hover:-translate-y-2 ${
                  [
                    "lg:left-[2%] lg:top-[3%] lg:h-[42%] lg:w-[32%] lg:-rotate-3",
                    "lg:left-[29%] lg:top-[15%] lg:z-20 lg:h-[54%] lg:w-[39%] lg:rotate-2",
                    "lg:right-[1%] lg:top-0 lg:h-[37%] lg:w-[35%] lg:rotate-[4deg]",
                    "lg:bottom-[2%] lg:left-[8%] lg:h-[38%] lg:w-[29%] lg:rotate-3",
                    "lg:bottom-[1%] lg:right-[6%] lg:h-[41%] lg:w-[35%] lg:-rotate-3",
                  ][index]
                }`}
              >
                <OptimizedImage
                  src={album.cover_thumbnail_url || album.cover_image_url || ""}
                  width={540}
                  height={400}
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 30vw, 45vw"
                  alt={album.title}
                  className="aspect-[4/3] h-auto w-full object-cover lg:h-[calc(100%-20px)] lg:aspect-auto"
                />
                <p className="mt-2 line-clamp-2 font-mono text-[9px] font-semibold uppercase tracking-[0.07em]">
                  {album.title}
                </p>
              </a>
            ))}
          </div>
        )}
        <Link
          to="/gallery"
          className="relative z-20 mt-8 flex min-h-12 items-center justify-end gap-5 border-t border-white/30 pt-5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
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
      className="home-editorial-involved grid gap-10 px-5 py-20 sm:px-[6vw] sm:py-28 lg:grid-cols-2 lg:gap-24"
    >
      <div>
        <p className={`${eyebrow} mb-6`}>Get involved</p>
        <h2
          className={`${editorialFont} text-[clamp(4.3rem,9vw,9rem)] leading-[0.81]`}
        >
          Our
          <br />
          <em className="font-normal text-[#6c628d]">Programs.</em>
        </h2>
      </div>
      <nav
        aria-label="VSA programs"
        className="self-center border-t border-[#28354d]/20"
      >
        {programLinks.map(({ label, href }, index) => (
          <Link
            key={href}
            to={href}
            className="grid min-h-[84px] grid-cols-[35px_1fr_auto] items-center gap-3 border-b border-[#28354d]/20 py-4 transition-colors hover:text-[#6659a0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28354d] sm:grid-cols-[50px_1fr_auto]"
          >
            <span className="font-mono text-[10px] tracking-[0.08em]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={`${editorialFont} text-3xl sm:text-4xl`}>
              {label}
            </span>
            <Arrow />
          </Link>
        ))}
      </nav>
    </section>
  );
}
