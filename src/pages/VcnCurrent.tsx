import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { useCurrentVcnArchive } from '../hooks/useVcnArchives';
import { formatDateOnly } from '../lib/dateOnly';
import { PROGRAM_STATUS_LABELS } from '../lib/programContent';
import { ProgramContentStatus, VCNArchive } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// VCN CURRENT YEAR — Update all fields in this config each production cycle.
// This file is the only thing that needs editing for a new VCN year.
// ─────────────────────────────────────────────────────────────────────────────

const VCN_CURRENT = {
  active: true,
  year: '2026',
  title: 'Tình Yêu Thầm Lặng',
  synopsis: 'Tình Yêu Thầm Lặng explores unspoken love within a Vietnamese household, highlighting family sacrifice, generational misunderstanding, and the quiet ways care is expressed through action rather than words.',
  date: 'Saturday, April 18, 2026',
  time: '',
  venue: '',
  ticketStatus: 'hidden' as ProgramContentStatus,
  ticketLink: '',
  ticketNote: '',
  posterUrl: '',
  trailerUrl: '',
  dances: [] as Array<{ title: string; choreographer?: string }>,
  sponsors: [] as Array<{ name: string; url?: string }>,
  messageFromTeam: '',
};

// ─────────────────────────────────────────────────────────────────────────────

