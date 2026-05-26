import React from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { useUVSASchools } from '../hooks/useUVSASchools';
import { useExternalEvents } from '../hooks/useExternalEvents';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  FaGlobe, 
  FaMapMarkerAlt, 
  FaInstagram, 
  FaExternalLinkAlt, 
  FaStar, 
  FaInfoCircle, 
  FaCalendarAlt,
  FaCheckCircle,
  FaUsers,
  FaTrophy
} from 'react-icons/fa';
import { formatDateOnly } from '../lib/dateOnly';
import { ExternalEvent, UVSASchool } from '../types';

// Icon components cast to any to avoid TS JSX errors in some environments
const GlobeIcon = FaGlobe as any;
const MapPinIcon = FaMapMarkerAlt as any;
const InstagramIcon = FaInstagram as any;
const ExternalLinkIcon = FaExternalLinkAlt as any;
const StarIcon = FaStar as any;
const InfoIcon = FaInfoCircle as any;
const CalendarIcon = FaCalendarAlt as any;
const CheckCircleIcon = FaCheckCircle as any;
const UsersIcon = FaUsers as any;
const TrophyIcon = FaTrophy as any;

export default function UVSANetwork() {
  const { schools, loading: schoolsLoading } = useUVSASchools();
  const { events: upcomingEvents, loading: upcomingLoading } = useExternalEvents({ status: 'upcoming' });
  const { events: pastEvents, loading: pastLoading } = useExternalEvents({ status: 'past' });
  const { events: historicalEvents, loading: historicalLoading } = useExternalEvents({ status: 'historical' });

  const archiveEvents = [...pastEvents, ...historicalEvents];
  const allPublicEvents = [...upcomingEvents, ...archiveEvents];
  const featuredEvent = allPublicEvents
    .filter(event => event.is_featured)
    .sort(compareEventsByRecency)[0];
  const spotlightEvent = featuredEvent || archiveEvents[0];
  const spotlightLoading = upcomingLoading || pastLoading || historicalLoading;

  return (
    <>
      <PageTitle title="SoCal VSA Network" />

      {/* 1. Hero / UVSA 101 */}
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">UVSA 101</span>
          <h1 className="vsa-page-title">SoCal VSA <em>Network</em></h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            VSA at UCSD is part of the larger UVSA SoCal network. 
            We are one school in a wider community of students across Southern California.
          </p>
        </div>
      </div>

      <div className="vsa-container py-12 space-y-20">
        <section className="scrapbook-paper p-8 space-y-4">
          <p className="font-sans text-lg leading-relaxed" style={{ color: 'var(--text2)' }}>
            <span className="font-bold text-[var(--text)]">Externals</span> are events hosted by other VSAs where UCSD members can attend, support, compete, and meet people from other schools. 
            Whether it's a skit competition, a dance battle, or a cultural showcase, externals are the best way to see the "VSA world" beyond our own campus.
          </p>
          <div className="pt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
              <UsersIcon size={18} className="text-[var(--brand)]" />
              <span className="font-sans text-sm font-medium">13 Schools</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
              <TrophyIcon size={18} className="text-[var(--brand)]" />
              <span className="font-sans text-sm font-medium">Competitions</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
              <StarIcon size={18} className="text-[var(--brand)]" />
              <span className="font-sans text-sm font-medium">VSA Community</span>
            </div>
          </div>
        </section>

      {/* 2. Featured External */}
      <FeaturedExternalSpotlight
        event={spotlightEvent}
        loading={spotlightLoading}
        isFallback={!featuredEvent}
      />

      {/* 3. Upcoming Externals */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <CalendarIcon className="text-[var(--brand)]" size={28} />
          <h2 className="font-serif text-3xl">Upcoming Externals</h2>
        </div>

        {upcomingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />)}
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map(event => (
              <ExternalEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="scrapbook-note p-10 text-center border-dashed border-2" style={{ borderColor: 'var(--border)' }}>
            <p className="font-serif text-xl italic" style={{ color: 'var(--text3)' }}>
              "2026–2027 externals will be announced after summer ICC planning."
            </p>
            <p className="mt-2 font-sans text-sm" style={{ color: 'var(--text3)' }}>
              Check back in late Summer for the upcoming season!
            </p>
          </div>
        )}
      </section>

      {/* 4. 2025–2026 External Showcase */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <StarIcon className="text-[var(--brand)]" size={28} />
          <h2 className="font-serif text-3xl">2025–2026 External Showcase</h2>
        </div>
        
        <p className="font-sans text-[var(--text2)] max-w-2xl">
          Take a look at the events we attended and supported in the previous year. 
          Each school brings its own unique flavor to the network!
        </p>

        {pastLoading || historicalLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archiveEvents.map(event => (
              <ExternalEventCard key={event.id} event={event} isArchive />
            ))}
          </div>
        )}
      </section>

      {/* 5. Explore the 13 Schools */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <GlobeIcon className="text-[var(--brand)]" size={28} />
          <h2 className="font-serif text-3xl">Explore the 13 Schools</h2>
        </div>

        {schoolsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-56 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {schools.map(school => (
              <SchoolCard key={school.id} school={school} />
            ))}
          </div>
        )}
      </section>

      {/* 6. How to Attend & Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* How to Attend */}
        <section className="scrapbook-paper p-8 space-y-6">
          <div className="flex items-center gap-3">
            <InfoIcon className="text-[var(--brand)]" size={24} />
            <h2 className="font-serif text-2xl">How to Attend Your First External</h2>
          </div>
          <p className="font-sans text-sm text-[var(--text3)] italic">
            Ride forms are usually posted through the VSA at UCSD Linktree when we coordinate attendance.
          </p>
          <ol className="space-y-4 list-none p-0">
            {[
              "Find an external you want to attend in the list above.",
              "Check the host school’s Linktree or Instagram for RSVP/tickets.",
              "Look for the external ride form in our Linktree for rides.",
              "Show up respectfully and represent VSA at UCSD well.",
              "Check in or follow the points proof process if announced.",
              "Have fun, meet other schools, and bring the energy back to UCSD!"
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <p className="font-sans text-[var(--text2)] leading-tight">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Points Explainer */}
        <section className="scrapbook-paper p-8 space-y-6">
          <div className="flex items-center gap-3">
            <StarIcon className="text-[var(--brand)]" size={24} />
            <h2 className="font-serif text-2xl">External Points Explainer</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[var(--surface2)] border border-[var(--brand)] border-opacity-20">
              <p className="font-serif text-xl text-center">
                All externals = <span className="text-[var(--brand)] font-bold">4 Points</span>
              </p>
            </div>
            <ul className="space-y-2 font-sans text-sm text-[var(--text2)] list-disc pl-5">
              <li>UCSD major events like WNC may be worth 5 points.</li>
              <li>Points reward you for representing VSA at UCSD in the wider UVSA community.</li>
              <li>Cabinet and interns do not earn leaderboard points for required work duties (staffing, shifts, etc.).</li>
            </ul>
            
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                <h3 className="font-bold text-sm">Represent UCSD with Pride</h3>
              </div>
              <p className="font-sans text-xs italic" style={{ color: 'var(--text3)' }}>
                Be respectful to host schools, follow event rules, and stay responsible. 
                Support other VSAs the way we want others to support us!
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </>
);
}

