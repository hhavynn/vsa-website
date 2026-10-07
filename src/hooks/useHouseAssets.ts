import { useQuery } from 'react-query';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { HousePageAsset } from '../types';

// A shared empty list: a fresh `[]` default per render would re-fire effects
// keyed on `assets` (the admin House images editor re-seeds its drafts from them).
const NO_ASSETS: HousePageAsset[] = [];

export function usePublishedHouseAssets(academicYearStart: number | null) {
  const {
    data: assets = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<HousePageAsset[]>({
    queryKey: ['house-assets', 'published', academicYearStart],
    queryFn: () => academicYearStart ? houseAssetsRepository.getPublishedAssets(academicYearStart) : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 5 * 60 * 1000,
  });

  return { assets, loading, error, refetch };
}

export function useAdminHouseAssets(academicYearStart: number | null) {
  const {
    data: assets = NO_ASSETS,
    isLoading: loading,
    error,
    refetch,
  } = useQuery<HousePageAsset[]>({
    queryKey: ['house-assets', 'admin', academicYearStart],
    queryFn: () => academicYearStart ? houseAssetsRepository.getAdminAssets(academicYearStart) : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 30 * 1000,
  });

  return { assets, loading, error, refetch };
}
