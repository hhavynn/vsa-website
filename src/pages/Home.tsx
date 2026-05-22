import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { useEvents } from '../hooks/useEvents';
import { usePresidentsContent } from '../hooks/usePresidentsContent';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Event } from '../types';
import { splitPresidentsMessage } from '../data/presidentsContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';

const pillars = [
  {
    n: '01',
    label: 'Social',
  },
  {
    n: '02',
    label: 'Community',
  },
  {
    n: '03',
    label: 'Cultural',
  },
  {
    n: '04',
    label: 'Academic',
  },
];

const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: 'green',
  mixer: 'red',
  vcn: 'yellow',
  wildn_culture: 'yellow',
  winter_retreat: 'red',
  other: 'gray',
  external_event: 'gray',
};

function EventRow({ event }: { event: Event }) {
  const d = new Date(event.date);

  return (
    <div className="vsa-event-row scrapbook-note px-4 py-4">
      <div className="border-r pr-4 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="font-sans text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
          {format(d, 'MMM')}
        </div>
        <div className="font-serif text-[32px] leading-[1.1]" style={{ color: 'var(--text)' }}>
          {format(d, 'd')}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-sans text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          {event.name}
        </div>
        {event.location && (
          <div className="mt-1 truncate font-sans text-xs" style={{ color: 'var(--text3)' }}>
            {event.location}
          </div>
        )}
      </div>
      <Badge
        label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
        color={TYPE_COLOR[event.event_type] ?? 'gray'}
        className="hidden sm:inline-flex"
      />
    </div>
  );
}

