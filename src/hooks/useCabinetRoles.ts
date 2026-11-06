import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cabinetRolesRepository, CabinetRoleDescription, CabinetRoleDescriptionUpdate, CabinetRoleDescriptionInsert } from '../data/repos/cabinetRolesRepository';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { FALLBACK_CABINET_ROLES } from '../config/publicFallbackContent';

export const CABINET_ROLES_QUERY_KEY = 'cabinet_roles';

// PGRST205 / 42P01: the table is not in the database yet (its migration is
// applied manually), so the public explorer should still show the curated
// fallback roles instead of an empty grid.
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && MISSING_TABLE_CODES.has(code);
}

export function useCabinetRoles() {
  return useQuery({
    queryKey: [CABINET_ROLES_QUERY_KEY],
    queryFn: async (): Promise<CabinetRoleDescription[]> => {
      try {
        return await cabinetRolesRepository.getAllRoles();
      } catch (error) {
        if (isSupabaseUnavailable(error) || isMissingTable(error)) {
          return FALLBACK_CABINET_ROLES as CabinetRoleDescription[];
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Admin editor read: no fallback. The curated fallback rows aren't stored
 * anywhere, so showing them as editable would make every save fail against a
 * missing table. Surface the error instead. Keyed under the same prefix, so the
 * mutations below invalidate it too.
 */
export function useAdminCabinetRoles() {
  return useQuery({
    queryKey: [CABINET_ROLES_QUERY_KEY, 'admin'],
    queryFn: () => cabinetRolesRepository.getAllRoles(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<CabinetRoleDescription, Error, { roleSlug: string; updates: CabinetRoleDescriptionUpdate }>({
    mutationFn: ({ roleSlug, updates }) => cabinetRolesRepository.updateRole(roleSlug, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CABINET_ROLES_QUERY_KEY] });
    },
  });
}

export function useCreateCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<CabinetRoleDescription, Error, CabinetRoleDescriptionInsert>({
    mutationFn: (newRole) => cabinetRolesRepository.createRole(newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CABINET_ROLES_QUERY_KEY] });
    },
  });
}

export function useDeleteCabinetRole() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (roleSlug) => cabinetRolesRepository.deleteRole(roleSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CABINET_ROLES_QUERY_KEY] });
    },
  });
}
