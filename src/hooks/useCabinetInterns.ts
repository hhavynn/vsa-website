import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';
import { getCurrentCabinetYear } from '../lib/cabinetYears';
import { useCabinetYears } from './useCabinetYears';

export interface CabinetIntern {
  id: string;
  name: string;
  role: string;
  display_order: number;
  image_url: string | null;
  cabinet_year_id: string | null;
}

const CABINET_INTERN_FIELDS = 'id, name, role, display_order, image_url, cabinet_year_id, created_at';

export function useCurrentCabinetInterns() {
  const { cabinetYears, loading: yearsLoading, error: yearsError } = useCabinetYears();
  const currentCabinetYear = getCurrentCabinetYear(cabinetYears);

  const {
    data = [],
    isLoading: internsLoading,
    error: internsError,
    refetch,
  } = useQuery<CabinetIntern[]>({
    queryKey: ['cabinet-interns', currentCabinetYear?.id ?? null],
    queryFn: async () => {
      if (!currentCabinetYear?.id) return [];

      const { data, error } = await supabase
        .from('cabinet_members')
        .select(CABINET_INTERN_FIELDS)
        .eq('cabinet_year_id', currentCabinetYear.id)
        .eq('category', 'Interns')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Using empty cabinet intern cohort:', error.message);
        return [];
      }

      return (data ?? []) as CabinetIntern[];
    },
    enabled: !yearsLoading,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return {
    interns: data,
    cabinetYear: currentCabinetYear,
    loading: yearsLoading || internsLoading,
    error: yearsError ?? internsError,
    refetch,
  };
}
