import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { attendanceRecoveryRepository } from '../data/repos/attendanceRecovery';
import { RecoveryFinding } from '../lib/attendanceRecovery';
import { MemberLookup, NO_EVENT_ID, buildLookup, foldName, lastNameToken, normEmail } from '../lib/recoveryTriage';

const STALE = 60_000;

/**
 * Everything the reconciliation table needs to compare identities for one
 * event, in at most four requests however many rows the event has: members the
 * audit points at, members sharing a surname, members holding a row's email,
 * and who already attended the event. No per-row requests.
 */
export function useRecoveryLookups(findings: readonly RecoveryFinding[], eventId: string | null) {
  const { ids, surnames, emails } = useMemo(() => {
    const idSet = new Set<string>();
    const surnameSet = new Set<string>();
    const emailSet = new Set<string>();
    findings.forEach(({ record, latestAction }) => {
      (record.candidate_member_ids ?? []).forEach((id) => idSet.add(id));
      [record.matched_member_id, record.attendance_member_id, record.created_member_id, latestAction?.member_id, latestAction?.from_member_id]
        .forEach((id) => { if (id) idSet.add(id); });
      const surname = lastNameToken(record.display_name);
      if (surname) {
        surnameSet.add(surname.toLowerCase());
        const folded = foldName(surname);
        if (folded) surnameSet.add(folded);
      }
      if (record.email_in_members && record.csv_email) emailSet.add(normEmail(record.csv_email));
    });
    return { ids: Array.from(idSet).sort(), surnames: Array.from(surnameSet).sort(), emails: Array.from(emailSet).sort() };
  }, [findings]);

  const enabled = !!eventId;
  // Findings whose event was deleted have no event attendance to check.
  const realEvent = enabled && eventId !== NO_EVENT_ID;
  const byIds = useQuery(['attendance-recovery', 'lookup', eventId, 'ids', ids.join(',')], () => attendanceRecoveryRepository.getMembers(ids), {
    enabled: enabled && ids.length > 0, staleTime: STALE,
  });
  const bySurname = useQuery(['attendance-recovery', 'lookup', eventId, 'surnames', surnames.join(',')], () => attendanceRecoveryRepository.findMembersBySurnames(surnames), {
    enabled: enabled && surnames.length > 0, staleTime: STALE,
  });
  const byEmail = useQuery(['attendance-recovery', 'lookup', eventId, 'emails', emails.join(',')], () => attendanceRecoveryRepository.getMembersByEmails(emails), {
    enabled: enabled && emails.length > 0, staleTime: STALE,
  });
  const attended = useQuery(['attendance-recovery', 'lookup', eventId, 'attended'], () => attendanceRecoveryRepository.getEventAttendanceMemberIds(eventId as string), {
    enabled: realEvent, staleTime: STALE,
  });

  const settled = (query: { isSuccess: boolean }, needed: boolean) => !needed || query.isSuccess;
  const ready = enabled && settled(byIds, ids.length > 0) && settled(bySurname, surnames.length > 0)
    && settled(byEmail, emails.length > 0) && settled(attended, realEvent);
  const error: unknown = byIds.error ?? bySurname.error ?? byEmail.error ?? attended.error ?? null;

  const lookup: MemberLookup = useMemo(
    () => buildLookup(
      [...(byIds.data ?? []), ...(bySurname.data ?? []), ...(byEmail.data ?? [])],
      realEvent ? (attended.data ? new Set(attended.data) : null) : new Set<string>(),
      ready,
    ),
    [byIds.data, bySurname.data, byEmail.data, attended.data, ready, realEvent],
  );

  const refetch = () => {
    void byIds.refetch();
    void bySurname.refetch();
    void byEmail.refetch();
    if (realEvent) void attended.refetch();
  };

  return { lookup, loading: enabled && !ready && error == null, error, refetch };
}