function formatArchiveDate(date: string | null) {
  return formatDateOnly(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function currentFromArchive(archive: VCNArchive | null) {
  if (!archive) return VCN_CURRENT;

  return {
    active: true,
    year: String(archive.year),
    title: archive.title ?? '',
    synopsis: archive.description ?? '',
    date: formatArchiveDate(archive.event_date),
    time: archive.event_time ?? '',
    venue: archive.venue ?? '',
    ticketStatus: archive.ticket_status ?? 'hidden',
    ticketLink: archive.ticket_url ?? '',
    ticketNote: archive.ticket_note ?? '',
    posterUrl: archive.poster_url || archive.cover_image_url || '',
    trailerUrl: archive.trailer_url || '',
    dances: VCN_CURRENT.dances,
    sponsors: VCN_CURRENT.sponsors,
    messageFromTeam: VCN_CURRENT.messageFromTeam,
  };
}

export function VCNCurrent() {
  const { archive } = useCurrentVcnArchive();
  const currentVcn = currentFromArchive(archive);
  const ticketStatusLabel = PROGRAM_STATUS_LABELS[currentVcn.ticketStatus];
  const canShowTicketButton =
    !!currentVcn.ticketLink && (currentVcn.ticketStatus === 'open' || currentVcn.ticketStatus === 'active');
  const showTicketStatus =
    currentVcn.ticketStatus !== 'hidden' && (canShowTicketButton || !!currentVcn.ticketNote || !!ticketStatusLabel);

  if (!currentVcn.active) {
    return (
      <>
        <PageTitle title="VCN — This Year's Show" />
        <div className="min-h-[60vh] flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
          <div className="text-center max-w-md">
            <h1 className="font-serif leading-none tracking-[-0.03em] mb-4" style={{ fontSize: 44, color: 'var(--color-text)' }}>
              VCN {currentVcn.year || 'Coming Soon'}
            </h1>
            <p className="font-sans text-sm leading-relaxed mb-8" style={{ color: 'var(--color-text2)' }}>
              Details for this year's Vietnamese Culture Night production are coming soon. Follow{' '}
              <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400">
                @vsaatucsd
              </a>{' '}
              on Instagram for the latest announcements.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/vcn" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
                About VCN
              </Link>
              <Link to="/vcn/archive" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
                Past Productions
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={`VCN ${currentVcn.year}${currentVcn.title ? ` — ${currentVcn.title}` : ''}`} />

      {/* Page header */}
      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/vcn" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Vietnamese Culture Night</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>{currentVcn.year}</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em] italic" style={{ fontSize: 44, color: 'var(--color-text)' }}>
          {currentVcn.title || `Vietnamese Culture Night ${currentVcn.year}`}
        </h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          UCSD VSA · VCN {currentVcn.year}
          {currentVcn.date && <span className="ml-3 font-mono text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
            {currentVcn.date}{currentVcn.time ? ` · ${currentVcn.time}` : ''}
          </span>}
        </p>
        {showTicketStatus && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canShowTicketButton && (
              <a
                href={currentVcn.ticketLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-sans text-sm font-medium px-4 py-2 rounded"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
              >
                Get Tickets →
              </a>
            )}
            {ticketStatusLabel && (
              <span className="font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">{ticketStatusLabel}</span>
            )}
            {currentVcn.ticketNote && (
              <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{currentVcn.ticketNote}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '40px 52px', maxWidth: 800 }}>

        {/* Synopsis */}
        {currentVcn.synopsis && (
          <div className="mb-10">
            <Label className="mb-4">Synopsis</Label>
            <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
              {currentVcn.synopsis}
            </p>
          </div>
        )}

        {/* Venue */}
        {currentVcn.venue && (
          <div className="mb-10">
            <Label className="mb-3">Venue</Label>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text2)' }}>{currentVcn.venue}</p>
          </div>
        )}

        {/* Poster / Trailer */}
        {(currentVcn.posterUrl || currentVcn.trailerUrl) && (
          <div className="mb-10">
            <div style={{ display: 'grid', gridTemplateColumns: currentVcn.posterUrl && currentVcn.trailerUrl ? '1fr 1fr' : '1fr', gap: 16 }}>
              {currentVcn.posterUrl && (
                <img src={currentVcn.posterUrl} alt={`VCN ${currentVcn.year} poster`} className="border rounded w-full object-cover" style={{ borderColor: 'var(--color-border)' }} />
              )}
              {currentVcn.trailerUrl && (
                <div className="border rounded overflow-hidden aspect-video" style={{ borderColor: 'var(--color-border)' }}>
                  <iframe src={currentVcn.trailerUrl} title={`VCN ${currentVcn.year} trailer`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dances */}
        {currentVcn.dances.length > 0 && (
          <div className="mb-10">
            <Label className="mb-4">This Year's Dances</Label>
            <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              {currentVcn.dances.map((dance, i) => (
                <div key={i} className="flex items-baseline gap-4 border-b last:border-b-0" style={{ padding: '12px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <span className="font-mono text-[10px] tracking-[.04em] shrink-0" style={{ color: 'var(--color-text3)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{dance.title}</span>
                    {dance.choreographer && (
                      <span className="font-sans text-xs ml-3" style={{ color: 'var(--color-text3)' }}>Choreography by {dance.choreographer}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sponsors */}
        {currentVcn.sponsors.length > 0 && (
          <div className="mb-10">
            <Label className="mb-4">Sponsors</Label>
            <div className="flex flex-wrap gap-2">
              {currentVcn.sponsors.map((s, i) => (
                s.url ? (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="font-sans text-sm border rounded px-3 py-1.5 transition-colors duration-150" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{s.name}</a>
                ) : (
                  <span key={i} className="font-sans text-sm border rounded px-3 py-1.5" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{s.name}</span>
                )
              ))}
            </div>
          </div>
        )}

        {/* Message from Team */}
        {currentVcn.messageFromTeam && (
          <div className="mb-10 border-l-2 pl-5" style={{ borderColor: 'var(--color-border)' }}>
            <Label className="mb-3">From the Production Team</Label>
            <p className="font-serif italic leading-[1.6]" style={{ fontSize: 18, color: 'var(--color-text2)' }}>
              "{currentVcn.messageFromTeam}"
            </p>
          </div>
        )}

        {/* Footer nav */}
        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <Link to="/vcn" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← About VCN
          </Link>
          <Link to="/vcn/archive" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            Past Productions
          </Link>
        </div>

      </div>
    </>
  );
}
