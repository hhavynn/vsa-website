import { type CSSProperties, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateOnly } from '../lib/dateOnly';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';

interface RelatedEvent {
  id: string;
  name: string;
  date: string;
}

interface GalleryAlbum {
  id: string;
  title: string;
  description: string | null;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
  event_id: string | null;
  event: RelatedEvent | null;
}

const albumPatterns = [
  { rotate: '-1.4deg', offset: '0px', height: '236px', span: 4, tape: 'var(--tape-gold)', tapeX: '48%', tapeRotate: '-2deg' },
  { rotate: '1.1deg', offset: '22px', height: '292px', span: 4, tape: 'var(--tape-teal)', tapeX: '56%', tapeRotate: '1.5deg' },
  { rotate: '-0.7deg', offset: '8px', height: '210px', span: 4, tape: 'var(--tape-coral)', tapeX: '42%', tapeRotate: '-1deg' },
  { rotate: '1.6deg', offset: '-6px', height: '256px', span: 5, tape: 'var(--tape-teal)', tapeX: '50%', tapeRotate: '2deg' },
  { rotate: '-1.1deg', offset: '28px', height: '238px', span: 3, tape: 'var(--tape-gold)', tapeX: '62%', tapeRotate: '-2.5deg' },
];

function getAlbumStyle(index: number): CSSProperties {
  const pattern = albumPatterns[index % albumPatterns.length];
  return {
    '--album-rotate': pattern.rotate,
    '--album-offset': pattern.offset,
    '--album-image-height': pattern.height,
    '--album-span': String(pattern.span),
    '--album-tape': pattern.tape,
    '--album-tape-x': pattern.tapeX,
    '--album-tape-rotate': pattern.tapeRotate,
  } as CSSProperties;
}

function AlbumFallback() {
  return (
    <div className="gallery-memory-fallback">
      <svg className="h-10 w-10" style={{ color: 'var(--text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="font-serif text-2xl italic" style={{ color: 'var(--text)' }}>VSA</span>
    </div>
  );
}

export default function Gallery() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('gallery_events')
      .select('id, title, description, date, google_photos_url, cover_image_url, event_id, event:events(id, name, date)')
      .not('google_photos_url', 'is', null)
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError('Failed to load gallery');
        } else {
          // Supabase may return the embedded relation as an array depending on
          // its inferred cardinality. Normalize to a single object or null.
          const normalized = (data ?? []).map((row: any) => ({
            ...row,
            event: Array.isArray(row.event) ? (row.event[0] ?? null) : (row.event ?? null),
          })) as GalleryAlbum[];
          setAlbums(normalized);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <PageLoader message="Loading gallery..." />;
  if (error) return <PageError message={error} />;

  return (
    <>
      <PageTitle title="Gallery" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-gold mb-4">Memory Wall</span>
          <h1 className="vsa-page-title">Gallery</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            {albums.length} albums from GBMs, retreats, cultural programs, and VSA traditions.
          </p>
        </div>
      </div>

      <div className="vsa-container py-10">
        {albums.length === 0 ? (
          <div className="scrapbook-empty">
            <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>No albums yet. Check back soon.</p>
          </div>
        ) : (
          <div className="gallery-memory-wall">
            {albums.map((album, index) => (
              <a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gallery-memory-card group block"
                style={getAlbumStyle(index)}
              >
                <div className="gallery-memory-image relative">
                  {album.cover_image_url ? (
                    <>
                      <AlbumFallback />
                      <img
                        src={getSupabaseImageUrl(album.cover_image_url, {
                          width: 520,
                          height: 330,
                          resize: 'cover',
                          quality: 72,
                        })}
                        srcSet={getSupabaseImageSrcSet(album.cover_image_url, [360, 520, 720], {
                          resize: 'cover',
                          quality: 72,
                        })}
                        sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                        alt={album.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </>
                  ) : (
                    <AlbumFallback />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
                    <span className="font-sans text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      View Full Album
                    </span>
                  </div>
                </div>

                <div className="gallery-memory-caption">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="scrapbook-sticker scrapbook-sticker-gold">
                      {formatDateOnly(album.date, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                    </span>
                    {album.event && (
                      <span
                        className="scrapbook-sticker scrapbook-sticker-coral"
                        title={`From event: ${album.event.name}`}
                      >
                        From event
                      </span>
                    )}
                  </div>
                  <h3 className="truncate font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--text)' }}>
                    {album.title}
                  </h3>
                  {album.description && (
                    <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                      {album.description}
                    </p>
                  )}
                  {album.event && (
                    <p
                      className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--text3)' }}
                    >
                      Related event / {album.event.name}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="scrapbook-caption" style={{ color: 'var(--text3)' }}>Album</span>
                    <span className="scrapbook-sticker scrapbook-sticker-teal">
                      Google Photos
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