function compareEventsByRecency(a: ExternalEvent, b: ExternalEvent) {
  const aTime = new Date(a.date || a.created_at || 0).getTime();
  const bTime = new Date(b.date || b.created_at || 0).getTime();
  return bTime - aTime;
}

function FeaturedExternalSpotlight({
  event,
  loading,
  isFallback,
}: {
  event?: ExternalEvent;
  loading: boolean;
  isFallback: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded border bg-[var(--color-surface)] p-6 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface2)]" />
        <div className="mt-5 h-8 w-3/4 animate-pulse rounded bg-[var(--surface2)]" />
        <div className="mt-4 h-20 animate-pulse rounded bg-[var(--surface2)]" />
      </section>
    );
  }

  const school = event?.uvsa_school;
  const title = event?.title || '2025-2026 External Showcase';
  const hostName = school?.short_name || 'SoCal VSA Network';
  const eventType = event?.event_type || 'Season archive';
  const description = event?.description || 'Explore the externals UCSD VSA attended and supported across the SoCal VSA network last season.';
  const pointsNote = event?.points && event.points !== 4
    ? `${event.points} points when announced by VSA at UCSD.`
    : null;

  return (
    <section className="overflow-hidden rounded border bg-[var(--color-surface)] shadow-sm" style={{ borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={isFallback ? 'External Spotlight' : 'Featured External'} color="yellow" />
            <Badge label={hostName} color="gray" />
            <span className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--text3)]">{eventType}</span>
          </div>

          <div className="space-y-3">
            <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
            <p className="max-w-3xl font-sans text-sm leading-7 sm:text-base" style={{ color: 'var(--text2)' }}>
              {description}
            </p>
          </div>

          {pointsNote && (
            <p className="inline-flex rounded bg-[var(--surface2)] px-3 py-2 font-sans text-xs font-medium text-[var(--text2)]">
              {pointsNote}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {school?.linktree_url && (
              <Button
                variant="primary"
                size="sm"
                className="gap-1"
                onClick={() => window.open(school.linktree_url!, '_blank', 'noopener,noreferrer')}
              >
                Host Linktree <ExternalLinkIcon size={12} />
              </Button>
            )}
            {event?.host_info_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open(event.host_info_url!, '_blank', 'noopener,noreferrer')}
              >
                View Event Info <ExternalLinkIcon size={12} />
              </Button>
            )}
            {event?.instagram_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open(event.instagram_url!, '_blank', 'noopener,noreferrer')}
              >
                View IG Post <InstagramIcon size={12} />
              </Button>
            )}
            {event?.rsvp_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open(event.rsvp_url!, '_blank', 'noopener,noreferrer')}
              >
                RSVP <ExternalLinkIcon size={12} />
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-[180px] border-t p-6 lg:border-l lg:border-t-0 flex items-center justify-center" style={{ borderColor: 'var(--border)' }}>
          <SchoolVisualMark school={school} fallbackLabel={hostName} size="lg" />
        </div>
      </div>
    </section>
  );
}

