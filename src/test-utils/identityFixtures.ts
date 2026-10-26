// Synthetic people for identity-resolution tests. No real student data.
import { buildAttendanceRows, EMPTY_ATTENDANCE_MAPPING } from '../lib/attendanceCsv';
import type { DecisionContext, DecisionRow, RowDecision } from '../lib/attendanceImportDecisions';
import { IdentityAlias, IdentityMember, IdentitySnapshot, resolveAttendanceIdentities } from '../lib/identityResolution';
import type { YearObservation } from '../lib/yearStanding';

export const member = (id: string, first: string, last: string, extra: Partial<IdentityMember> = {}): IdentityMember => ({
  id, first_name: first, last_name: last, college: null, year: null, email: null, ...extra,
});

export interface RowSpec {
  name: string;
  email?: string;
  email2?: string;
  college?: string;
  year?: string;
}

const MAPPING = {
  ...EMPTY_ATTENDANCE_MAPPING,
  useFullName: true,
  fullName: 'Name',
  email: 'Email',
  secondaryEmail: 'Email 2',
  college: 'College',
  year: 'Year',
};

export function sourceRows(specs: RowSpec[]) {
  return buildAttendanceRows(
    specs.map((s) => ({ Name: s.name, Email: s.email ?? '', 'Email 2': s.email2 ?? '', College: s.college ?? '', Year: s.year ?? '' })),
    MAPPING,
  );
}

export interface ScenarioOptions {
  aliases?: IdentityAlias[];
  observations?: YearObservation[];
  attended?: string[];
  eventYear?: number | null;
  decisions?: Record<number, RowDecision>;
}

export function scenario(specs: RowSpec[], members: IdentityMember[], options: ScenarioOptions = {}) {
  const snapshot: IdentitySnapshot = {
    members,
    aliases: options.aliases ?? [],
    observations: options.observations ?? [],
    attendedMemberIds: new Set(options.attended ?? []),
    eventAcademicYear: options.eventYear === undefined ? 2026 : options.eventYear,
  };
  const rows: DecisionRow[] = resolveAttendanceIdentities(sourceRows(specs), snapshot).map((r, i) => ({
    ...r,
    decision: options.decisions?.[i] ?? null,
  }));
  const ctx: DecisionContext<IdentityMember> = {
    membersById: new Map(members.map((m) => [m.id, m])),
    alreadyMemberIds: snapshot.attendedMemberIds,
    rowsById: new Map(rows.map((r) => [r.rowId, r])),
  };
  const heldEmails = new Set<string>([
    ...snapshot.aliases.map((a) => a.email),
    ...members.map((m) => (m.email ?? '').trim().toLowerCase()).filter(Boolean),
  ]);
  return { rows, ctx, snapshot, heldEmails };
}