function FeaturedEventHome({ event }: { event: Event }) {
  const d = new Date(event.date);
  const imageUrl = event.image_url;

  return (
    <div className="scrapbook-paper mb-6 overflow-hidden lg:grid lg:grid-cols-[1fr_0.75fr]">
      <div className="flex flex-col justify-center border-b p-6 sm:p-8 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge
            label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
            color={TYPE_COLOR[event.event_type] ?? 'gray'}
          />
          <span className="font-mono text-[10px] uppercase tracking-[.04em]" style={{ color: 'var(--text3)' }}>
            {format(d, 'MMM d / h:mm a')}
          </span>
        </div>
        <h3 className="mb-2 font-serif text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[32px]" style={{ color: 'var(--text)' }}>
          {event.name}
        </h3>
        {event.location && (
          <div className="mb-6 flex items-center gap-2 font-sans text-xs" style={{ color: 'var(--text3)' }}>
            <span className="h-1 w-1 rounded-full bg-brand-500" />
            {event.location}
          </div>
        )}
        <div>
          <Link to="/events" className="vsa-btn-primary py-2 text-xs">
            View Details -&gt;
          </Link>
        </div>
      </div>
      <div className="relative flex min-h-[220px] flex-col justify-center bg-[var(--surface2)] p-6 lg:p-8">
        <div className="scrapbook-photo relative mx-auto w-full max-w-[320px] rotate-[1.5deg]">
          {imageUrl ? (
            <img
              src={getSupabaseImageUrl(imageUrl, { width: 600, height: 800, resize: 'contain', quality: 75 })}
              alt={event.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center p-8 text-center">
              <span className="font-serif text-2xl italic leading-tight" style={{ color: 'var(--text3)' }}>{event.name}</span>
            </div>
          )}
        </div>
        <div className="absolute top-4 right-4 rounded-lg border bg-white/80 px-2.5 py-2 text-center shadow-sm backdrop-blur-md dark:bg-zinc-900/80" style={{ borderColor: 'var(--border)' }}>
          <div className="font-serif text-2xl leading-none" style={{ color: 'var(--text)' }}>{format(d, 'd')}</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{format(d, 'MMM')}</div>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { events } = useEvents();
  const { content: presidentsContent } = usePresidentsContent();
  const { settings: siteSettings } = useSiteSettings();
  const logoSrc = siteSettings.logoUrl || `${process.env.PUBLIC_URL || ''}/images/vsa-logo.jpg`;
  const presidentParagraphs = splitPresidentsMessage(presidentsContent.message);
  const [presidentsHeading, ...presidentsBody] = presidentParagraphs;
  const possibleSignature = presidentsBody[presidentsBody.length - 1];
  const signatureLines = possibleSignature
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean) ?? [];
  const hasSignatureBlock = signatureLines.length >= 2 && signatureLines[0].toLowerCase().startsWith('with love');
  const presidentBodyParagraphs = hasSignatureBlock ? presidentsBody.slice(0, -1) : presidentsBody;
  const signatureName = presidentsContent.names;
  const signatureRole = presidentsContent.role;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sortedUpcoming = events
    .filter((event) => new Date(event.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const [featured, ...rest] = sortedUpcoming.slice(0, 4);
  const upcomingEvents = sortedUpcoming.slice(0, 3); // For compatibility with older layout if needed, but we'll use featured/rest

  return (
    <>
      <PageTitle title="Home" />

      <section className="scrapbook-board relative flex min-h-[calc(100vh-60px)] items-center justify-center overflow-hidden">
        <div className="vsa-container relative z-10 w-full">
          <div className="grid min-h-[calc(100vh-60px)] items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
            <div className="scrapbook-paper flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <span className="scrapbook-pin" aria-hidden />
              <div className="vsa-animate-slide-up mb-6 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
                <span className="h-[1.5px] w-8 bg-[var(--brand)]" />
                Vietnamese Student Association / UC San Diego
              </div>
              <h1 className="vsa-animate-slide-up vsa-delay-1 font-serif text-[clamp(52px,8vw,82px)] leading-[0.9] tracking-[-0.03em]" style={{ color: 'var(--text)' }}>
                Culture,
                <br />
                <span className="italic" style={{ color: 'var(--brand)' }}>Community.</span>
              </h1>
              <p className="vsa-animate-slide-up vsa-delay-2 mt-7 max-w-[400px] font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                A Vietnamese cultural and social community at UC San Diego since 1977.
              </p>
              <div className="vsa-animate-slide-up vsa-delay-3 mt-10 flex flex-wrap gap-3">
                <Link to="/get-involved" className="vsa-btn-primary">Join VSA</Link>
                <Link to="/events" className="vsa-btn-ghost">View Events -&gt;</Link>
              </div>

              <div className="vsa-animate-fade-in vsa-delay-4 mt-12">
                <div className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
                  VSA Pillars
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {pillars.map((pillar) => (
                    <div
                      key={pillar.label}
                      className="scrapbook-note flex min-h-[76px] flex-col justify-center gap-1 px-4 py-3"
                    >
                      <span className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>{pillar.n}</span>
                      <span className="font-sans text-[13px] font-semibold leading-none" style={{ color: 'var(--text)' }}>{pillar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vsa-animate-fade-in vsa-delay-4 mt-8 flex gap-8 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
                {[
                  ['1977', 'Est.'],
                  ['500+', 'Members'],
                  ['20+', 'Events/Year'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="font-serif text-[32px] leading-none" style={{ color: 'var(--text)' }}>{value}</div>
                    <div className="mt-1 font-sans text-[11px] tracking-[0.04em]" style={{ color: 'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[340px] flex-col items-center justify-center py-8 lg:p-10">
              <div className="scrapbook-photo relative aspect-square w-[min(360px,80%)] rotate-[2deg]" style={{ animation: 'vsa-float 7s ease-in-out infinite' }}>
                <img
                  src={getSupabaseImageUrl(logoSrc, { width: 420, height: 420, resize: 'contain', quality: 78 })}
                  srcSet={getSupabaseImageSrcSet(logoSrc, [240, 420, 720], {
                    resize: 'contain',
                    quality: 78,
                  })}
                  sizes="(min-width: 1024px) 360px, 80vw"
                  alt={siteSettings.logoAlt || 'VSA logo lantern'}
                  className="h-full w-full object-contain"
                  decoding="async"
                />
              </div>
              <p className="scrapbook-sticker scrapbook-sticker-gold mt-8 text-center">
                Est. 1977 / Nonprofit / Open to all UCSD students
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="vsa-section scrapbook-board">
        <div className="vsa-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="vsa-section-label">Events</div>
              <h2 className="vsa-section-title">
                Upcoming
                <br />
                <em>events.</em>
              </h2>
              <div className="mt-7">
                <Link to="/events" className="vsa-btn-primary">See All Events</Link>
              </div>
            </div>
            <div>
              <div className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
                Upcoming
              </div>
              {!featured ? (
                <div className="scrapbook-empty font-sans text-sm" style={{ color: 'var(--text3)' }}>
                  No upcoming events posted yet.
                </div>
              ) : (
                <div className="flex flex-col">
                  <FeaturedEventHome event={featured} />
                  <div className="space-y-3">
                    {rest.slice(0, 2).map((event) => <EventRow key={event.id} event={event} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="vsa-message-section scrapbook-board">
        <div className="vsa-container">
          <div className="grid gap-12 lg:grid-cols-[1fr_240px] lg:items-start">
            <div className="scrapbook-paper p-6 sm:p-8">
              <span className="scrapbook-pin" aria-hidden />
              <div className="vsa-section-label">Presidents</div>
              <h2 className="vsa-section-title max-w-[720px]">
                {presidentsHeading}
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {presidentBodyParagraphs.map((paragraph, index) => (
                  <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-line font-sans text-sm leading-[1.9]" style={{ color: 'var(--text2)' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
              {hasSignatureBlock && (
                <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                  <div className="font-sans text-sm" style={{ color: 'var(--text3)' }}>{signatureLines[0]}</div>
                  <div className="mt-1 font-serif text-xl italic" style={{ color: 'var(--accent)' }}>{signatureName}</div>
                  <div className="mt-1 font-sans text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>{signatureRole}</div>
                </div>
              )}
            </div>
            <div>
              {presidentsContent.photoUrl ? (
                <div className="scrapbook-photo rotate-[1.5deg]">
                  <img
                    src={getSupabaseImageUrl(presidentsContent.photoUrl, {
                      width: 440,
                      height: 586,
                      resize: 'cover',
                      quality: 74,
                    })}
                    srcSet={getSupabaseImageSrcSet(presidentsContent.photoUrl, [320, 440, 640], {
                      resize: 'cover',
                      quality: 74,
                    })}
                    sizes="(min-width: 1024px) 220px, 70vw"
                    alt={presidentsContent.names}
                    className="aspect-[3/4] w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="scrapbook-photo flex aspect-[3/4] items-center justify-center">
                  <span className="font-serif text-[28px] italic" style={{ color: 'var(--text3)' }}>G + P</span>
                </div>
              )}
              <div className="mt-3 border-t py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="font-sans text-sm font-semibold" style={{ color: 'var(--text)' }}>{presidentsContent.names}</div>
                <div className="mt-1 font-sans text-[11px] uppercase tracking-[0.07em]" style={{ color: 'var(--text3)' }}>{presidentsContent.role}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
