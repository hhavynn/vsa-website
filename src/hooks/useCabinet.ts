import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';

const CABINET_MEMBER_FIELDS =
  'id, name, role, category, display_order, image_url, thumbnail_url, year, college, major, minor, pronouns, favorite_snack, fun_fact, cabinet_year_id, created_at';

export interface CabinetMemberRaw {
  id: string;
  name: string;
  role: string;
  category: string;
  display_order: number;
  image_url: string | null;
  thumbnail_url: string | null;
  year: string | null;
  college: string | null;
  major: string | null;
  minor: string | null;
  pronouns: string | null;
  favorite_snack: string | null;
  fun_fact: string | null;
  cabinet_year_id: string | null;
}

export function useCabinetMemberYearIds() {
  return useQuery({
    queryKey: ['cabinet-member-year-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('cabinet_year_id');
      if (error) throw error;
      const yearIds = new Set<string>();
      let hasNullYear = false;
      for (const row of data ?? []) {
        if (row.cabinet_year_id) yearIds.add(row.cabinet_year_id);
        else hasNullYear = true;
      }
      return { yearIds: Array.from(yearIds), hasLegacyMembers: hasNullYear };
    },
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
  });
}

export function useCabinetMembers(yearId: string | null, includeLegacy: boolean) {
  return useQuery({
    queryKey: ['cabinet-members', yearId, includeLegacy],
    queryFn: async () => {
      if (!yearId) return [];

      const [yearResult, legacyResult] = await Promise.all([
        supabase
          .from('cabinet_members')
          .select(CABINET_MEMBER_FIELDS)
          .eq('cabinet_year_id', yearId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true }),
        includeLegacy
          ? supabase
              .from('cabinet_members')
              .select(CABINET_MEMBER_FIELDS)
              .is('cabinet_year_id', null)
              .order('display_order', { ascending: true })
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (yearResult.error) throw yearResult.error;
      if (legacyResult.error) throw legacyResult.error;

      return [
        ...((yearResult.data ?? []) as CabinetMemberRaw[]),
        ...((legacyResult.data ?? []) as CabinetMemberRaw[]),
      ].sort((a, b) => {
        const byOrder = (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER);
        return byOrder !== 0 ? byOrder : a.name.localeCompare(b.name);
      });
    },
    enabled: !!yearId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
  });
}
