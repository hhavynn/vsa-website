import { type CSSProperties, type MouseEvent, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDateOnly } from '../lib/dateOnly';
import { cn } from '../lib/utils';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { PageTitle } from '../components/common/PageTitle';
import { GalleryWallSkeleton } from '../components/common/PageSkeletons';
import { PageError } from '../components/common/PageError';
import {
  useGallery,
  useGalleryStats,
  useGalleryYears,
  useGalleryFilteredCount,
} from '../hooks/useGallery';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../utils/seasonalState';
import { motion, useReducedMotion } from 'framer-motion';
import { AlbumFallback, AlbumLightbox } from '../components/features/gallery/AlbumLightbox';
import { GalleryFilters } from '../components/features/gallery/GalleryFilters';
import { GalleryLoadMore } from '../components/features/gallery/GalleryLoadMore';
import { GalleryHeroContactSheet, hasContactSheetCovers } from '../components/features/gallery/GalleryHeroContactSheet';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { FALLBACK_GALLERY, FALLBACK_LINKS } from '../config/publicFallbackContent';

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
  const [searchParams, setSearchParams] = useSearchParams();

  const rawYear = searchParams.get('year');
  const selectedYear = rawYear && /^\d{4}$/.test(rawYear) ? parseInt(rawYear, 10) : null;
  const searchQuery = searchParams.get('search') ?? '';

  const { 
    data, 
    isLoading: loading, 
    error, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useGallery({ year: selectedYear, search: searchQuery });
  
  const { data: totalCount = 0 } = useGalleryStats();
  const { data: years = [] } = useGalleryYears();
  const { data: filteredCount = null, isLoading: countLoading } = useGalleryFilteredCount({
    year: selectedYear,
    search: searchQuery,
  });

  const isFiltered = Boolean(selectedYear || searchQuery.trim());

  const handleYearChange = useCallback(
    (year: number | null) => {
      const nextParams = new URLSearchParams(searchParams);
      if (year) {
        nextParams.set('year', String(year));
      } else {
        nextParams.delete('year');
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSearchChange = useCallback(
    (search: string) => {
      const nextParams = new URLSearchParams(searchParams);
      const trimmed = search.trim();
      if (trimmed) {
        nextParams.set('search', trimmed);
      } else {
        nextParams.delete('search');
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('year');
    nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const albums = useMemo(() => {
    return data?.pages.flatMap((page) => ('albums' in page ? page.albums : page)) ?? [];
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
  const showContactSheet = !isFiltered && hasContactSheetCovers(albums);
  const summerGalleryMessage = getSummerBreakMessage('gallery');

  const hasLoadedAlbums = Boolean(data?.pages && data.pages.length > 0 && albums.length > 0);
  const isInitialLoading = loading && !data;
  const isInitialError = Boolean(error && !hasLoadedAlbums);
  const nextPageError = error && hasLoadedAlbums ? error : null;

  const isDegraded = isSupabaseUnavailable(error);

  if (isInitialError && isDegraded) {
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

  if (isInitialError && !isFiltered) return <PageError message="Failed to load gallery" />;

  return (
    <>
      <PageTitle title="Gallery" />
      {/* Degraded mode banner already handled above with full page fallback */}

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-gold mb-4">Memory Wall</span>
          <h1 className="vsa-page-title">Gallery</h1>
          <p className={cn('mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]', showContactSheet && 'lg:max-w-[min(42rem,calc(100%-min(40vw,520px)-3rem))]')} style={{ color: 'var(--text2)' }}>
            {isFiltered
              ? 'Showing memory wall matches from GBMs, retreats, cultural programs, and VSA traditions.'
              : `${totalCount} albums from GBMs, retreats, cultural programs, and VSA traditions.`}
          </p>
          {showContactSheet && <GalleryHeroContactSheet albums={albums} />}
        </div>
      </div>

      <div className="vsa-container py-10">
        <GalleryFilters
          years={years}
          selectedYear={selectedYear}
          onYearChange={handleYearChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onReset={handleResetFilters}
          totalFilteredCount={filteredCount}
          isFiltered={isFiltered}
          isLoading={countLoading || isInitialLoading}
        />

        {isInitialLoading ? (
          <GalleryWallSkeleton />
        ) : isInitialError ? (
          <div className="scrapbook-empty" role="alert">
            <div className="mx-auto max-w-xl space-y-4 text-center">
              <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--text)' }}>
                Could not load matching memories
              </p>
              <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
                Please check your network connection or try clearing the filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="vsa-btn-ghost mx-auto"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : albums.length === 0 ? (
          <div className="scrapbook-empty" role="status">
            {isFiltered ? (
              <div className="mx-auto max-w-xl space-y-4 text-center">
                <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--text)' }}>
                  No albums matched your filters
                </p>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
                  Try searching with different keywords or clear the current filters to explore all memories.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="vsa-btn-ghost mx-auto"
                >
                  Clear filters
                </button>
              </div>
            ) : useSummerGalleryEmptyState ? (
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
            {albums.length > 1 && (
              <p
                className="mb-5 flex items-center gap-2 font-sans text-xs text-text-secondary sm:hidden"
                aria-label="Swipe horizontally to browse photo albums"
              >
                <span aria-hidden="true" className="font-mono text-base text-brand-600 dark:text-brand-400">← →</span>
                Swipe sideways to explore more memories
              </p>
            )}
            <div className="gallery-memory-wall">
              {albums.map((album, index) => {
                // Cards render the 720px thumbnail only. Offering the 1400px cover in a srcset
                // would make hi-DPI phones download the larger file: more egress than before.
                const coverUrl = album.cover_thumbnail_url || album.cover_image_url;

                return (
                  <motion.article
                    key={album.id}
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
                      <h2 className="min-w-0 break-words font-sans text-sm font-semibold leading-snug tracking-[-0.01em]" style={{ color: 'var(--text)' }}>
                        {/* The title is the link; its ::after stretches over the whole card, so the
                            accessible name ("<title>. Preview album") contains the visible text. */}
                        <a
                          href={album.google_photos_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${album.title}. Preview album`}
                          onClick={(event: MouseEvent<HTMLAnchorElement>) => handleAlbumClick(event, album.id)}
                          className="after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-600"
                        >
                          {album.title}
                        </a>
                      </h2>
                      {album.description && (
                        <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                          {album.description}
                        </p>
                      )}
                      {album.event && (
                        <p
                          className="mt-2 break-words font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em]"
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
                  </motion.article>
                );
              })}
            </div>

            {openAlbumIndex >= 0 && (
              <AlbumLightbox
                albums={albums}
                index={openAlbumIndex}
                onIndexChange={showAlbumAt}
                onClose={closeAlbum}
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                nextPageError={nextPageError}
                onFetchNextPage={fetchNextPage}
                totalCount={isFiltered ? filteredCount : totalCount}
              />
            )}

            <GalleryLoadMore
              hasNextPage={Boolean(hasNextPage)}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              nextPageError={nextPageError}
              totalLoaded={albums.length}
            />
          </>
        )}
      </div>
    </>
  );
}
