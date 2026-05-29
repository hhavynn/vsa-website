import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { usePresidentsContent } from '../hooks/usePresidentsContent';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { eventsRepository, PublicEventPreview } from '../data/repos/events';
import { splitPresidentsMessage } from '../data/presidentsContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { parseDateOnly } from '../lib/dateOnly';
import { formatEventDateRange, formatEventTime, formatEventTimeRange } from '../lib/eventTime';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../utils/seasonalState';
import { ThisWeekInVSA } from '../components/features/home/ThisWeekInVSA';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { motion } from 'framer-motion';

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

function getTodayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEventTimeLabel(event: Pick<PublicEventPreview, 'start_time' | 'end_time'>): string | null {
  if (event.start_time && event.end_time) return formatEventTimeRange(event.start_time, event.end_time);
  if (event.start_time) return formatEventTime(event.start_time);
  return null;
}

function EventRow({ event }: { event: PublicEventPreview }) {
  const d = parseDateOnly(event.date);

  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="vsa-event-row scrapbook-note px-4 py-4"
    >
      <div className="border-r pr-4 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="font-sans text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
          {d ? format(d, 'MMM') : ''}
        </div>
        <div className="font-serif text-[32px] leading-[1.1]" style={{ color: 'var(--text)' }}>
          {d ? format(d, 'd') : ''}
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
    </motion.div>
  );
}

