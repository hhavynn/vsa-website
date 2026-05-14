import { useQuery } from 'react-query';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { HousePageAsset } from '../types';

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
    data: assets = [],
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
