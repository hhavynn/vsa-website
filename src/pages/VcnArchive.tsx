import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';
import { Label } from '../components/ui/Label';
import { usePublishedVcnArchives } from '../hooks/useVcnArchives';
import { VCNArchive as VCNArchiveEntry } from '../types';

function formatArchiveDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'MMMM d, yyyy');
}

function ArchiveCard({ entry }: { entry: VCNArchiveEntry }) {
  const eventDate = formatArchiveDate(entry.event_date);
  const title = entry.title || `Vietnamese Culture Night ${entry.year}`;
  const hasMedia = !!entry.video_url || !!entry.photo_album_url;

  return (
    <article className="overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative min-h-[220px] border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          {entry.cover_image_url ? (
            <img src={entry.cover_image_url} alt={`${title} cover`} className="h-full min-h-[220px] w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full min-h-[220px] flex-col justify-between p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                UCSD VSA
              </div>
              <div>
                <div className="font-serif text-[58px] leading-none tracking-[-0.04em]" style={{ color: 'var(--color-text)' }}>
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
              <span className="rounded-sm border px-2 py-0.5 font-sans text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                {entry.annual_number}
              </span>
            )}
            {entry.is_featured && (
              <span className="rounded-sm border px-2 py-0.5 font-sans text-[11px] text-brand-600 dark:text-brand-400" style={{ borderColor: 'var(--color-border)' }}>
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
                  className="font-sans text-sm font-medium px-4 py-2 rounded"
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
                  className="font-sans text-sm px-4 py-2 rounded border"
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

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/vcn" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Vietnamese Culture Night</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>Archive</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>VCN Archive</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Past productions, preserved through official videos, albums, and production notes.
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        {archives.length === 0 ? (
          <div className="border rounded py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
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
            <Label>{archives.length} Published Productions</Label>
            <div className="flex flex-col gap-6">
              {archives.map((entry) => (
                <ArchiveCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-6 mt-8 flex flex-wrap gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <Link to="/vcn/current" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            This Year's Show →
          </Link>
          <Link to="/vcn" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← About VCN
          </Link>
        </div>
      </div>
    </>
  );
}
