import { useQuery } from 'react-query';
import { AceAssignmentCycle, AceAssignmentDraft } from '../types';
import { aceAssignmentsRepository } from '../data/repos/aceAssignments';
import { aceFamiliesRepository } from '../data/repos/aceFamilies';
import { AceNodeRef } from '../lib/aceAssignments';

export const ACE_ASSIGNMENT_CYCLES_KEY = ['ace-assignment-cycles'] as const;
export const aceAssignmentDraftsKey = (cycleId: string | null) => ['ace-assignment-drafts', cycleId] as const;
export const ACE_NODE_REFS_KEY = ['ace-node-refs'] as const;

export function useAceAssignmentCycles() {
  const { data: cycles = [], isLoading: loading, error } = useQuery<AceAssignmentCycle[]>({
    queryKey: ACE_ASSIGNMENT_CYCLES_KEY,
    queryFn: () => aceAssignmentsRepository.listCycles(),
    staleTime: 15 * 1000,
  });
  return { cycles, loading, error };
}

export function useAceAssignmentDrafts(cycleId: string | null) {
  const { data: drafts = [], isLoading: loading, error } = useQuery<AceAssignmentDraft[]>({
    queryKey: aceAssignmentDraftsKey(cycleId),
    queryFn: () => (cycleId ? aceAssignmentsRepository.listDrafts(cycleId) : Promise.resolve([])),
    enabled: !!cycleId,
    staleTime: 0,
  });
  return { drafts, loading, error };
}

/** Every ACE node: the pool Bigs are chosen from, and the live tree publish checks against. */
export function useAceNodeRefs(enabled = true) {
  const { data: nodes = [], isLoading: loading, error } = useQuery<AceNodeRef[]>({
    queryKey: ACE_NODE_REFS_KEY,
    queryFn: () => aceFamiliesRepository.getAllNodeRefs(),
    enabled,
    staleTime: 0,
  });
  return { nodes, loading, error };
}
