import { useInfiniteQuery, useQuery } from 'react-query';
import { galleryRepository, GalleryAlbum } from '../data/repos/gallery';

export const GALLERY_PAGE_SIZE = 12;

export function useGallery() {
  return useInfiniteQuery<GalleryAlbum[]>({
    queryKey: ['gallery'],
    queryFn: ({ pageParam = 0 }) => 
      galleryRepository.getAlbums({ 
        limit: GALLERY_PAGE_SIZE, 
        offset: pageParam * GALLERY_PAGE_SIZE 
      }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === GALLERY_PAGE_SIZE ? allPages.length : undefined;
    },
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
