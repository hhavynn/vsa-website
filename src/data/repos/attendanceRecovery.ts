import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import {
  DismissReason,
  MemberSnapshot,
  NewMemberInput,
  RecoveryActionKind,
  RecoveryActionRecord,
  RecoveryFindingRecord,
  RecoveryOutcome,
  RecoveryStatus,
  ResolveReason,
} from '../../lib/attendanceRecovery';
import { Json } from '../../types/database';

// Historical attendance recovery (migration 20261009000026). Reads are admin-only
// by RLS and function checks. Every write goes through admin_recover_import_row,
// which inserts attendance (never deletes it), creates members and records
// history in one transaction.

const MEMBER_SELECT = 'id, first_name, last_name, email, college, year, points, events_attended' as const;
const PAGE = 1000;
/** Ids per `.in()` request, so URLs stay well under PostgREST limits. */
const ID_CHUNK = 100;
/** Terms per `.or()` request. */
const OR_CHUNK = 25;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A value safe inside a PostgREST `.or()` ilike term, or null. `_` stays a wildcard; callers filter exactly. */
function orSafe(value: string): string | null {
  const trimmed = value.trim();
  return trimmed && !/[,()%*\\":]/.test(trimmed) ? trimmed : null;
}

export interface ImportRowDetail {
  id: string;
  raw_row: Json;
  match_details: Json;
  csv_email: string | null;
  csv_college: string | null;
  csv_year: string | null;
  display_name: string | null;
}

export interface MemberEventAttendance {
  member_id: string;
  points_earned: number;
}

export interface MemberAttendanceItem {
  event_id: string;
  points_earned: number;
  events: { name: string; date: string } | null;
}

export interface RecoverRequest {
  requestId: string;
  rowId: string;
  action: RecoveryActionKind;
  expectedPreviousActionId: string | null;
  memberId?: string | null;
  fromMemberId?: string | null;
  newMember?: NewMemberInput | null;
  reasonCode?: DismissReason | ResolveReason | null;
  note?: string | null;
}

export interface RecoverResult {
  action_id: string;
  status: RecoveryStatus;
  outcome: RecoveryOutcome;
  member_id: string | null;
  from_member_id: string | null;
  created_member: boolean;
  attendance_id: string | null;
  points_awarded: number;
  replayed: boolean;
}

/** Strips PostgREST filter metacharacters so a term cannot malform `.or()`. */
function searchTokens(query: string): string[] {
  return query.replace(/[,()%*\\]/g, ' ').trim().split(/\s+/).filter(Boolean);
}

export class AttendanceRecoveryRepository {
  async listFindingRecords(): Promise<RecoveryFindingRecord[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_import_recovery_findings');
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as RecoveryFindingRecord[];
    }, 'Failed to load historical import findings');
  }

  async listActions(): Promise<RecoveryActionRecord[]> {
    return withErrorHandling(async () => {
      const actions: RecoveryActionRecord[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('import_recovery_actions')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        actions.push(...((data ?? []) as RecoveryActionRecord[]));
        if (!data || data.length < PAGE) return actions;
      }
    }, 'Failed to load recovery history');
  }

  async getRowDetail(rowId: string): Promise<ImportRowDetail> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('import_job_rows')
        .select('id, raw_row, match_details, csv_email, csv_college, csv_year, display_name')
        .eq('id', rowId)
        .single();
      if (error) throw error;
      return data as ImportRowDetail;
    }, 'Failed to load the import row');
  }

  async getMembers(memberIds: readonly string[]): Promise<MemberSnapshot[]> {
    const ids = Array.from(new Set(memberIds.filter(Boolean)));
    if (ids.length === 0) return [];
    return withErrorHandling(async () => {
      const members: MemberSnapshot[] = [];
      for (const part of chunks(ids, ID_CHUNK)) {
        const { data, error } = await supabase.from('members').select(MEMBER_SELECT).in('id', part);
        if (error) throw error;
        members.push(...((data ?? []) as MemberSnapshot[]));
      }
      return members;
    }, 'Failed to load members');
  }

  /**
   * Members whose last name ends with one of these surnames (case-insensitive),
   * for same-name candidates across a whole event in a few requests. Callers
   * compare full names exactly; this only narrows the set.
   */
  async findMembersBySurnames(surnames: readonly string[]): Promise<MemberSnapshot[]> {
    const terms = Array.from(new Set(surnames.map((name) => orSafe(name)?.toLowerCase()).filter((name): name is string => !!name)));
    if (terms.length === 0) return [];
    return withErrorHandling(async () => {
      const members: MemberSnapshot[] = [];
      for (const part of chunks(terms, OR_CHUNK)) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('members')
            .select(MEMBER_SELECT)
            .or(part.map((term) => `last_name.ilike.%${term}`).join(','))
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          members.push(...((data ?? []) as MemberSnapshot[]));
          if (!data || data.length < PAGE) break;
        }
      }
      return members;
    }, 'Failed to look up members by name');
  }

  /** Members whose stored email equals one of these (case-insensitive, exact). */
  async getMembersByEmails(emails: readonly string[]): Promise<MemberSnapshot[]> {
    const wanted = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
    const terms = Array.from(wanted).map(orSafe).filter((email): email is string => !!email);
    if (terms.length === 0) return [];
    return withErrorHandling(async () => {
      const members: MemberSnapshot[] = [];
      for (const part of chunks(terms, OR_CHUNK)) {
        const { data, error } = await supabase
          .from('members')
          .select(MEMBER_SELECT)
          .or(part.map((email) => `email.ilike.${email}`).join(','))
          .limit(PAGE);
        if (error) throw error;
        members.push(...((data ?? []) as MemberSnapshot[]).filter((m) => wanted.has((m.email ?? '').trim().toLowerCase())));
      }
      return members;
    }, 'Failed to look up members by email');
  }

  /** Every member, for the similar-name check before creating members in a batch. */
  async listRoster(): Promise<MemberSnapshot[]> {
    return withErrorHandling(async () => {
      const members: MemberSnapshot[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('members')
          .select(MEMBER_SELECT)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        members.push(...((data ?? []) as MemberSnapshot[]));
        if (!data || data.length < PAGE) return members;
      }
    }, 'Failed to load members');
  }

  /** Ids of every member with attendance for the event. */
  async getEventAttendanceMemberIds(eventId: string): Promise<string[]> {
    return withErrorHandling(async () => {
      const ids: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('member_event_attendance')
          .select('member_id')
          .eq('event_id', eventId)
          .order('member_id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        ids.push(...((data ?? []) as Array<{ member_id: string }>).map((row) => row.member_id));
        if (!data || data.length < PAGE) return ids;
      }
    }, 'Failed to check existing attendance');
  }

  /** Every attendance row (member, event, points) for these members. */
  async getAttendanceForMembers(memberIds: readonly string[]): Promise<Array<{ member_id: string; event_id: string; points_earned: number }>> {
    const ids = Array.from(new Set(memberIds.filter(Boolean)));
    if (ids.length === 0) return [];
    return withErrorHandling(async () => {
      const rows: Array<{ member_id: string; event_id: string; points_earned: number }> = [];
      for (const part of chunks(ids, ID_CHUNK)) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('member_event_attendance')
            .select('member_id, event_id, points_earned')
            .in('member_id', part)
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          rows.push(...((data ?? []) as Array<{ member_id: string; event_id: string; points_earned: number }>));
          if (!data || data.length < PAGE) break;
        }
      }
      return rows;
    }, 'Failed to load attendance');
  }

  /** Current point values for these events. */
  async getEventsPoints(eventIds: readonly string[]): Promise<Map<string, number>> {
    const ids = Array.from(new Set(eventIds.filter(Boolean)));
    if (ids.length === 0) return new Map();
    return withErrorHandling(async () => {
      const points = new Map<string, number>();
      for (const part of chunks(ids, ID_CHUNK)) {
        const { data, error } = await supabase.from('events').select('id, points').in('id', part);
        if (error) throw error;
        ((data ?? []) as Array<{ id: string; points: number | null }>).forEach((row) => points.set(row.id, row.points ?? 0));
      }
      return points;
    }, 'Failed to load events');
  }

  /** Name or email search over raw members (admin-only by RLS). */
  async searchMembers(query: string, limit = 10): Promise<MemberSnapshot[]> {
    return withErrorHandling(async () => {
      const tokens = searchTokens(query);
      if (tokens.join('').length < 2) return [];
      let request = supabase.from('members').select(MEMBER_SELECT);
      if (tokens.length === 1 && tokens[0].includes('@')) {
        request = request.ilike('email', `%${tokens[0]}%`);
      } else {
        const names = searchTokens(query.replace(/\./g, ' '));
        if (names.length === 0) return [];
        request = names.length === 1
          ? request.or(`first_name.ilike.%${names[0]}%,last_name.ilike.%${names[0]}%`)
          : request.ilike('first_name', `%${names[0]}%`).ilike('last_name', `%${names[names.length - 1]}%`);
      }
      const { data, error } = await request
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as MemberSnapshot[];
    }, 'Failed to search members');
  }

  /** Which of these members already have attendance for the event. */
  async getEventAttendance(eventId: string, memberIds: readonly string[]): Promise<MemberEventAttendance[]> {
    const ids = Array.from(new Set(memberIds.filter(Boolean)));
    if (ids.length === 0) return [];
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_event_attendance')
        .select('member_id, points_earned')
        .eq('event_id', eventId)
        .in('member_id', ids);
      if (error) throw error;
      return (data ?? []) as MemberEventAttendance[];
    }, 'Failed to check existing attendance');
  }

  async getRecentAttendance(memberId: string, limit = 5): Promise<MemberAttendanceItem[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_event_attendance')
        .select('event_id, points_earned, events(name, date)')
        .eq('member_id', memberId)
        .order('imported_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as MemberAttendanceItem[];
    }, 'Failed to load member attendance');
  }

  async getEventPoints(eventId: string): Promise<number> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.from('events').select('points').eq('id', eventId).single();
      if (error) throw error;
      return (data as { points: number | null }).points ?? 0;
    }, 'Failed to load the event');
  }

  async recover(request: RecoverRequest): Promise<RecoverResult> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_recover_import_row', {
        p_request_id: request.requestId,
        p_row_id: request.rowId,
        p_action: request.action,
        p_expected_previous_action_id: request.expectedPreviousActionId,
        p_member_id: request.memberId ?? null,
        p_from_member_id: request.fromMemberId ?? null,
        p_new_member: (request.newMember ?? null) as unknown as Json,
        p_reason_code: request.reasonCode ?? null,
        p_note: request.note?.trim() ? request.note.trim() : null,
      });
      if (error) throw error;
      return data as unknown as RecoverResult;
    }, 'Failed to recover attendance');
  }
}

export const attendanceRecoveryRepository = new AttendanceRecoveryRepository();
