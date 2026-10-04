import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { eventsRepository } from '../data/repos/events';
import { galleryRepository } from '../data/repos/gallery';
import {
  buildAlbumEntries,
  buildEventEntries,
  buildStaticEntries,
  type PublicSearchEntry,
} from '../lib/publicSearch';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';

export const PUBLIC_SEARCH_INDEX_KEY = ['public-search-index'] as const;

interface DynamicIndex {
  events: Awaited<ReturnType<typeof eventsRepository.getPublicSearchEntries>>;
  albums: Awaited<ReturnType<typeof galleryRepository.getPublicSearchAlbums>>;
  /** Which source(s) failed; the rest of the index is still usable. */
  failed: Array<'events' | 'albums'>;
}

/**
 * The search index: static pages immediately, plus ONE cached fetch each of
 * published events and public gallery albums. `enabled` defers the fetch until
 * the visitor actually opens search, so no page pays for it up front. Typing
 * never touches the network -- filtering is in memory (lib/publicSearch).
 */
export function usePublicSearchIndex(enabled: boolean) {
  const query = useQuery<DynamicIndex>({
    queryKey: PUBLIC_SEARCH_INDEX_KEY,
    queryFn: async () => {
      const [events, albums] = await Promise.allSettled([
        eventsRepository.getPublicSearchEntries(),
        galleryRepository.getPublicSearchAlbums(),
      ]);
      const failed: DynamicIndex['failed'] = [];
      if (events.status === 'rejected') failed.push('events');
      if (albums.status === 'rejected') failed.push('albums');
      return {
        events: events.status === 'fulfilled' ? events.value : [],
        albums: albums.status === 'fulfilled' ? albums.value : [],
        failed,
      };
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const entries = useMemo<PublicSearchEntry[]>(() => {
    const staticEntries = buildStaticEntries();
    if (!query.data) return staticEntries;
    return [
      ...staticEntries,
      ...buildEventEntries(query.data.events, getLosAngelesDateOnly()),
      ...buildAlbumEntries(query.data.albums),
    ];
  }, [query.data]);

  return {
    entries,
    /** True only while the first dynamic fetch is in flight. */
    loading: enabled && query.isLoading,
    failed: query.data?.failed ?? [],
  };
}
