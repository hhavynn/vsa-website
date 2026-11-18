import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceRecoveryRepository } from '../data/repos/attendanceRecovery';
import { memberIdentityRepository } from '../data/repos/memberIdentity';
import { identityImportEnabled } from '../lib/identityRollout';
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
  // Confirmed addresses, so a row that used a member's other email still finds them.
  const identity = identityImportEnabled();
  const aliases = useQuery({
    queryKey: ['attendance-recovery', 'identity-emails'],
    queryFn: () => memberIdentityRepository.loadIdentityEmails(),
    enabled: !!eventId && identity, staleTime: STALE,
  });
  const { ids, surnames, emails } = useMemo(() => {
    const rowEmails = new Set(findings.map(({ record }) => normEmail(record.csv_email)).filter(Boolean));
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
    (aliases.data ?? []).forEach((alias) => { if (rowEmails.has(normEmail(alias.email))) idSet.add(alias.member_id); });
    return { ids: Array.from(idSet).sort(), surnames: Array.from(surnameSet).sort(), emails: Array.from(emailSet).sort() };
  }, [findings, aliases.data]);

  const enabled = !!eventId;
  // Findings whose event was deleted have no event attendance to check.
  const realEvent = enabled && eventId !== NO_EVENT_ID;
  const byIds = useQuery({
    queryKey: ['attendance-recovery', 'lookup', eventId, 'ids', ids.join(',')],
    queryFn: () => attendanceRecoveryRepository.getMembers(ids),
    enabled: enabled && ids.length > 0, staleTime: STALE,
  });
  const bySurname = useQuery({
    queryKey: ['attendance-recovery', 'lookup', eventId, 'surnames', surnames.join(',')],
    queryFn: () => attendanceRecoveryRepository.findMembersBySurnames(surnames),
    enabled: enabled && surnames.length > 0, staleTime: STALE,
  });
  const byEmail = useQuery({
    queryKey: ['attendance-recovery', 'lookup', eventId, 'emails', emails.join(',')],
    queryFn: () => attendanceRecoveryRepository.getMembersByEmails(emails),
    enabled: enabled && emails.length > 0, staleTime: STALE,
  });
  const attended = useQuery({
    queryKey: ['attendance-recovery', 'lookup', eventId, 'attended'],
    queryFn: () => attendanceRecoveryRepository.getEventAttendanceMemberIds(eventId as string),
    enabled: realEvent, staleTime: STALE,
  });

  const settled = (query: { isSuccess: boolean }, needed: boolean) => !needed || query.isSuccess;
  const ready = enabled && settled(aliases, identity) && settled(byIds, ids.length > 0) && settled(bySurname, surnames.length > 0)
    && settled(byEmail, emails.length > 0) && settled(attended, realEvent);
  const error: unknown = aliases.error ?? byIds.error ?? bySurname.error ?? byEmail.error ?? attended.error ?? null;

  const lookup: MemberLookup = useMemo(
    () => buildLookup(
      [...(byIds.data ?? []), ...(bySurname.data ?? []), ...(byEmail.data ?? [])],
      realEvent ? (attended.data ? new Set(attended.data) : null) : new Set<string>(),
      ready,
      aliases.data ?? [],
    ),
    [byIds.data, bySurname.data, byEmail.data, attended.data, ready, realEvent, aliases.data],
  );

  const refetch = () => {
    if (identity) void aliases.refetch({ cancelRefetch: false });
    void byIds.refetch({ cancelRefetch: false });
    void bySurname.refetch({ cancelRefetch: false });
    void byEmail.refetch({ cancelRefetch: false });
    if (realEvent) void attended.refetch({ cancelRefetch: false });
  };

  return { lookup, loading: enabled && !ready && error == null, error, refetch };
}
