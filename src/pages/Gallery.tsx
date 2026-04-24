import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { PageError } from '../components/common/PageError';
import { format } from 'date-fns';

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
        if (err) { setError('Failed to load gallery'); }
        else { setAlbums((data ?? []) as GalleryAlbum[]); }
        setLoading(false);
      });
  }, []);

  if (loading) return <PageLoader message="Loading gallery..." />;
  if (error) return <PageError message={error} />;

  return (
    <>
      <PageTitle title="Gallery" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Gallery</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          {albums.length} albums · view on Google Photos
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        {albums.length === 0 ? (
          <div className="border rounded py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>No albums yet — check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {albums.map((album) => (
              <a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block border rounded overflow-hidden transition-colors duration-150"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="relative overflow-hidden" style={{ height: 200, background: 'var(--color-surface2)' }}>
                  {album.cover_image_url ? (
                    <img
                      src={album.cover_image_url}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-10 h-10" style={{ color: 'var(--color-text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                    <span className="font-sans text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      View Full Album ↗
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-sans text-sm font-semibold tracking-[-0.01em] truncate" style={{ color: 'var(--color-text)' }}>
                    {album.title}
                  </h3>
                  {album.description && (
                    <p className="font-sans text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                      {album.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(album.date), 'MMM d, yyyy').toUpperCase()}
                    </span>
                    <span className="font-sans text-xs text-brand-600 dark:text-brand-400">
                      Google Photos ↗
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
