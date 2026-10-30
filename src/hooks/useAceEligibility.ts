import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { aceAssignmentsRepository } from '../data/repos/aceAssignments';
import { attendanceReadinessRepository, type AttendanceReadiness } from '../data/repos/attendanceReadiness';
import { ValidationError, toUserMessage } from '../data/errors';
import type { AceNodeRef } from '../lib/aceAssignments';
import {
  classifyPolicyEvents,
  computeAceEligibility,
  eligibilityMemberIds,
  savedPolicy,
  type AceEligibilityPolicy,
  type AceEligibilityResult,
} from '../lib/aceEligibility';
import type { AceAssignmentCycle, AceAssignmentDraft } from '../types';

export const aceEligibilityEventsKey = (cycleId: string | null) => ['ace-eligibility', 'policy-events', cycleId] as const;
export const aceEligibilityReadinessKey = (year: number | null) => ['ace-eligibility', 'readiness', year] as const;

const NO_ATTENDANCE: ReadonlyMap<string, ReadonlySet<string>> = new Map();

export interface AceEligibilityState {
  policy: AceEligibilityPolicy | null;
  /** The saved qualifying event ids; null while loading or unavailable. */
  savedEventIds: string[] | null;
  readiness: AttendanceReadiness | null;
  result: AceEligibilityResult | null;
  loading: boolean;
  error: string | null;
}

/**
 * Admin-only, read-only pre-sort eligibility for a draft or locked cycle. Reads
 * the saved policy, the year's event import status (#653) and canonical
 * attendance at the counted events; computes nothing it stores.
 */
export function useAceEligibility(
  cycle: AceAssignmentCycle | null,
  drafts: readonly AceAssignmentDraft[],
  nodes: readonly AceNodeRef[],
  enabled: boolean,
): AceEligibilityState {
  const cycleId = cycle?.id ?? null;
  const year = cycle?.academic_year_start ?? null;

  const eventsQuery = useQuery<string[]>({
    queryKey: aceEligibilityEventsKey(cycleId),
    queryFn: () => aceAssignmentsRepository.listEligibilityEventIds(cycleId as string),
    enabled: enabled && !!cycleId,
    retry: false,
    staleTime: 0,
  });
  const readinessQuery = useQuery<AttendanceReadiness>({
    queryKey: aceEligibilityReadinessKey(year),
    queryFn: async () => {
      const data = await attendanceReadinessRepository.getReadiness(year as number, null);
      if (data.truncated || data.totalEvents > data.events.length) {
        throw new ValidationError("This year's event list is incomplete, so eligibility cannot be checked");
      }
      return data;
    },
    enabled: enabled && year !== null,
    retry: false,
    staleTime: 60 * 1000,
  });

  const policy = useMemo(() => (cycle ? savedPolicy(cycle, eventsQuery.data) : null), [cycle, eventsQuery.data]);
  const readiness = readinessQuery.data ?? null;
  const now = useMemo(() => new Date(readiness?.checkedAt ?? Date.now()), [readiness]);
  const countedEventIds = useMemo(() => {
    if (!policy || !readiness) return [];
    const classified = classifyPolicyEvents(policy.eventIds, readiness.events, now);
    return [...classified.verifiedEventIds, ...classified.unverifiedEventIds].sort();
  }, [policy, readiness, now]);
  const memberIds = useMemo(() => eligibilityMemberIds(drafts, nodes), [drafts, nodes]);
  const needsAttendance = countedEventIds.length > 0 && memberIds.length > 0;

  const attendanceQuery = useQuery<Map<string, Set<string>>>({
    queryKey: ['ace-eligibility', 'attendance', memberIds, countedEventIds],
    queryFn: () => attendanceReadinessRepository.getPolicyEventAttendance(memberIds, countedEventIds),
    enabled: enabled && !!policy && needsAttendance,
    retry: false,
    staleTime: 30 * 1000,
  });
  const attendance = needsAttendance ? attendanceQuery.data : NO_ATTENDANCE;

  const rawError = eventsQuery.error ?? readinessQuery.error ?? (needsAttendance ? attendanceQuery.error : null);
  // A failed refresh keeps the previous data in React Query; never show that
  // snapshot as a current Meets/Short result next to the error.
  const result = useMemo(
    () =>
      !rawError && policy && readiness && attendance
        ? computeAceEligibility({ drafts, nodes, policy, events: readiness.events, attendance, now })
        : null,
    [rawError, policy, readiness, attendance, drafts, nodes, now],
  );

  return {
    policy,
    savedEventIds: eventsQuery.data ?? null,
    readiness,
    result,
    loading: eventsQuery.isLoading || readinessQuery.isLoading || (needsAttendance && attendanceQuery.isLoading),
    error: rawError ? toUserMessage(rawError, 'Could not check attendance eligibility') : null,
  };
}
