import type { CSSProperties } from 'react';

import { Skeleton } from '../ui/Skeleton';

/**
 * Content-shaped loading skeletons for the highest-traffic data pages.
 * Each one reuses the page's real layout classes (vsa-page-hero,
 * vsa-container, gallery-memory-wall, etc.) so swapping in real content
 * causes no layout shift. Shimmer respects prefers-reduced-motion via the
 * shared `.skeleton-shimmer` CSS.
 */

function HeroSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="vsa-page-hero">
      <div className="vsa-container relative z-10">
        <Skeleton className="mb-4 h-6 w-32 rounded-full" />
        <Skeleton className="mb-4 h-12 w-2/3 max-w-md" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="mt-2 h-4 w-full max-w-xl" />
        ))}
      </div>
    </div>
  );
}

function FilterBarSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full" />
      ))}
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="vsa-container pt-8">
        <FilterBarSkeleton count={4} />
      </div>
      <div className="vsa-container py-8">
        <div className="grid gap-6 md:grid-cols-3 md:items-end">
          {[2, 1, 3].map((rank) => (
            <div key={rank} className={rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1' : 'md:order-3'}>
              <div className="scrapbook-paper flex flex-col items-center p-6" style={{ borderColor: 'var(--color-border)' }}>
                <Skeleton className="mb-4 h-24 w-24 rounded-full" />
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="h-12 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="scrapbook-paper flex items-center gap-4 p-4" style={{ borderColor: 'var(--color-border)' }}>
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Mirrors the real albumPatterns rotation in Gallery.tsx so skeleton cards
// take on the same --album-image-height/--album-span the real cards would,
// preventing layout shift when content swaps in.
const GALLERY_SKELETON_PATTERNS = [
  { height: '236px', span: 4 },
  { height: '292px', span: 4 },
  { height: '210px', span: 4 },
  { height: '256px', span: 5 },
  { height: '238px', span: 3 },
];

export function GallerySkeleton() {
  return (
    <>
      <HeroSkeleton lines={1} />
      <div className="vsa-container py-10">
        <div className="gallery-memory-wall">
          {Array.from({ length: 8 }).map((_, i) => {
            const pattern = GALLERY_SKELETON_PATTERNS[i % GALLERY_SKELETON_PATTERNS.length];
            const style = {
              '--album-image-height': pattern.height,
              '--album-span': String(pattern.span),
            } as CSSProperties;
            return (
              <div key={i} className="gallery-memory-card" style={style}>
                <div className="gallery-memory-image">
                  <Skeleton className="h-full w-full rounded-none" />
                </div>
                <div className="gallery-memory-caption space-y-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/**
 * Body-only skeleton for Cabinet — the page hero renders unconditionally
 * (real title/year selector), so only the member-list area below needs a
 * loading placeholder while cabinet years/members resolve.
 */
export function CabinetSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <Skeleton className="mb-8 h-6 w-40 rounded-full" />
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="scrapbook-paper flex items-center gap-4 p-5" style={{ borderColor: 'var(--color-border)' }}>
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <>
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Skeleton className="mb-4 h-6 w-24 rounded-full" />
          <Skeleton className="mb-4 h-12 w-1/2 max-w-xs" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <FilterBarSkeleton count={3} />
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        <Skeleton className="mb-5 h-4 w-24" />
        <div className="scrapbook-paper mb-9 flex flex-col-reverse overflow-hidden lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)]" style={{ borderColor: 'var(--color-border)' }}>
          <div className="space-y-3 p-6 sm:p-8">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-[220px] w-full lg:h-auto" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="scrapbook-paper space-y-3 p-5" style={{ borderColor: 'var(--color-border)' }}>
              <Skeleton className="h-32 w-full rounded" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
