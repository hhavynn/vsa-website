import { type TouchEvent, useCallback, useEffect, useRef } from 'react';
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

interface AlbumLightboxProps {
  albums: GalleryAlbum[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Album quick-look. Built on BottomSheet so focus trap, Escape, scroll lock,
 * inert background and focus restore are the site's existing dialog behavior.
 * The caller owns open state (browser history), so Back closes it; this adds
 * swipe + arrow-key paging between albums, a thumb-reachable bottom bar, and a
 * graceful fallback when a cover is missing or fails to load.
 */
export function AlbumLightbox({ albums, index, onIndexChange, onClose }: AlbumLightboxProps) {
  const album = albums[index];
  const reduceMotion = useReducedMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // -1 = went to previous, 1 = went to next; drives the slide-in direction.
  const direction = useRef(0);

  const hasPrev = index > 0;
  const hasNext = index < albums.length - 1;

  const go = useCallback(
    (delta: -1 | 1) => {
      const target = index + delta;
      if (target < 0 || target >= albums.length) return;
      direction.current = delta;
      onIndexChange(target);
    },
    [albums.length, index, onIndexChange],
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
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
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

  return (
    <BottomSheet
      onClose={onClose}
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
          <div className="relative mx-4 mt-1 aspect-[3/2] overflow-hidden rounded bg-[var(--surface2)] sm:mx-6 sm:mt-4">
            <OptimizedImage
              src={coverUrl}
              srcWidth={album.cover_image_url ? 1400 : undefined}
              lowRes={thumbnail}
              width={1400}
              height={933}
              sizes="(max-width: 639px) 100vw, 720px"
              alt={`Cover photo for ${album.title}`}
              className="absolute inset-0 h-full w-full object-contain"
              fallback={<AlbumFallback caption="Cover photo unavailable" />}
            />
          </div>

          <div className="px-4 pb-2 pt-4 sm:px-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="scrapbook-sticker scrapbook-sticker-gold">
                {formatDateOnly(album.date, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </span>
              <span className="font-mono text-[11px] font-bold text-[var(--text3)]" aria-live="polite">
                {index + 1} / {albums.length}
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
          onClick={onClose}
          className="min-h-[48px] min-w-[96px] rounded-lg bg-[var(--text)] px-5 font-sans text-sm font-semibold text-[var(--surface)]"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!hasNext}
          aria-label="Next album"
          className="min-h-[48px] rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 font-sans text-sm font-semibold text-[var(--text)] disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </BottomSheet>
  );
}
