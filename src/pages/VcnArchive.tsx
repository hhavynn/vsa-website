import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

// ─────────────────────────────────────────────────────────────────────────────
// VCN ARCHIVE DATA — Add a new entry each year after the show.
// Entries are displayed newest-first. All fields are optional except year/title.
// ─────────────────────────────────────────────────────────────────────────────

interface VCNArchiveEntry {
  year: string;
  title: string;
  synopsis?: string;
  posterUrl?: string;
  trailerUrl?: string;
  dances?: string[];
  sponsors?: string[];
  note?: string;
}

const VCN_ARCHIVE: VCNArchiveEntry[] = [
  // Add each completed year below — most recent year first.
  // {
  //   year: '2025',
  //   title: 'Example Title',
  //   synopsis: 'A short story synopsis for the archive.',
  //   trailerUrl: 'https://www.youtube.com/embed/VIDEO_ID',
  //   posterUrl: 'https://example.com/poster.jpg',
  //   dances: ['Dance One', 'Dance Two', 'Dance Three'],
  //   sponsors: ['Sponsor A', 'Sponsor B'],
  //   note: 'Sold out in under 24 hours.',
  // },
];

// ─────────────────────────────────────────────────────────────────────────────

export function VCNArchive() {
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
          Past productions — every year a new story, a new cast, a new chapter.
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        {VCN_ARCHIVE.length === 0 ? (
          <div className="border rounded py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-sans text-sm mb-4" style={{ color: 'var(--color-text3)' }}>
              Archive entries will appear here after each production year.
            </p>
            <Link
              to="/vcn/current"
              className="font-sans text-sm font-medium text-brand-600 dark:text-brand-400"
            >
              See This Year's Show →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {VCN_ARCHIVE.map((entry) => (
              <div key={entry.year} className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <div className="border-b" style={{ padding: '16px 20px', background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
                  <div className="font-mono text-[10px] tracking-[.04em] mb-0.5" style={{ color: 'var(--color-text3)' }}>VCN {entry.year}</div>
                  <h2 className="font-serif tracking-[-0.02em] italic" style={{ fontSize: 22, color: 'var(--color-text)' }}>{entry.title}</h2>
                  {entry.note && (
                    <p className="font-sans text-xs mt-1 italic" style={{ color: 'var(--color-text3)' }}>{entry.note}</p>
                  )}
                </div>

                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: entry.posterUrl || entry.trailerUrl ? '1fr 1fr' : '1fr', gap: 20, background: 'var(--color-surface)' }}>
                  {(entry.posterUrl || entry.trailerUrl) && (
                    <div>
                      {entry.trailerUrl ? (
                        <div className="border rounded overflow-hidden aspect-video" style={{ borderColor: 'var(--color-border)' }}>
                          <iframe src={entry.trailerUrl} title={`VCN ${entry.year} trailer`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                      ) : entry.posterUrl ? (
                        <img src={entry.posterUrl} alt={`VCN ${entry.year} poster`} className="border rounded w-full object-cover" style={{ borderColor: 'var(--color-border)' }} />
                      ) : null}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {entry.synopsis && (
                      <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)' }}>{entry.synopsis}</p>
                    )}

                    {entry.dances && entry.dances.length > 0 && (
                      <div>
                        <Label className="mb-2">Dances</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.dances.map((d) => (
                            <span key={d} className="font-sans text-xs border rounded-sm px-2 py-0.5" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {entry.sponsors && entry.sponsors.length > 0 && (
                      <div>
                        <Label className="mb-2">Sponsors</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.sponsors.map((s) => (
                            <span key={s} className="font-sans text-xs border rounded-sm px-2 py-0.5" style={{ color: 'var(--color-text3)', borderColor: 'var(--color-border)' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-6 mt-8 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
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
