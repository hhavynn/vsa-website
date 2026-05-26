import React from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { useUVSASchools } from '../hooks/useUVSASchools';
import { useExternalEvents } from '../hooks/useExternalEvents';
import { formatDateOnly } from '../lib/dateOnly';
import { ExternalEvent, UVSASchool } from '../types';

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

      {/* Hero */}
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">UVSA 101</span>
          <h1 className="vsa-page-title">SoCal VSA <em>Network</em></h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            VSA at UCSD is part of the larger UVSA SoCal network. We are one school in a wider community of students across Southern California.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="scrapbook-sticker scrapbook-sticker-teal">13 Schools</span>
            <span className="scrapbook-sticker scrapbook-sticker-coral">SoCal Network</span>
            <span className="scrapbook-sticker scrapbook-sticker-gold">UCSD Home Base</span>
            <span className="scrapbook-sticker scrapbook-sticker-teal">External Events</span>
          </div>
        </div>
      </div>

      <div className="vsa-container py-12 space-y-20">

        {/* UVSA 101 */}
        <section className="scrapbook-paper p-6 sm:p-8 space-y-4">
          <Label className="text-[var(--accent)]">What Is the UVSA Network?</Label>
          <p className="font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            <span className="font-bold" style={{ color: 'var(--text)' }}>Externals</span> are events hosted by other VSAs where UCSD members can attend, support, compete, and meet people from other schools. Externals can look like pageants, game shows, talent competitions, showcases, or performance nights. They are also a way for schools to support each other's philanthropy projects and cultural programming.
          </p>
          <p className="font-sans text-sm leading-[1.7]" style={{ color: 'var(--text3)' }}>
            Many externals are tied to philanthropy, culture, or community causes. Some feel like big competitions, but they still help connect schools and support the values behind UVSA.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {['Competitions', 'Philanthropy', 'Cultural Programming', 'Community Bonds'].map(tag => (
              <span key={tag} className="rounded-sm border px-2 py-0.5 font-sans text-[11px]" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Featured External */}
        <section>
          <Label className="mb-6 text-[var(--accent)]">Featured External</Label>
          <FeaturedExternalSpotlight
            event={spotlightEvent}
            loading={spotlightLoading}
            isFallback={!featuredEvent}
          />
        </section>

        {/* Upcoming Externals */}
        <section>
          <Label className="mb-6 text-[var(--accent)]">Upcoming Externals</Label>
          {upcomingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />
              ))}
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
                "2026-2027 externals will be announced after summer ICC planning."
              </p>
              <p className="mt-2 font-sans text-sm" style={{ color: 'var(--text3)' }}>
                Check back in late summer for the upcoming season.
              </p>
            </div>
          )}
        </section>

        {/* 2025-2026 External Showcase */}
        <section>
          <Label className="mb-3 text-[var(--accent)]">2025-2026 External Showcase</Label>
          <p className="mb-6 font-sans text-sm leading-[1.7] max-w-2xl" style={{ color: 'var(--text2)' }}>
            A look at the externals from the previous year. UCSD's Wild N' Culture is listed first as our home-hosted event. Many externals also connect to philanthropy and cultural programming at the hosting school.
          </p>
          {pastLoading || historicalLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortArchiveEventsUCSDFirst(archiveEvents).map(event => (
                <ExternalEventCard key={event.id} event={event} isArchive />
              ))}
            </div>
          )}
        </section>

        {/* The 13 Schools */}
        <section>
          <Label className="mb-6 text-[var(--accent)]">The 13 Schools</Label>
          {schoolsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-56 rounded-xl bg-[var(--surface)] animate-pulse border" style={{ borderColor: 'var(--border)' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {schools.map(school => (
                <SchoolCard key={school.id} school={school} />
              ))}
            </div>
          )}
        </section>

        {/* How to Attend + Points */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* How to Attend */}
          <section className="scrapbook-paper p-6 sm:p-8">
            <Label className="mb-5 text-[var(--accent)]">How to Attend Your First External</Label>
            <ol className="space-y-4 list-none p-0">
              {[
                "Find an external you want to attend in the list above.",
                "Check the host school's Linktree or Instagram for RSVP and tickets.",
                "Look for the external ride form in our Linktree for rides.",
                "Show up respectfully and represent VSA at UCSD well.",
                "Check in or follow the points proof process if announced.",
                "Have fun, meet other schools, and bring the energy back to UCSD.",
              ].map((step, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <span className="flex-shrink-0 font-mono text-[11px] font-bold pt-0.5" style={{ color: 'var(--accent)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="font-sans text-[14px] leading-[1.7]" style={{ color: 'var(--text2)' }}>{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 font-sans text-xs italic" style={{ color: 'var(--text3)' }}>
              Ride forms are usually posted through the VSA at UCSD Linktree when we coordinate attendance.
            </p>
          </section>

          {/* Points Explainer */}
          <section className="scrapbook-paper p-6 sm:p-8">
            <Label className="mb-5 text-[var(--accent)]">External Points</Label>
            <div className="space-y-5">
              <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>Default</span>
                <p className="mt-1 font-serif text-3xl leading-none" style={{ color: 'var(--text)' }}>4 Points</p>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--text3)' }}>per external attended</p>
              </div>
              <ul className="space-y-3">
                {[
                  "UCSD major events like WNC may be worth 5 points.",
                  "Points reward you for representing VSA at UCSD in the wider UVSA community.",
                  "Cabinet and interns do not earn leaderboard points for required work duties.",
                ].map((note, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 rounded-full mt-[7px] w-1.5 h-1.5" style={{ background: 'var(--brand)' }} />
                    <span className="font-sans text-sm leading-[1.7]" style={{ color: 'var(--text2)' }}>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Represent UCSD */}
        <section className="scrapbook-paper p-6 sm:p-8">
          <Label className="mb-4 text-[var(--accent)]">Represent UCSD</Label>
          <h2 className="vsa-section-title mb-4">
            Show Up for
            <br />
            <em>SoCal.</em>
          </h2>
          <p className="max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            Every time VSA at UCSD shows up at an external, we add to the energy of the whole network. Be respectful to host schools, follow event rules, and stay responsible. Support other VSAs the way we want others to support us.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Be respectful', 'Follow event rules', 'Stay responsible', 'Support each other'].map(tag => (
              <span key={tag} className="rounded-sm border px-2 py-0.5 font-sans text-[11px]" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}

function compareEventsByRecency(a: ExternalEvent, b: ExternalEvent) {
  const aTime = new Date(a.date || a.created_at || 0).getTime();
  const bTime = new Date(b.date || b.created_at || 0).getTime();
  return bTime - aTime;
}

function sortArchiveEventsUCSDFirst(events: ExternalEvent[]): ExternalEvent[] {
  return [...events].sort((a, b) => {
    const aIsUCSD = a.uvsa_school?.slug === 'ucsd';
    const bIsUCSD = b.uvsa_school?.slug === 'ucsd';
    if (aIsUCSD && !bIsUCSD) return -1;
    if (!aIsUCSD && bIsUCSD) return 1;
    return compareEventsByRecency(a, b);
  });
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
      <div className="scrapbook-paper p-8 h-48 animate-pulse" style={{ opacity: 0.6 }} />
    );
  }

  const school = event?.uvsa_school;
  const isUCSD = school?.slug === 'ucsd';
  const title = event?.title || '2025-2026 External Showcase';
  const hostName = school?.short_name || 'SoCal VSA Network';
  const eventType = event?.event_type || 'Season Archive';
  const description = event?.description || 'Explore the externals VSA at UCSD attended and supported across the SoCal VSA network last season.';

  return (
    <div className="scrapbook-paper overflow-hidden p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-6 lg:gap-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`scrapbook-sticker ${isFallback ? 'scrapbook-sticker-teal' : 'scrapbook-sticker-gold'}`}>
              {isFallback ? 'External Spotlight' : 'Featured External'}
            </span>
            <span className="scrapbook-sticker scrapbook-sticker-coral">{hostName}</span>
            {isUCSD && (
              <>
                <span className="scrapbook-sticker scrapbook-sticker-gold">Home Base</span>
                <span className="scrapbook-sticker scrapbook-sticker-teal">Hosted by VSA at UCSD</span>
              </>
            )}
            {eventType && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
                {eventType}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-serif text-3xl leading-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            <p className="max-w-3xl font-sans text-sm leading-[1.8] sm:text-[15px]" style={{ color: 'var(--text2)' }}>
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {school?.linktree_url && (
              <a
                href={school.linktree_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-primary px-4 py-2 text-[12px]"
              >
                Host Linktree
              </a>
            )}
            {event?.host_info_url && (
              <a
                href={event.host_info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-ghost px-4 py-2 text-[12px]"
              >
                View Event Info
              </a>
            )}
            {event?.rsvp_url && (
              <a
                href={event.rsvp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-ghost px-4 py-2 text-[12px]"
              >
                RSVP
              </a>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-center border-t pt-6 lg:border-l lg:border-t-0 lg:pt-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <SchoolVisualMark school={school} fallbackLabel={hostName} size="lg" />
        </div>
      </div>
    </div>
  );
}

function ExternalEventCard({ event, isArchive = false }: { event: ExternalEvent; isArchive?: boolean }) {
  const schoolName = event.uvsa_school?.short_name || 'Unknown School';
  const isUCSD = event.uvsa_school?.slug === 'ucsd';

  return (
    <div className="scrapbook-paper group flex min-h-full flex-col gap-4 p-5 transition-transform duration-150 hover:-translate-y-1">
      <div className="flex flex-wrap items-start gap-2">
        <span className="scrapbook-sticker scrapbook-sticker-coral">{schoolName}</span>
        {isUCSD && <span className="scrapbook-sticker scrapbook-sticker-gold">Home Base</span>}
        {event.event_type && (
          <span className="scrapbook-sticker scrapbook-sticker-teal">{event.event_type}</span>
        )}
        {isArchive && (
          <span
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}
          >
            {event.status === 'historical' ? 'Historical' : 'Past'}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-2 font-sans text-sm line-clamp-3 leading-[1.7]" style={{ color: 'var(--text2)' }}>
            {event.description}
          </p>
        )}
      </div>

      <div
        className="mt-auto flex flex-wrap gap-2 border-t pt-3"
        style={{ borderColor: 'var(--border)' }}
      >
        {!isArchive && event.date && (
          <span
            className="rounded-sm border px-2 py-0.5 font-sans text-[11px]"
            style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}
          >
            {formatDateOnly(event.date, 'MMM d, yyyy')}
          </span>
        )}
        {!isArchive && event.location && (
          <span
            className="rounded-sm border px-2 py-0.5 font-sans text-[11px]"
            style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}
          >
            {event.location}
          </span>
        )}
        {event.rsvp_url && (
          <a
            href={event.rsvp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm border px-2 py-0.5 font-sans text-[11px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
            style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            RSVP
          </a>
        )}
        {event.host_info_url && (
          <a
            href={event.host_info_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm border px-2 py-0.5 font-sans text-[11px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
            style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            Event Info
          </a>
        )}
        {event.uvsa_school?.linktree_url && (
          <a
            href={event.uvsa_school.linktree_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm border px-2 py-0.5 font-sans text-[11px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
            style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            Linktree
          </a>
        )}
        {isArchive && !event.rsvp_url && !event.host_info_url && !event.uvsa_school?.linktree_url && (
          <span className="font-mono text-[10px] italic uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            {event.status === 'historical' ? 'Historical Highlight' : 'Past Event'}
          </span>
        )}
      </div>
    </div>
  );
}

function SchoolCard({ school }: { school: UVSASchool }) {
  const isHomeSchool = school.slug === 'ucsd';
  const systemSticker =
    school.system_type === 'UC'
      ? 'scrapbook-sticker-teal'
      : school.system_type === 'CSU'
      ? 'scrapbook-sticker-coral'
      : 'scrapbook-sticker-gold';

  return (
    <div
      className={`scrapbook-paper group flex flex-col gap-4 p-5 transition-transform duration-150 hover:-translate-y-1${isHomeSchool ? ' ring-2 ring-[var(--brand)]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <SchoolVisualMark school={school} />
        <div className="flex flex-col items-end gap-1.5">
          {school.system_type && (
            <span className={`scrapbook-sticker ${systemSticker}`}>{school.system_type}</span>
          )}
          {isHomeSchool && (
            <span className="scrapbook-sticker scrapbook-sticker-gold">Home Base</span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <h3
          className="font-serif text-lg leading-tight transition-colors group-hover:text-[var(--brand)]"
          style={{ color: 'var(--text)' }}
        >
          {school.short_name}
        </h3>
        {school.vsa_name && (
          <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--text3)' }}>
            {school.vsa_name}
          </p>
        )}
        {school.city && (
          <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
            {school.city}
          </p>
        )}
      </div>

      {school.description && (
        <p className="font-sans text-xs line-clamp-2 leading-[1.7]" style={{ color: 'var(--text2)' }}>
          {school.description}
        </p>
      )}

      {school.known_for && school.known_for.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {school.known_for.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="rounded-sm border px-2 py-0.5 font-sans text-[10px]"
              style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {school.linktree_url && (
        <div className="w-full border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <a
            href={school.linktree_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border px-3 py-1.5 font-sans text-[11px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            Linktree
          </a>
        </div>
      )}
    </div>
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
        aria-label={`${label} school mark`}
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
