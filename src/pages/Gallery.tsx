import { type CSSProperties, type MouseEvent, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDateOnly } from '../lib/dateOnly';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { PageTitle } from '../components/common/PageTitle';
import { GallerySkeleton } from '../components/common/PageSkeletons';
import { PageError } from '../components/common/PageError';
import { useGallery, useGalleryStats } from '../hooks/useGallery';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../utils/seasonalState';
import { motion, useReducedMotion } from 'framer-motion';
import { AlbumFallback, AlbumLightbox } from '../components/features/gallery/AlbumLightbox';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { FALLBACK_GALLERY, FALLBACK_LINKS } from '../config/publicFallbackContent';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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

// The quick-look is open when the current history entry carries an album id.
// Using history state (not a query param) means Back closes it, a swipe
// replaces the entry instead of stacking one per album, and the site's
// scroll-to-top-on-URL-change behavior never fires behind the dialog.
interface AlbumLocationState {
  albumQuickLook?: string;
}

export default function Gallery() {
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    data, 
    isLoading: loading, 
    error, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useGallery();
  
  const { data: totalCount = 0 } = useGalleryStats();

  const albums = useMemo(() => {
    return data?.pages.flatMap(page => page) ?? [];
  }, [data]);
  const openAlbumId = (location.state as AlbumLocationState | null)?.albumQuickLook ?? null;
  const openAlbumIndex = openAlbumId ? albums.findIndex((album) => album.id === openAlbumId) : -1;

  const pagePath = `${location.pathname}${location.search}`;
  const openAlbum = useCallback(
    (albumId: string) => navigate(pagePath, { state: { albumQuickLook: albumId } }),
    [navigate, pagePath],
  );
  const showAlbumAt = useCallback(
    (albumIndex: number) => {
      const target = albums[albumIndex];
      if (target) navigate(pagePath, { replace: true, state: { albumQuickLook: target.id } });
    },
    [albums, navigate, pagePath],
  );
  const closeAlbum = useCallback(() => {
    // A direct landing on this entry has nothing behind it to go back to.
    if (location.key === 'default') navigate(pagePath, { replace: true, state: null });
    else navigate(-1);
  }, [location.key, navigate, pagePath]);

  const handleAlbumClick = (event: MouseEvent<HTMLAnchorElement>, albumId: string) => {
    // Modified clicks keep the real link (new tab to Google Photos).
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    openAlbum(albumId);
  };

  const useSummerGalleryEmptyState = shouldUseSummerEmptyState(albums.length > 0);
  const summerGalleryMessage = getSummerBreakMessage('gallery');

  const isDegraded = isSupabaseUnavailable(error);

  if (loading) return <GallerySkeleton />;
  
  if (isDegraded) {
    return (
      <>
        <PageTitle title="Gallery" />
        <DegradedModeBanner sourceName="gallery" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title="Gallery temporarily unavailable"
            message={FALLBACK_GALLERY.message}
            actionLabel="View on Instagram"
            actionHref={FALLBACK_LINKS.instagram}
          />
        </div>
      </>
    );
  }

  if (error) return <PageError message="Failed to load gallery" />;

  return (
    <>
      <PageTitle title="Gallery" />
      {/* Degraded mode banner already handled above with full page fallback */}

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-gold mb-4">Memory Wall</span>
          <h1 className="vsa-page-title">Gallery</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            {totalCount} albums from GBMs, retreats, cultural programs, and VSA traditions.
          </p>
        </div>
      </div>

      <div className="vsa-container py-10">
        {albums.length === 0 ? (
          <div className="scrapbook-empty" role="status">
            {useSummerGalleryEmptyState ? (
              <div className="mx-auto max-w-xl space-y-3 text-center">
                <span className="scrapbook-sticker scrapbook-sticker-gold inline-flex">
                  {summerGalleryMessage.badge}
                </span>
                <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--text)' }}>
                  {summerGalleryMessage.title}
                </p>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
                  {summerGalleryMessage.body}
                </p>
              </div>
            ) : (
              <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>No albums yet. Check back soon.</p>
            )}
          </div>
        ) : (
          <>
            <motion.div 
              variants={shouldReduceMotion ? undefined : containerVariants}
              initial={shouldReduceMotion ? false : 'hidden'}
              whileInView={shouldReduceMotion ? undefined : 'show'}
              viewport={{ once: true, margin: '-20px' }}
              className="gallery-memory-wall"
            >
              {albums.map((album, index) => {
                // Cards render the 720px thumbnail only. Offering the 1400px cover in a srcset
                // would make hi-DPI phones download the larger file: more egress than before.
                const coverUrl = album.cover_thumbnail_url || album.cover_image_url;

                return (
                  <motion.a
                    key={album.id}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    href={album.google_photos_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${album.title}. Preview album`}
                    onClick={(event: MouseEvent<HTMLAnchorElement>) => handleAlbumClick(event, album.id)}
                    className="gallery-memory-card group block min-w-[82vw] snap-start transition-all hover:!rotate-0 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none sm:min-w-0"
                    style={getAlbumStyle(index)}
                    whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                  >
                    <div className="gallery-memory-image relative">
                      {coverUrl ? (
                        <>
                          <AlbumFallback />
                          <OptimizedImage
                            src={coverUrl}
                            width={520}
                            height={330}
                            // Mobile: 82vw swipe cards; 640-768px: two masonry columns;
                            // wider: 12-col grid, widest card spans 5/12 of a 1280px container.
                            sizes="(max-width: 639px) 82vw, (max-width: 768px) 50vw, (max-width: 1280px) 42vw, 512px"
                            widths={[360, 520, 720]}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                          />
                        </>
                      ) : (
                        <AlbumFallback />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
                        <span className="font-sans text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          Preview Album
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
                      <h2 className="truncate font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--text)' }}>
                        {album.title}
                      </h2>
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
                  </motion.a>
                );
              })}
            </motion.div>

            {openAlbumIndex >= 0 && (
              <AlbumLightbox
                albums={albums}
                index={openAlbumIndex}
                onIndexChange={showAlbumAt}
                onClose={closeAlbum}
              />
            )}

            {hasNextPage && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="vsa-btn-outline group relative min-w-[200px] overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isFetchingNextPage ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Loading...
                      </>
                    ) : (
                      'Load More Memories'
                    )}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
