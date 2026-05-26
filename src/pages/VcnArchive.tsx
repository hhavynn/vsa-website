import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';
import { usePublishedVcnArchives } from '../hooks/useVcnArchives';
import { VCNArchive as VCNArchiveEntry } from '../types';
import { formatDateOnly } from '../lib/dateOnly';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';

function ArchiveCard({ entry }: { entry: VCNArchiveEntry }) {
  const eventDate = formatDateOnly(entry.event_date, 'MMMM d, yyyy');
  const title = entry.title || `Vietnamese Culture Night ${entry.year}`;
  const hasMedia = !!entry.video_url || !!entry.photo_album_url;
  const coverUrl = entry.cover_thumbnail_url || entry.cover_image_url;

  return (
    <article className="program-poster-card overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative min-h-[220px] border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          {coverUrl ? (
            <img
              src={getSupabaseImageUrl(coverUrl, { width: 640, height: 420, resize: 'cover', quality: 72 })}
              srcSet={getSupabaseImageSrcSet(coverUrl, [360, 640, 820], { resize: 'cover', quality: 72 })}
              sizes="(min-width: 1024px) 45vw, 100vw"
              alt={`${title} cover`}
              className="h-full min-h-[220px] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full min-h-[220px] flex-col justify-between p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                VSA at UCSD
              </div>
              <div>
                <div className="font-serif text-[58px] italic leading-none tracking-[-0.04em]" style={{ color: 'var(--color-text)' }}>
                  {entry.year}
                </div>
                <div className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                  Vietnamese Culture Night
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
              VCN {entry.year}
            </span>
            {entry.annual_number && (
              <span className="scrapbook-sticker">
                {entry.annual_number}
              </span>
            )}
            {entry.is_featured && (
              <span className="scrapbook-sticker scrapbook-sticker-coral">
                Featured
              </span>
            )}
          </div>

          <h2 className="font-serif text-[26px] italic leading-[1.12] tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
            {title}
          </h2>

          {(eventDate || entry.venue || entry.theme_name) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
              {eventDate && <span>{eventDate}</span>}
              {entry.venue && <span>{entry.venue}</span>}
              {entry.theme_name && <span>{entry.theme_name}</span>}
            </div>
          )}

          {entry.description && (
            <p className="mt-4 font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
              {entry.description}
            </p>
          )}

          {hasMedia && (
            <div className="mt-5 flex flex-wrap gap-3">
              {entry.video_url && (
                <a
                  href={entry.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vsa-btn-primary font-sans text-sm font-medium"
                  style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
                >
                  Watch Video
                </a>
              )}
              {entry.photo_album_url && (
                <a
                  href={entry.photo_album_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vsa-btn-ghost font-sans text-sm"
                  style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}
                >
                  View Photo Album
                </a>
              )}
            </div>
          )}

          {(entry.album_source || entry.photo_credit) && entry.photo_album_url && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              {entry.album_source && (
                <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                  Album source: {entry.album_source}
                </p>
              )}
              {entry.photo_credit && (
                <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                  {entry.photo_credit}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function VCNArchive() {
  const { archives, loading, error } = usePublishedVcnArchives();

  if (loading) {
    return (
      <>
        <PageTitle title="VCN Archive" />
        <PageLoader message="Loading VCN archive..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="VCN Archive" />
        <PageError message="Failed to load VCN archive" />
      </>
    );
  }

  return (
    <>
      <PageTitle title="VCN Archive" />

      <div className="program-app">
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">Poster Archive</span>
            <h1 className="program-title">
              VCN <span className="program-title-script">Archive</span>
            </h1>
            <p className="program-hero-meta">
              Past productions, preserved through official videos, albums, and production notes.
            </p>
          </div>
          <div className="program-watermark">archive</div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            {archives.length === 0 ? (
              <div className="scrapbook-empty">
                <p className="font-sans text-sm mb-4" style={{ color: 'var(--color-text3)' }}>
                  Published archive entries will appear here after they are approved.
                </p>
                <Link
                  to="/vcn/current"
                  className="font-sans text-sm font-medium text-brand-600 dark:text-brand-400"
                >
                  See This Year's Show →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="program-eyebrow">{archives.length} Published Productions</div>
                <div className="flex flex-col gap-7">
                  {archives.map((entry) => (
                    <ArchiveCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <Link to="/vcn/current" className="vsa-btn-primary font-sans text-sm font-medium">
                This Year's Show →
              </Link>
              <Link to="/vcn" className="vsa-btn-ghost font-sans text-sm">
                ← About VCN
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
