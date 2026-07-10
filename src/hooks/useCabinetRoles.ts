import { useQuery, useMutation, useQueryClient } from 'react-query';
import { cabinetRolesRepository, CabinetRoleDescription, CabinetRoleDescriptionUpdate, CabinetRoleDescriptionInsert } from '../data/repos/cabinetRolesRepository';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { FALLBACK_CABINET_ROLES } from '../config/publicFallbackContent';

export const CABINET_ROLES_QUERY_KEY = 'cabinet_roles';

export function useCabinetRoles() {
  return useQuery({
    queryKey: [CABINET_ROLES_QUERY_KEY],
    queryFn: async (): Promise<CabinetRoleDescription[]> => {
      try {
        return await cabinetRolesRepository.getAllRoles();
      } catch (error) {
        if (isSupabaseUnavailable(error)) {
          return FALLBACK_CABINET_ROLES as CabinetRoleDescription[];
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useUpdateCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<CabinetRoleDescription, Error, { roleSlug: string; updates: CabinetRoleDescriptionUpdate }>(
    ({ roleSlug, updates }) => cabinetRolesRepository.updateRole(roleSlug, updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([CABINET_ROLES_QUERY_KEY]);
      },
    }
  );
}

export function useCreateCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<CabinetRoleDescription, Error, CabinetRoleDescriptionInsert>(
    (newRole) => cabinetRolesRepository.createRole(newRole),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([CABINET_ROLES_QUERY_KEY]);
      },
    }
  );
}

export function useDeleteCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>(
    (roleSlug) => cabinetRolesRepository.deleteRole(roleSlug),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([CABINET_ROLES_QUERY_KEY]);
      },
    }
  );
}
