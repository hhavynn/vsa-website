import { supabase } from '../../lib/supabase';
import { HousePageAsset } from '../../types';
import { withErrorHandling } from '../errors';

export type HousePageAssetFormData = Omit<HousePageAsset, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

function normalizeAssets(data: HousePageAsset[]): HousePageAsset[] {
  return data
    .map((asset) => ({
      ...asset,
      house_key: asset.house_key ?? asset.house,
      display_name: asset.display_name ?? asset.house,
      is_active: asset.is_active ?? true,
    }))
    .sort((a, b) => a.display_order - b.display_order);
}

export class HouseAssetsRepository {
  async getPublishedAssets(academicYearStart: number): Promise<HousePageAsset[]> {
    try {
      const { data, error } = await supabase
        .from('published_house_page_assets')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('display_order', { ascending: true });

      if (error) {
        console.warn('Using fallback house assets:', error.message);
        return [];
      }

      return normalizeAssets((data ?? []) as unknown as HousePageAsset[]);
    } catch (error) {
      console.warn('Using fallback house assets:', error);
      return [];
    }
  }

  async getAdminAssets(academicYearStart: number): Promise<HousePageAsset[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_page_assets')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return normalizeAssets((data ?? []) as HousePageAsset[]);
    }, 'Failed to fetch house page assets');
  }

  async upsertAsset(asset: HousePageAssetFormData): Promise<HousePageAsset> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_page_assets')
        .upsert(
          {
            ...asset,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'academic_year_start,house_key' },
        )
        .select('*')
        .single();

      if (error) throw error;
      return data as HousePageAsset;
    }, 'Failed to save house page asset');
  }
}

export const houseAssetsRepository = new HouseAssetsRepository();
