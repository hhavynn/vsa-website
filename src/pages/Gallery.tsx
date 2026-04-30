import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';

interface GalleryAlbum {
  id: string;
  title: string;
  description: string | null;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
}

export default function Gallery() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('gallery_events')
      .select('id, title, description, date, google_photos_url, cover_image_url')
      .not('google_photos_url', 'is', null)
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('Failed to load gallery');
        else setAlbums((data ?? []) as GalleryAlbum[]);
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
          <h1 className="vsa-page-title">Gallery</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            {albums.length} albums from GBMs, retreats, cultural programs, and VSA traditions.
          </p>
        </div>
      </div>

      <div className="vsa-container py-10">
        {albums.length === 0 ? (
          <div className="rounded-2xl border py-16 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>No albums yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {albums.map((album) => (
              <a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-card group block"
              >
                <div className="relative h-[220px] overflow-hidden" style={{ background: 'var(--surface2)' }}>
                  {album.cover_image_url ? (
                    <img
                      src={album.cover_image_url}
                      alt={album.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg className="h-10 w-10" style={{ color: 'var(--text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
                    <span className="font-sans text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      View Full Album
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="truncate font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--text)' }}>
                    {album.title}
                  </h3>
                  {album.description && (
                    <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                      {album.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] tracking-[0.04em]" style={{ color: 'var(--text3)' }}>
                      {format(new Date(album.date), 'MMM d, yyyy').toUpperCase()}
                    </span>
                    <span className="font-sans text-xs text-brand-600 dark:text-brand-400">
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
