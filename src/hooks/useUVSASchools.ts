import { useQuery, useMutation, useQueryClient } from 'react-query';
import { uvsaSchoolsRepository } from '../data/repos/uvsaSchools';
import { UVSASchool } from '../types';

export function useUVSASchools() {
  const { data: schools = [], isLoading: loading, error } = useQuery<UVSASchool[]>({
    queryKey: ['uvsa-schools'],
    queryFn: () => uvsaSchoolsRepository.getSchools(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return { schools, loading, error };
}

export function useAdminUVSASchools() {
  const { data: schools = [], isLoading: loading, error, refetch: refreshSchools } = useQuery<UVSASchool[]>({
    queryKey: ['admin-uvsa-schools'],
    queryFn: () => uvsaSchoolsRepository.getAllSchools(),
    staleTime: 5 * 60 * 1000,
  });

  return { schools, loading, error, refreshSchools };
}

export function useUVSASchool(id: string) {
  return useQuery({
    queryKey: ['uvsa-school', id],
    queryFn: () => uvsaSchoolsRepository.getSchoolById(id),
    enabled: !!id,
  });
}

export function useUVSASchoolBySlug(slug: string) {
  return useQuery({
    queryKey: ['uvsa-school-slug', slug],
    queryFn: () => uvsaSchoolsRepository.getSchoolBySlug(slug),
    enabled: !!slug,
  });
}

export function useUpsertUVSASchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (school: Partial<UVSASchool>) => uvsaSchoolsRepository.upsertSchool(school),
    onSuccess: () => {
      queryClient.invalidateQueries(['uvsa-schools']);
      queryClient.invalidateQueries(['admin-uvsa-schools']);
    },
  });
}

export function useDeleteUVSASchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => uvsaSchoolsRepository.deleteSchool(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['uvsa-schools']);
      queryClient.invalidateQueries(['admin-uvsa-schools']);
    },
  });
}
