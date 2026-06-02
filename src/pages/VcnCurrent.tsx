import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { useCurrentVcnArchive } from '../hooks/useVcnArchives';
import { formatDateOnly } from '../lib/dateOnly';
import { PROGRAM_STATUS_LABELS } from '../lib/programContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { ProgramContentStatus, VCNArchive } from '../types';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { FALLBACK_LINKS } from '../config/publicFallbackContent';

const VCN_PLACEHOLDER = {
  active: false,
  year: '',
  title: '',
  synopsis: '',
  date: '',
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
  if (!archive) return VCN_PLACEHOLDER;

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
    posterUrl: archive.poster_url || archive.cover_thumbnail_url || archive.cover_image_url || '',
    trailerUrl: archive.trailer_url || '',
    dances: VCN_PLACEHOLDER.dances,
    sponsors: VCN_PLACEHOLDER.sponsors,
    messageFromTeam: VCN_PLACEHOLDER.messageFromTeam,
  };
}

export function VCNCurrent() {
  const { archive, error } = useCurrentVcnArchive();
  const currentVcn = currentFromArchive(archive);

  const isDegraded = isSupabaseUnavailable(error);

  if (isDegraded) {
    return (
      <>
        <PageTitle title="VCN — This Year's Show" />
        <DegradedModeBanner sourceName="vcn" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title="VCN info temporarily unavailable"
            message="We're having trouble loading the latest VCN show details. Check @vsaatucsd on Instagram for the latest production updates."
            actionLabel="View on Instagram"
            actionHref={FALLBACK_LINKS.instagram}
          />
        </div>
      </>
    );
  }

  const ticketStatusLabel = PROGRAM_STATUS_LABELS[currentVcn.ticketStatus];
  const canShowTicketButton =
    !!currentVcn.ticketLink && (currentVcn.ticketStatus === 'open' || currentVcn.ticketStatus === 'active');
  const showTicketStatus =
    currentVcn.ticketStatus !== 'hidden' && (canShowTicketButton || !!currentVcn.ticketNote || !!ticketStatusLabel);

  if (!currentVcn.active) {
    return (
      <>
        <PageTitle title="VCN — This Year's Show" />
        <div className="program-app min-h-[60vh]">
          <section className="program-hero">
            <div className="program-hero-grain" />
            <div className="program-hero-inner">
              <span className="program-hero-kicker">Current Production</span>
              <h1 className="program-title">
                VCN <span className="program-title-script">{currentVcn.year || 'Coming Soon'}</span>
              </h1>
              <p className="program-hero-meta">
                Details for this year's Vietnamese Culture Night production are coming soon. Follow{' '}
                <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400">
                  @vsaatucsd
                </a>{' '}
                on Instagram for the latest announcements.
              </p>
              <div className="program-hero-actions">
                <Link to="/vcn" className="vsa-btn-primary font-sans text-sm font-medium">
                  About VCN
                </Link>
                <Link to="/vcn/archive" className="vsa-btn-ghost font-sans text-sm">
                  Past Productions
                </Link>
              </div>
            </div>
            <div className="program-watermark">soon</div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={`VCN ${currentVcn.year}${currentVcn.title ? ` — ${currentVcn.title}` : ''}`} />

      <div className="program-app">
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">Current Production</span>
            <h1 className="program-title">
              {currentVcn.title || `Vietnamese Culture Night ${currentVcn.year}`}
            </h1>
            <p className="program-hero-meta">
              UCSD VSA · VCN {currentVcn.year}
              {currentVcn.date && (
                <span className="block pt-2 font-mono text-[11px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                  {currentVcn.date}{currentVcn.time ? ` · ${currentVcn.time}` : ''}
                </span>
              )}
            </p>
            {showTicketStatus && (
              <div className="program-hero-actions">
                {canShowTicketButton && (
                  <a
                    href={currentVcn.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vsa-btn-primary font-sans text-sm font-medium"
                  >
                    Get Tickets →
                  </a>
                )}
                {ticketStatusLabel && (
                  <span className="scrapbook-sticker scrapbook-sticker-teal">{ticketStatusLabel}</span>
                )}
                {currentVcn.ticketNote && (
                  <span className="scrapbook-sticker">{currentVcn.ticketNote}</span>
                )}
              </div>
            )}
          </div>
          <div className="program-watermark">{currentVcn.year}</div>
        </section>

        {currentVcn.synopsis && (
          <section className="program-section">
            <div className="program-section-inner program-section-narrow">
              <div className="program-eyebrow">Synopsis</div>
              <p className="program-body">{currentVcn.synopsis}</p>
            </div>
          </section>
        )}

        {currentVcn.venue && (
          <section className="program-section">
            <div className="program-section-inner program-section-narrow">
              <div className="program-eyebrow">Venue</div>
              <p className="program-body">{currentVcn.venue}</p>
            </div>
          </section>
        )}

        {(currentVcn.posterUrl || currentVcn.trailerUrl) && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">Poster / Trailer</div>
              <div className={currentVcn.posterUrl && currentVcn.trailerUrl ? 'grid gap-5 md:grid-cols-2' : 'grid gap-5'}>
                {currentVcn.posterUrl && (
                  <div className="program-poster-card">
                    <img 
                      src={getSupabaseImageUrl(currentVcn.posterUrl, { width: 720, resize: 'contain', quality: 74 })}
                      srcSet={getSupabaseImageSrcSet(currentVcn.posterUrl, [360, 720, 960], { resize: 'contain', quality: 74 })}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      alt={`VCN ${currentVcn.year} poster`} 
                      className="w-full object-cover" 
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                {currentVcn.trailerUrl && (
                  <div className="program-poster-card aspect-video">
                    <iframe src={currentVcn.trailerUrl} title={`VCN ${currentVcn.year} trailer`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {currentVcn.dances.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">This Year's Dances</div>
              <div className="program-list">
                {currentVcn.dances.map((dance, i) => (
                  <div key={i} className="program-list-row">
                    <span className="font-mono text-[10px] tracking-[.04em] shrink-0" style={{ color: 'var(--color-text3)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <span className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{dance.title}</span>
                      {dance.choreographer && (
                        <span className="font-sans text-xs ml-3" style={{ color: 'var(--color-text3)' }}>Choreography by {dance.choreographer}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {currentVcn.sponsors.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">Sponsors</div>
              <div className="flex flex-wrap gap-2">
                {currentVcn.sponsors.map((s, i) => (
                  s.url ? (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="scrapbook-sticker scrapbook-sticker-teal">{s.name}</a>
                  ) : (
                    <span key={i} className="scrapbook-sticker">{s.name}</span>
                  )
                ))}
              </div>
            </div>
          </section>
        )}

        {currentVcn.messageFromTeam && (
          <section className="program-section">
            <div className="program-section-inner program-section-narrow">
              <div className="program-eyebrow">From the Production Team</div>
              <div className="program-rich-card">
                <p className="font-serif italic leading-[1.6]" style={{ fontSize: 20, color: 'var(--color-text2)' }}>
                  "{currentVcn.messageFromTeam}"
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <Link to="/vcn" className="vsa-btn-ghost font-sans text-sm">
                ← About VCN
              </Link>
              <Link to="/vcn/archive" className="vsa-btn-primary font-sans text-sm font-medium">
                Past Productions
              </Link>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