function ExternalEventCard({ event, isArchive = false }: { event: ExternalEvent; isArchive?: boolean }) {
  const schoolName = event.uvsa_school?.short_name || 'Unknown School';
  
  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-lg">
      <div className="p-5 flex-grow space-y-4">
        <div className="flex justify-between items-start gap-2">
          <Badge 
            label={schoolName} 
            color="gray"
            className="font-bold"
          />
          {!isArchive && (
            <Badge 
              label={`${event.points} pts`} 
              color={event.points >= 5 ? 'yellow' : 'gray'}
            />
          )}
        </div>
        
        <h3 className="font-serif text-xl leading-tight line-clamp-2">{event.title}</h3>
        
        {event.event_type && (
          <p className="font-sans text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--brand)' }}>
            {event.event_type}
          </p>
        )}

        <p className="font-sans text-sm line-clamp-3" style={{ color: 'var(--text2)' }}>
          {event.description}
        </p>

        {!isArchive && event.date && (
          <div className="flex items-center gap-2 font-sans text-xs" style={{ color: 'var(--text3)' }}>
            <CalendarIcon size={14} />
            <span>{formatDateOnly(event.date, 'MMMM d, yyyy')}</span>
          </div>
        )}

        {!isArchive && event.location && (
          <div className="flex items-center gap-2 font-sans text-xs" style={{ color: 'var(--text3)' }}>
            <MapPinIcon size={14} />
            <span>{event.location}</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-[var(--surface)] border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
        {event.rsvp_url && (
          <Button 
            variant="primary" 
            size="sm" 
            className="flex-1 min-w-[96px] text-xs gap-1"
            onClick={() => window.open(event.rsvp_url!, '_blank', 'noopener,noreferrer')}
          >
            RSVP <ExternalLinkIcon size={12} />
          </Button>
        )}
        {event.host_info_url && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 min-w-[118px] text-xs gap-1"
            onClick={() => window.open(event.host_info_url!, '_blank', 'noopener,noreferrer')}
          >
            View Info <ExternalLinkIcon size={12} />
          </Button>
        )}
        {event.instagram_url && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 min-w-[104px] text-xs gap-1"
            onClick={() => window.open(event.instagram_url!, '_blank', 'noopener,noreferrer')}
          >
            IG Post <InstagramIcon size={12} />
          </Button>
        )}
        {event.uvsa_school?.linktree_url && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 min-w-[110px] text-xs gap-1"
            onClick={() => window.open(event.uvsa_school!.linktree_url!, '_blank', 'noopener,noreferrer')}
          >
            Linktree <ExternalLinkIcon size={12} />
          </Button>
        )}
        {isArchive && !event.rsvp_url && !event.host_info_url && !event.instagram_url && !event.uvsa_school?.linktree_url && (
          <p className="font-sans text-[10px] italic uppercase tracking-widest text-center w-full" style={{ color: 'var(--text3)' }}>
            {event.status === 'historical' ? 'Historical Highlight' : 'Past Event'}
          </p>
        )}
      </div>
    </Card>
  );
}

