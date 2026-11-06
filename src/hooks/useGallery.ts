import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  galleryRepository,
  GalleryCursor,
} from '../data/repos/gallery';

export const GALLERY_PAGE_SIZE = 12;

export interface UseGalleryOptions {
  year?: number | null;
  search?: string;
}

export function useGallery(options: UseGalleryOptions = {}) {
  const { year, search } = options;
  const trimmedSearch = search?.trim() || '';

  // Academic year date range (Sept 1 to Aug 31 of next year)
  const dateBounds = year
    ? {
        date_from: `${year}-09-01`,
        date_to: `${year + 1}-08-31`,
      }
    : {};

  return useInfiniteQuery({
    queryKey: ['gallery', { year: year ?? null, search: trimmedSearch }],
    initialPageParam: null as GalleryCursor | null,
    queryFn: ({ pageParam }) =>
      galleryRepository.getAlbumPage({
        limit: GALLERY_PAGE_SIZE,
        cursor: pageParam,
        ...dateBounds,
        search: trimmedSearch,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGalleryStats() {
  return useQuery({
    queryKey: ['gallery-stats'],
    queryFn: () => galleryRepository.getAlbumCount(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useGalleryYears() {
  return useQuery({
    queryKey: ['gallery-years'],
    queryFn: () => galleryRepository.getAlbumYears(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useGalleryFilteredCount(options: UseGalleryOptions = {}) {
  const { year, search } = options;
  const trimmedSearch = search?.trim() || '';
  const dateBounds = year
    ? {
        date_from: `${year}-09-01`,
        date_to: `${year + 1}-08-31`,
      }
    : {};

  return useQuery({
    queryKey: ['gallery-filtered-count', { year: year ?? null, search: trimmedSearch }],
    queryFn: () =>
      galleryRepository.getFilteredAlbumCount({
        ...dateBounds,
        search: trimmedSearch,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(year || trimmedSearch),
  });
}
