import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_UVSA_NETWORK_PAGE_SETTINGS,
  uvsaNetworkSettingsRepository,
} from "../data/repos/uvsaNetworkSettings";

export function useUVSANetworkPageSettings() {
  const query = useQuery({
    queryKey: ["uvsa-network-page-settings"],
    queryFn: () => uvsaNetworkSettingsRepository.getSettings(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    settings: query.data || DEFAULT_UVSA_NETWORK_PAGE_SETTINGS,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