function SchoolCard({ school }: { school: UVSASchool }) {
  return (
    <Card className="group p-5 flex flex-col h-full space-y-4 hover:border-[var(--brand)] transition-colors">
      <div className="flex items-start justify-between">
        <SchoolVisualMark school={school} />
        <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-[var(--text3)]">
          {school.city}
        </span>
      </div>

      <div>
        <h3 className="font-serif text-lg leading-tight group-hover:text-[var(--brand)] transition-colors">{school.short_name}</h3>
        <p className="font-sans text-xs" style={{ color: 'var(--text3)' }}>{school.vsa_name}</p>
      </div>

      <div className="flex items-center gap-1 font-sans text-xs" style={{ color: 'var(--text2)' }}>
        <MapPinIcon size={12} />
        <span>{school.city}</span>
      </div>

      <div className="flex-grow">
        {school.description && (
          <p className="font-sans text-xs line-clamp-2" style={{ color: 'var(--text2)' }}>
            {school.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        {school.linktree_url && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-[10px] h-7 px-2 gap-1"
            onClick={() => window.open(school.linktree_url!, '_blank', 'noopener,noreferrer')}
          >
            Linktree <ExternalLinkIcon size={10} />
          </Button>
        )}
        {school.instagram_url && (
          <button 
            className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] transition-colors"
            onClick={() => window.open(school.instagram_url!, '_blank', 'noopener,noreferrer')}
            title="Instagram"
          >
            <InstagramIcon size={14} />
          </button>
        )}
      </div>
    </Card>
  );
}

function SchoolVisualMark({
  school,
  fallbackLabel = 'VSA',
  size = 'md',
}: {
  school?: UVSASchool;
  fallbackLabel?: string;
  size?: 'md' | 'lg';
}) {
  const label = school?.short_name || fallbackLabel;
  const palette = getSchoolBadgePalette(school);
  const sizeClass = size === 'lg' ? 'h-32 w-32' : 'h-14 w-14';
  const textClass = size === 'lg' ? 'text-2xl' : 'text-sm';
  const logoUrl = getSafeLogoUrl(school?.logo_url);

  if (logoUrl) {
    return (
      <div
        className={`${sizeClass} shrink-0 rounded-lg border bg-[var(--surface2)] p-2 shadow-sm`}
        style={{ borderColor: 'var(--border)' }}
        aria-label={`${label} official school logo`}
      >
        <img
          src={logoUrl}
          alt={`${label} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} shrink-0 rounded-lg border border-dashed p-1 shadow-sm`}
      style={{
        borderColor: palette.border,
        background: palette.paper,
        transform: size === 'lg' ? 'rotate(-2deg)' : undefined,
      }}
      aria-label={`${label} generated mark`}
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center rounded-md border text-center font-sans uppercase"
        style={{
          borderColor: palette.innerBorder,
          background: palette.background,
          color: palette.text,
        }}
      >
        <span className={`${textClass} font-black leading-none tracking-[0.04em]`}>
          {formatBadgeInitials(label)}
        </span>
        <span className="mt-1 h-0.5 w-6 rounded-full opacity-70" style={{ background: palette.text }} />
      </div>
    </div>
  );
}

function formatBadgeInitials(label: string) {
  return label
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase() || 'VSA';
}

function getSchoolBadgePalette(school?: UVSASchool) {
  const slugHash = hashString(school?.slug || school?.short_name || 'vsa');
  const hue = slugHash % 360;

  return {
    paper: `hsl(${hue} 42% 96%)`,
    background: `linear-gradient(145deg, hsl(${hue} 58% 38%), hsl(${(hue + 18) % 360} 54% 28%))`,
    border: `hsl(${hue} 35% 62%)`,
    innerBorder: `hsl(${hue} 48% 72% / 0.78)`,
    text: 'hsl(42 46% 96%)',
  };
}

function hashString(value: string) {
  return value.split('').reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }, 0) >>> 0;
}

function getSafeLogoUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const isSupabaseStorage = parsed.hostname.includes('supabase.co') && parsed.pathname.includes('/storage/');

    if (parsed.protocol !== 'https:' || isSupabaseStorage) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
