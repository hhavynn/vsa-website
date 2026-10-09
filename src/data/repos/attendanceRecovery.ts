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
/** Values per admin_lookup_members call; the function accepts at most 1000 of each. */
const LOOKUP_CHUNK = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function distinctLower(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function memberRows(data: unknown): MemberSnapshot[] {
  return (Array.isArray(data) ? data : []) as MemberSnapshot[];
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

/** The same tokens admin_search_members uses, to skip a call that would return nothing. */
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
    return this.lookupMembers([], distinctLower(surnames), 'Failed to look up members by name');
  }

  /** Members whose stored email equals one of these (case-insensitive, exact). */
  async getMembersByEmails(emails: readonly string[]): Promise<MemberSnapshot[]> {
    return this.lookupMembers(distinctLower(emails), [], 'Failed to look up members by email');
  }

  /**
   * Attendee emails and names go in the POST body of admin_lookup_members, never
   * in a GET query string, where Supabase API logs would record them.
   */
  private async lookupMembers(emails: string[], surnames: string[], failure: string): Promise<MemberSnapshot[]> {
    if (emails.length === 0 && surnames.length === 0) return [];
    return withErrorHandling(async () => {
      const members: MemberSnapshot[] = [];
      const calls = Math.max(Math.ceil(emails.length / LOOKUP_CHUNK), Math.ceil(surnames.length / LOOKUP_CHUNK));
      for (let i = 0; i < calls; i += 1) {
        const { data, error } = await supabase.rpc('admin_lookup_members', {
          p_emails: emails.slice(i * LOOKUP_CHUNK, (i + 1) * LOOKUP_CHUNK),
          p_surnames: surnames.slice(i * LOOKUP_CHUNK, (i + 1) * LOOKUP_CHUNK),
        });
        if (error) throw error;
        members.push(...memberRows(data));
      }
      return Array.from(new Map(members.map((member) => [member.id, member])).values());
    }, failure);
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

  /** Name or email search over raw members (admin-only), sent in a POST body. */
  async searchMembers(query: string, limit = 10): Promise<MemberSnapshot[]> {
    return withErrorHandling(async () => {
      if (searchTokens(query).join('').length < 2) return [];
      const { data, error } = await supabase.rpc('admin_search_members', { p_query: query, p_limit: limit });
      if (error) throw error;
      return memberRows(data);
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