function FeaturedEventHome({ event }: { event: PublicEventPreview }) {
  const d = parseDateOnly(event.date);
  const imageUrl = event.thumbnail_url || event.image_url;
  const timeLabel = getEventTimeLabel(event);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="scrapbook-paper mb-6 flex flex-col-reverse overflow-hidden lg:grid lg:grid-cols-[1fr_0.75fr]"
    >
      <div className="flex flex-col justify-center p-6 sm:p-8 lg:border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge
            label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
            color={TYPE_COLOR[event.event_type] ?? 'gray'}
          />
          <span className="font-mono text-[10px] uppercase tracking-[.04em]" style={{ color: 'var(--text3)' }}>
            {formatEventDateRange(event.date, event.end_date)}
            {timeLabel ? ` / ${timeLabel}` : ''}
          </span>
        </div>
        <h3 className="mb-2 line-clamp-2 font-serif text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[32px]" style={{ color: 'var(--text)' }}>
          {event.name}
        </h3>
        {event.points > 0 && (
          <p className="mb-4 font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            {event.points} points available.
          </p>
        )}
        {event.location && (
          <div className="mb-6 flex items-center gap-2 font-sans text-xs uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
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
      <div className="relative flex flex-col justify-center bg-[var(--surface2)] p-6 lg:p-8">
        <div className="scrapbook-photo relative mx-auto w-full max-w-[320px] rotate-[1.5deg]">
          {imageUrl ? (
            <img
              src={getSupabaseImageUrl(imageUrl, { width: 600, height: 800, resize: 'contain', quality: 75 })}
              alt={event.name}
              className="max-h-[360px] w-full object-contain lg:max-h-none"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center p-8 text-center">
              <span className="font-serif text-2xl italic leading-tight" style={{ color: 'var(--text3)' }}>{event.name}</span>
            </div>
          )}
        </div>
        <div className="absolute top-4 right-4 rounded-lg border bg-white/80 px-2.5 py-2 text-center shadow-sm backdrop-blur-md dark:bg-zinc-900/80" style={{ borderColor: 'var(--border)' }}>
          <div className="font-serif text-2xl leading-none" style={{ color: 'var(--text)' }}>{d ? format(d, 'd') : ''}</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{d ? format(d, 'MMM') : ''}</div>
        </div>
      </div>
    </motion.div>
  );
}

export function Home() {
  const { content: presidentsContent } = usePresidentsContent();
  const { settings: siteSettings } = useSiteSettings();
  const today = getTodayDateOnly();
  const { data: upcomingEvents = [] } = useQuery<PublicEventPreview[]>({
    queryKey: ['home', 'upcoming-events-section', today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 4),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
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
  const presidentsPhotoUrl = presidentsContent.photoThumbnailUrl || presidentsContent.photoUrl;

  const [featured, ...rest] = upcomingEvents;
  const useSummerEventsEmptyState = shouldUseSummerEmptyState(upcomingEvents.length > 0);
  const summerEventsMessage = getSummerBreakMessage('events');

  return (
    <>
      <PageTitle title="Home" />

      <section className="scrapbook-board relative flex min-h-[calc(100vh-60px)] items-center justify-center overflow-hidden pt-12 sm:pt-16">
        {/* Tape accent for the whole board */}
        <div className="absolute top-6 left-1/4 right-1/4 h-6 opacity-40 mix-blend-multiply dark:mix-blend-screen pointer-events-none z-20" 
             style={{ 
               background: 'repeating-linear-gradient(-45deg, var(--tape-gold) 0 10px, rgba(255,255,255,0.1) 10px 14px)',
               transform: 'rotate(-0.5deg)',
               borderRadius: '2px'
             }} 
        />
        
        <div className="vsa-container relative z-10 w-full">
          <div className="grid min-h-[calc(100vh-60px)] items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
            <div className="scrapbook-paper flex flex-col justify-center p-6 sm:p-8 lg:p-10 scrapbook-rotate-sm-left">
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
                  {pillars.map((pillar, idx) => (
                    <motion.div
                      key={pillar.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + idx * 0.08 }}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className={`scrapbook-note flex min-h-[76px] flex-col justify-center gap-1 px-4 py-3 ${idx % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right'}`}
                    >
                      <span className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>{pillar.n}</span>
                      <span className="font-sans text-[13px] font-semibold leading-none" style={{ color: 'var(--text)' }}>{pillar.label}</span>
                    </motion.div>
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
              <p className="scrapbook-sticker scrapbook-sticker-gold mt-8 text-center scrapbook-rotate-sm-right">
                Est. 1977 / Nonprofit / Open to all UCSD students
              </p>
            </div>
          </div>
        </div>
      </section>

      <ThisWeekInVSA />

      <RevealOnScrollWrapper>
        <section className="py-12 sm:py-16 bg-[var(--surface2)]">
          <div className="vsa-container">
            <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10 lg:p-12 scrapbook-rotate-sm-right">
              <span className="scrapbook-pin" aria-hidden />
              <div className="grid gap-10 lg:grid-cols-[1fr_0.5fr] lg:items-center">
                <div>
                  <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">Start Your Journey</span>
                  <h2 className="vsa-section-title mb-6">
                    New to VSA?
                    <br />
                    <span className="italic" style={{ color: 'var(--brand)' }}>Begin here.</span>
                  </h2>
                  <p className="max-w-xl font-sans text-base leading-relaxed" style={{ color: 'var(--text2)' }}>
                    We've put together a friendly "Passport" checklist to help you navigate our programs, 
                    meet new people, and make the most of your time with us.
                  </p>
                  <div className="mt-8">
                    <Link to="/get-involved" className="vsa-btn-primary">
                      View the Checklist -&gt;
                    </Link>
                  </div>
                </div>
                <div className="relative hidden lg:block">
                  <div className="scrapbook-note rotate-[-2deg] p-6 text-center shadow-lg">
                    <div className="mb-2 font-serif text-3xl" style={{ color: 'var(--brand)' }}>8</div>
                    <div className="font-sans text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Ways to Connect</div>
                  </div>
                  <div className="absolute -bottom-4 -right-4 scrapbook-note rotate-[4deg] p-4 text-center shadow-md">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="mx-auto h-6 w-6 text-green-500">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </RevealOnScrollWrapper>

      <RevealOnScrollWrapper>
        <section className="vsa-section scrapbook-board">
          <div className="vsa-container">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="relative">
                <span className="scrapbook-pin -left-4 top-0 hidden lg:block" aria-hidden />
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
                  <div className="scrapbook-empty font-sans text-sm scrapbook-rotate-sm-right" style={{ color: 'var(--text3)' }}>
                    {useSummerEventsEmptyState ? (
                      <div className="space-y-3">
                        <span className="scrapbook-sticker scrapbook-sticker-gold inline-flex">
                          {summerEventsMessage.badge}
                        </span>
                        <div>
                          <p className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
                            {summerEventsMessage.title}
                          </p>
                          <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
                            {summerEventsMessage.body}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Link to="/events" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
                            View past events
                          </Link>
                          <Link to="/points" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
                            Find My Points
                          </Link>
                        </div>
                      </div>
                    ) : (
                      'No upcoming events posted yet.'
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="scrapbook-rotate-sm-right">
                      <FeaturedEventHome event={featured} />
                    </div>
                    <div className="space-y-3">
                      {rest.slice(0, 2).map((event, idx) => (
                        <div key={event.id} className={idx % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right'}>
                          <EventRow event={event} />
                        </div>
                      ))}
                    </div>
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
                {presidentsPhotoUrl ? (
                  <div className="scrapbook-photo rotate-[1.5deg]">
                    <img
                      src={getSupabaseImageUrl(presidentsPhotoUrl, {
                        width: 440,
                        height: 586,
                        resize: 'cover',
                        quality: 74,
                      })}
                      srcSet={getSupabaseImageSrcSet(presidentsPhotoUrl, [320, 440, 640], {
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
      </RevealOnScrollWrapper>
    </>
  );
}
