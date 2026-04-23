import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PRESIDENTS_CONTENT,
  PRESIDENTS_CONTENT_ID,
  PresidentsContent,
} from '../data/presidentsContent';

function normalizePresidentsContent(row: any): PresidentsContent {
  return {
    names: row?.presidents_names || DEFAULT_PRESIDENTS_CONTENT.names,
    role: row?.presidents_role || DEFAULT_PRESIDENTS_CONTENT.role,
    message: row?.presidents_message || DEFAULT_PRESIDENTS_CONTENT.message,
    photoUrl: row?.presidents_photo_url || '',
  };
}

export function usePresidentsContent() {
  const [content, setContent] = useState<PresidentsContent>(DEFAULT_PRESIDENTS_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchContent() {
      try {
        const result = await supabase
          .from('homepage_content')
          .select('*')
          .eq('id', PRESIDENTS_CONTENT_ID)
          .single();
        const { data, error } = result ?? {};

        if (error) {
          console.warn('Using default presidents content:', error.message);
          return;
        }

        if (data && isMounted) {
          setContent(normalizePresidentsContent(data));
        }
      } catch (error) {
        console.warn('Using default presidents content:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchContent();

    return () => {
      isMounted = false;
    };
  }, []);

  return { content, loading };
}
