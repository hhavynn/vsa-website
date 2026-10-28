import { type TouchEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BottomSheet } from '../../ui/BottomSheet';
import { OptimizedImage } from '../../common/OptimizedImage';
import { formatDateOnly } from '../../../lib/dateOnly';
import { getAlbumEventLink } from '../../../lib/eventGalleryLinks';
import type { GalleryAlbum } from '../../../data/repos/gallery';

// Horizontal travel / dominance needed to count a touch as a deliberate swipe
// (and not a vertical scroll of the sheet).
const SWIPE_MIN_DISTANCE = 48;
const SWIPE_AXIS_RATIO = 1.5;
const MAX_ZOOM = 3;

const pinchDistance = (touches: React.TouchList) => {
  const a = touches[0], b = touches[1];
  return a && b ? Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) : 0;
};

export function AlbumFallback({ caption }: { caption?: string }) {
  return (
    <div className="gallery-memory-fallback">
      <svg className="h-10 w-10" style={{ color: 'var(--text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="font-serif text-2xl italic" style={{ color: 'var(--text)' }}>VSA</span>
      {caption && (
        <span className="px-4 text-center font-sans text-xs" style={{ color: 'var(--text3)' }}>
          {caption}
        </span>
      )}
    </div>
  );
}

export interface AlbumLightboxProps {
  albums: GalleryAlbum[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  nextPageError?: unknown | null;
  onFetchNextPage?: () => void;
  totalCount?: number | null;
}

/**
 * Album quick-look. Built on BottomSheet so focus trap, Escape, scroll lock,
 * inert background and focus restore are the site's existing dialog behavior.
 * The caller owns open state (browser history), so Back closes it; this adds
 * swipe + arrow-key paging between albums, a thumb-reachable bottom bar, and a
 * graceful fallback when a cover is missing or fails to load.
 * Now seamlessly navigates across unloaded album pages when hasNextPage is true.
 */
export function AlbumLightbox({
  albums,
  index,
  onIndexChange,
  onClose,
  hasNextPage = false,
  isFetchingNextPage = false,
  nextPageError = null,
  onFetchNextPage,
  totalCount,
}: AlbumLightboxProps) {
  const album = albums[index];
  const reduceMotion = useReducedMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressSwipe = useRef(false);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // -1 = went to previous, 1 = went to next; drives the slide-in direction.
  const direction = useRef(0);

  const pendingAdvanceFromIndexRef = useRef<number | null>(null);
  const prevAlbumsCount = useRef(albums.length);

  // When next page loads and user requested to advance from the boundary, move to next album
  // only if the user is still at that boundary album
  useEffect(() => {
    if (
      albums.length > prevAlbumsCount.current &&
      pendingAdvanceFromIndexRef.current !== null
    ) {
      const fromIndex = pendingAdvanceFromIndexRef.current;
      pendingAdvanceFromIndexRef.current = null;
      if (index === fromIndex) {
        onIndexChange(fromIndex + 1);
      }
    }
    prevAlbumsCount.current = albums.length;
  }, [albums.length, index, onIndexChange]);

  // Cancel pending advance on error so it does not linger stale for later fetches
  useEffect(() => {
    if (nextPageError) {
      pendingAdvanceFromIndexRef.current = null;
    }
  }, [nextPageError]);

  // Proactive prefetch as user approaches boundary
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      !nextPageError &&
      onFetchNextPage &&
      index >= albums.length - 2
    ) {
      onFetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, nextPageError, onFetchNextPage, index, albums.length]);

  // Never carry zoom/pan into a different album, including history navigation.
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    pinch.current = null;
    pan.current = null;
    suppressSwipe.current = false;
  }, [album?.id]);

  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    pinch.current = null;
    pan.current = null;
  };

  const handleImageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const distance = pinchDistance(event.touches);
      if (distance > 0) pinch.current = { distance, scale: zoom };
      touchStart.current = null;
      suppressSwipe.current = true;
      pan.current = null;
    } else if (event.touches.length === 1 && zoom > 1) {
      const touch = event.touches[0];
      pan.current = { x: touch.clientX, y: touch.clientY, startX: offset.x, startY: offset.y };
      suppressSwipe.current = true;
    }
  };

  const handleImageTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (pinch.current && event.touches.length === 2) {
      const distance = pinchDistance(event.touches);
      if (distance > 0) {
        const next = Math.min(MAX_ZOOM, Math.max(1, pinch.current.scale * distance / pinch.current.distance));
        setZoom(next);
        const bounds = event.currentTarget.getBoundingClientRect();
        const maxX = (bounds.width * (next - 1)) / 2;
        const maxY = (bounds.height * (next - 1)) / 2;
        // A smaller zoom also shrinks the legal pan extent.
        setOffset(current => ({
          x: Math.max(-maxX, Math.min(maxX, current.x)),
          y: Math.max(-maxY, Math.min(maxY, current.y)),
        }));
      }
      if (event.cancelable) event.preventDefault();
    } else if (pan.current && event.touches.length === 1 && zoom > 1) {
      const touch = event.touches[0];
      const bounds = event.currentTarget.getBoundingClientRect();
      const maxX = (bounds.width * (zoom - 1)) / 2;
      const maxY = (bounds.height * (zoom - 1)) / 2;
      setOffset({
        x: Math.max(-maxX, Math.min(maxX, pan.current.startX + touch.clientX - pan.current.x)),
        y: Math.max(-maxY, Math.min(maxY, pan.current.startY + touch.clientY - pan.current.y)),
      });
      if (event.cancelable) event.preventDefault();
    }
  };

  const handleImageTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinch.current = null;
    if (event.touches.length === 0) pan.current = null;
  };

  const hasPrev = index > 0;
  const hasNext = index < albums.length - 1 || Boolean(hasNextPage);

  const handleClose = useCallback(() => {
    pendingAdvanceFromIndexRef.current = null;
    onClose();
  }, [onClose]);

  const go = useCallback(
    (delta: -1 | 1) => {
      if (delta === -1) {
        // Cancel any pending boundary advance when navigating backward
        pendingAdvanceFromIndexRef.current = null;
        const target = index - 1;
        if (target < 0) return;
        direction.current = -1;
        onIndexChange(target);
        return;
      }

      // delta === 1 (Next)
      if (index < albums.length - 1) {
        pendingAdvanceFromIndexRef.current = null;
        direction.current = 1;
        onIndexChange(index + 1);
        return;
      }

      // At boundary
      if (hasNextPage) {
        direction.current = 1;
        pendingAdvanceFromIndexRef.current = index;
        if (nextPageError || !isFetchingNextPage) {
          onFetchNextPage?.();
        }
      }
    },
    [albums.length, hasNextPage, index, isFetchingNextPage, nextPageError, onFetchNextPage, onIndexChange],
  );

  // Keep the key handler stable across re-renders while always seeing fresh `go`.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft') goRef.current(-1);
      else if (event.key === 'ArrowRight') goRef.current(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!album) return null;

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || zoom > 1 || suppressSwipe.current) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (suppressSwipe.current || zoom > 1) {
      suppressSwipe.current = false;
      return;
    }
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;
    go(dx < 0 ? 1 : -1);
  };

  const coverUrl = album.cover_image_url || album.cover_thumbnail_url;
  // Only offer the small file as a srcset candidate when it is a different file.
  const thumbnail =
    album.cover_image_url && album.cover_thumbnail_url && album.cover_thumbnail_url !== album.cover_image_url
      ? { src: album.cover_thumbnail_url, width: 720 }
      : null;
  const eventLink = getAlbumEventLink(album);

  const counterLabel =
    totalCount && totalCount > albums.length
      ? `${index + 1} / ${totalCount}`
      : hasNextPage
      ? `${index + 1} / ${albums.length}+`
      : `${index + 1} / ${albums.length}`;

  return (
    <BottomSheet
      onClose={handleClose}
      ariaLabel="Album preview"
      className="border border-[var(--border)] bg-[var(--surface)] sm:max-w-3xl"
    >
      <div
        className="touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-testid="album-swipe-area"
      >
        <motion.div
          key={album.id}
          initial={reduceMotion ? false : { opacity: 0, x: direction.current * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="relative mx-4 mt-1 aspect-[3/2] overflow-hidden rounded bg-[var(--surface2)] sm:mx-6 sm:mt-4"
            
            onTouchStart={handleImageTouchStart}
            onTouchMove={handleImageTouchMove}
            onTouchEnd={handleImageTouchEnd}
            onTouchCancel={handleImageTouchEnd}
            data-testid="album-zoom-area"
          >
            <OptimizedImage
              src={coverUrl}
              srcWidth={album.cover_image_url ? 1400 : undefined}
              lowRes={thumbnail}
              width={1400}
              height={933}
              sizes="(max-width: 639px) 100vw, 720px"
              alt={`Cover photo for ${album.title}`}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: 'center', transition: pinch.current || pan.current ? 'none' : 'transform 120ms ease-out' }}
              fallback={<AlbumFallback caption="Cover photo unavailable" />}
            />
          </div>
          {coverUrl && (
            <div className="mx-4 mt-2 flex min-h-11 items-center justify-between gap-2 sm:mx-6">
              <span className="font-sans text-[11px] text-[var(--text3)]">
                Pinch to zoom · {Math.round(zoom * 100)}%
              </span>
              {zoom > 1 && (
                <button type="button" onClick={resetZoom} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)]">
                  Reset photo zoom
                </button>
              )}
            </div>
          )}

          <div className="px-4 pb-2 pt-4 sm:px-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="scrapbook-sticker scrapbook-sticker-gold">
                {formatDateOnly(album.date, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </span>
              <span className="font-mono text-[11px] font-bold text-[var(--text3)]" aria-live="polite">
                {counterLabel}
              </span>
            </div>
            <h2 className="break-words font-serif text-xl font-bold leading-tight text-[var(--text)]">{album.title}</h2>
            {album.description && (
              <p className="mt-1.5 line-clamp-3 font-sans text-sm leading-relaxed text-[var(--text2)]">
                {album.description}
              </p>
            )}
            {eventLink && (
              <p className="mt-3 font-sans text-sm text-[var(--text2)]">
                Related event:{' '}
                <Link
                  to={eventLink.to}
                  className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400"
                >
                  {eventLink.label}
                </Link>
              </p>
            )}
            <a
              href={album.google_photos_url}
              target="_blank"
              rel="noopener noreferrer"
              className="vsa-btn-primary mt-4 flex min-h-[48px] w-full items-center justify-center text-center"
            >
              Open full album in Google Photos
            </a>
          </div>
        </motion.div>
      </div>

      {/* Bottom bar: Close sits in the centre, reachable by either thumb. */}
      <div className="sticky bottom-0 mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!hasPrev}
          aria-label="Previous album"
          className="min-h-[48px] rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 font-sans text-sm font-semibold text-[var(--text)] disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="min-h-[48px] min-w-[96px] rounded-lg bg-[var(--text)] px-5 font-sans text-sm font-semibold text-[var(--surface)]"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!hasNext}
          aria-label={
            nextPageError && index === albums.length - 1
              ? 'Retry loading next album'
              : 'Next album'
          }
          className="min-h-[48px] rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 font-sans text-sm font-semibold text-[var(--text)] disabled:opacity-40"
        >
          {isFetchingNextPage && index === albums.length - 1 && pendingAdvanceFromIndexRef.current === index ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </span>
          ) : nextPageError && index === albums.length - 1 ? (
            'Retry →'
          ) : (
            'Next →'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
