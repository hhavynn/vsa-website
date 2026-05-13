import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PRESIDENTS_CONTENT,
  PRESIDENTS_CONTENT_ID,
  PresidentsContent,
} from '../data/presidentsContent';

export const PRESIDENTS_CONTENT_QUERY_KEY = ['homepage-content', PRESIDENTS_CONTENT_ID] as const;

export function normalizePresidentsContent(row: any): PresidentsContent {
  return {
    names: row?.presidents_names || DEFAULT_PRESIDENTS_CONTENT.names,
    role: row?.presidents_role || DEFAULT_PRESIDENTS_CONTENT.role,
    message: row?.presidents_message || DEFAULT_PRESIDENTS_CONTENT.message,
    photoUrl: row?.presidents_photo_url || '',
  };
}

async function fetchPresidentsContent(): Promise<PresidentsContent> {
  const { data, error } = await supabase
    .from('homepage_content')
    .select('*')
    .eq('id', PRESIDENTS_CONTENT_ID)
    .maybeSingle();

  if (error) {
    console.warn('Using default presidents content:', error.message);
    return DEFAULT_PRESIDENTS_CONTENT;
  }

  return normalizePresidentsContent(data);
}

export function usePresidentsContent() {
  const { data, isLoading, error, refetch } = useQuery<PresidentsContent>({
    queryKey: PRESIDENTS_CONTENT_QUERY_KEY,
    queryFn: fetchPresidentsContent,
    placeholderData: DEFAULT_PRESIDENTS_CONTENT,
    staleTime: 30 * 1000,
  });

  return {
    content: data ?? DEFAULT_PRESIDENTS_CONTENT,
    loading: isLoading,
    error,
    refetch,
  };
}
