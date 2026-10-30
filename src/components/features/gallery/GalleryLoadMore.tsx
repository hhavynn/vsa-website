import { useEffect, useRef, useState } from 'react';

export interface GalleryLoadMoreProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  nextPageError: unknown | null;
  totalLoaded: number;
}

export function GalleryLoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  nextPageError,
  totalLoaded,
}: GalleryLoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const consecutiveAutoFetches = useRef(0);
  const [autoFetchPaused, setAutoFetchPaused] = useState(false);

  // Reset auto-fetch burst guard on user scroll
  useEffect(() => {
    const handleScroll = () => {
      if (consecutiveAutoFetches.current > 0) {
        consecutiveAutoFetches.current = 0;
        setAutoFetchPaused(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Stable ref for fetchNextPage
  const fetchRef = useRef(fetchNextPage);
  fetchRef.current = fetchNextPage;

  // IntersectionObserver for progressive scroll loading
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || nextPageError || autoFetchPaused) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Guard against infinite automatic loop on tall viewports:
          // allow up to 2 automatic bursts before requiring user scroll or click
          if (consecutiveAutoFetches.current >= 2) {
            setAutoFetchPaused(true);
            return;
          }
          consecutiveAutoFetches.current += 1;
          fetchRef.current();
        }
      },
      {
        rootMargin: '250px 0px', // start loading before user reaches bottom
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, nextPageError, autoFetchPaused, totalLoaded]);

  const handleManualLoad = () => {
    consecutiveAutoFetches.current = 0;
    setAutoFetchPaused(false);
    fetchNextPage();
  };

  if (!hasNextPage && totalLoaded > 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center sm:mt-16" role="status">
        <span className="scrapbook-sticker scrapbook-sticker-gold text-[10px] uppercase">
          Archive End
        </span>
        <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
          You've reached the end of the memory wall
        </p>
      </div>
    );
  }

  if (nextPageError) {
    return (
      <div
        className="mt-12 flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-6 text-center"
        role="alert"
      >
        <p className="font-sans text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Could not load more memories
        </p>
        <p className="max-w-md font-sans text-xs" style={{ color: 'var(--text3)' }}>
          Your connection may have dipped, or the service is temporarily slow.
        </p>
        <button
          type="button"
          onClick={handleManualLoad}
          className="vsa-btn-primary min-h-[44px] px-6 text-sm"
        >
          Retry loading memories
        </button>
      </div>
    );
  }

  if (!hasNextPage) {
    return null;
  }

  return (
    <div className="mt-14 flex flex-col items-center justify-center gap-4">
      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />

      {isFetchingNextPage ? (
        <div className="flex items-center gap-3 py-2" role="status" aria-live="polite">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-400" />
          <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
            Loading more memories...
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleManualLoad}
          aria-label="Load more memories"
          className="vsa-btn-ghost group relative min-w-[200px]"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Load More Memories
          </span>
        </button>
      )}
    </div>
  );
}
