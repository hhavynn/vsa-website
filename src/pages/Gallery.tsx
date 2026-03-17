import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
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
        if (err) { setError('Failed to load gallery'); }
        else { setAlbums((data ?? []) as GalleryAlbum[]); }
        setLoading(false);
      });
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <PageError message={error} />;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-b from-indigo-950 to-gray-950 pt-20 pb-16 px-4">
        <div className="container mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Gallery
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-indigo-200/70 max-w-xl mx-auto"
          >
            Photos from our events — view full albums on Google Photos.
          </motion.p>
        </div>
      </div>

      {/* Albums grid */}
      <div className="container mx-auto px-4 pb-20">
        {albums.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <svg className="w-14 h-14 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg">No albums yet — check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album, i) => (
              <motion.a
                key={album.id}
                href={album.google_photos_url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="group block rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/40 shadow-lg transition-colors duration-200"
              >
                {/* Cover image */}
                <div className="relative h-52 bg-slate-800 overflow-hidden">
                  {album.cover_image_url ? (
                    <img
                      src={album.cover_image_url}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900/50 to-violet-900/50 flex items-center justify-center">
                      <svg className="w-12 h-12 text-indigo-400/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  {/* "View on Google Photos" overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-full">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14H7.5C6.67 16 6 15.33 6 14.5v-5C6 8.67 6.67 8 7.5 8h9c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zm-7-2l3-2-3-2v4z"/>
                      </svg>
                      View Full Album
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-semibold text-white text-base leading-snug group-hover:text-indigo-300 transition-colors">
                    {album.title}
                  </h3>
                  {album.description && (
                    <p className="text-slate-400 text-sm mt-1.5 line-clamp-2 leading-relaxed">
                      {album.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-500">
                      {new Date(album.date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-indigo-400 font-medium group-hover:underline">
                      Google Photos ↗
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
