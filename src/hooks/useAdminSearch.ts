import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { adminSearchRepository } from '../data/repos/adminSearch';
import { AdminSearchRecord, AdminSearchResult, pageRecords, searchAdmin } from '../lib/adminSearch';

export const ADMIN_SEARCH_QUERY_KEY = ['admin-search-index'] as const;

/**
 * The admin Quick Search index. It only loads once `enabled` (the palette is
 * open), is admin-gated by the routes that mount it, and expires from the
 * cache after a few minutes. Admin pages are always searchable, even before
 * (or without) the record index.
 */
export function useAdminSearch(query: string, enabled: boolean) {
  const { data, isLoading, isError } = useQuery<AdminSearchRecord[]>({
    queryKey: ADMIN_SEARCH_QUERY_KEY,
    queryFn: () => adminSearchRepository.loadRecords(),
    enabled,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const records = useMemo(() => data ?? pageRecords(), [data]);
  const results: AdminSearchResult[] = useMemo(() => searchAdmin(records, query), [records, query]);
  return { results, loading: enabled && isLoading, failed: isError };
}
