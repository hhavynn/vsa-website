import { useQuery } from 'react-query';
import { ApplicationLink, PublicApplicationLink } from '../types';
import { applicationLinksRepository } from '../data/repos/applicationLinks';

export const ADMIN_APPLICATION_LINKS_QUERY_KEY = ['application-links', 'admin'];
export const PUBLIC_APPLICATION_LINKS_QUERY_KEY = ['application-links', 'public'];

export function useAdminApplicationLinks() {
  const {
    data: links = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<ApplicationLink[]>({
    queryKey: ADMIN_APPLICATION_LINKS_QUERY_KEY,
    queryFn: () => applicationLinksRepository.listAdminApplicationLinks(),
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
  });

  return { links, loading, error, refetch };
}

/**
 * Fetches every public-safe application link once and caches it. The table is
 * tiny, so a single query backs all CTA blocks across the site (filtered by key
 * client-side) instead of one request per button.
 */
export function usePublicApplicationLinks() {
  const {
    data: links = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<PublicApplicationLink[]>({
    queryKey: PUBLIC_APPLICATION_LINKS_QUERY_KEY,
    queryFn: () => applicationLinksRepository.getPublicApplicationLinks(),
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });

  return { links, loading, error, refetch };
}
