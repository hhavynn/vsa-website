import { useQuery } from 'react-query';
import { cabinetYearsRepository } from '../data/repos/cabinetYears';
import { CabinetYear } from '../types';

export function useCabinetYears() {
  const {
    data: cabinetYears = [],
    isLoading: loading,
    error,
    refetch: refreshCabinetYears,
  } = useQuery<CabinetYear[]>({
    queryKey: ['cabinet-years'],
    queryFn: () => cabinetYearsRepository.getYears(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
  });

  return { cabinetYears, loading, error, refreshCabinetYears };
}
