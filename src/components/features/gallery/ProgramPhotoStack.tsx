import { type ReactNode } from 'react';
import { useQuery } from 'react-query';
import { OptimizedImage } from '../../common/OptimizedImage';
import { Skeleton } from '../../ui/Skeleton';
import { galleryRepository, type ProgramAlbum } from '../../../data/repos/gallery';
import { sanitizeHref } from '../../../utils/sanitizeUrl';
import { cn } from '../../../lib/utils';
import type { SiteEventType } from '../../../types/database';

/** The newest albums filed under these event types, for a program page hero. */
export function useProgramAlbums(eventTypes: SiteEventType[]) {
  return useQuery<ProgramAlbum[]>({
    queryKey: ['gallery', 'program-albums', eventTypes.join(',')],
    queryFn: () => galleryRepository.getProgramAlbums(eventTypes, 2),
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

function albumYear(date: string): string {
  return date.slice(0, 4);
}

// Two overlapping Polaroids, or one when only one album exists.
const placements = {
  single: ['left-[6%] top-[4%] w-[86%] -rotate-[2deg]'],
  pair: [
    'left-0 top-0 w-[74%] -rotate-[2.5deg]',
    'bottom-0 right-0 z-10 w-[58%] rotate-[3deg]',
  ],
};

function AlbumPolaroid({ album, className }: { album: ProgramAlbum; className: string }) {
  return (
    <a
      href={sanitizeHref(album.google_photos_url)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${album.title} photo album (opens Google Photos)`}
      className={cn(
        'home-editorial-polaroid group absolute block p-2 pb-9 transition-transform duration-300 ease-out hover:rotate-0 hover:scale-[1.02] focus-visible:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ed-ink motion-reduce:transition-none motion-reduce:hover:scale-100',
        className,
      )}
    >
      <OptimizedImage
        src={album.cover_thumbnail_url || album.cover_image_url}
        alt=""
        width={520}
        height={390}
        sizes="(min-width: 1024px) 320px, 70vw"
        className="aspect-[4/3] w-full bg-figma-mist object-cover"
        fallback={<div className="aspect-[4/3] w-full bg-figma-mist" />}
      />
      <span className="mt-2.5 flex items-baseline justify-between gap-3 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]">
        <span className="truncate">{album.title}</span>
        <span className="shrink-0">
          {albumYear(album.date)} <span aria-hidden="true">↗</span>
        </span>
      </span>
    </a>
  );
}

/**
 * Real event photography for a program hero, in the homepage's Polaroid
 * language. Renders skeleton frames while loading and nothing when there is
 * no album (or the read fails): a program page never shows a stock image.
 */
export function ProgramPhotoStack({
  albums,
  isLoading,
  label,
}: {
  albums: ProgramAlbum[] | undefined;
  isLoading: boolean;
  label: string;
}) {
  if (isLoading) {
    return (
      // Desktop only: beside the title it holds the layout steady; on phones it
      // would push the page down and then vanish if the program has no album.
      <div aria-hidden="true" className="relative hidden aspect-[7/6] w-full lg:block">
        <Skeleton className="absolute left-0 top-0 aspect-[4/3] w-[74%] -rotate-[2.5deg]" />
        <Skeleton className="absolute bottom-[8%] right-0 aspect-[4/3] w-[58%] rotate-[3deg]" />
      </div>
    );
  }
  if (!albums || albums.length === 0) return null;

  const shown = albums.slice(0, 2);
  const slots = shown.length === 1 ? placements.single : placements.pair;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('relative w-full', shown.length === 1 ? 'aspect-[4/3]' : 'aspect-[7/6]')}
    >
      {shown.map((album, index) => (
        <AlbumPolaroid key={album.id} album={album} className={slots[index]} />
      ))}
    </div>
  );
}

/**
 * The hero `media` for a program page: the photo stack while it loads or when
 * albums exist, otherwise undefined so the hero keeps its full-width layout.
 */
export function useProgramHeroMedia(eventTypes: SiteEventType[], label: string): ReactNode | undefined {
  const { data, isLoading } = useProgramAlbums(eventTypes);
  if (!isLoading && !data?.length) return undefined;
  return <ProgramPhotoStack albums={data} isLoading={isLoading} label={label} />;
}
