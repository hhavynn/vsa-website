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

// Historical attendance recovery (migration 20261008000000). Reads are admin-only
// by RLS and function checks. Every write goes through admin_recover_import_row,
// which inserts attendance (never deletes it), creates members and records
// history in one transaction.

const MEMBER_SELECT = 'id, first_name, last_name, email, college, year, points, events_attended' as const;
const PAGE = 1000;

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
      const { data, error } = await supabase.from('members').select(MEMBER_SELECT).in('id', ids);
      if (error) throw error;
      return (data ?? []) as MemberSnapshot[];
    }, 'Failed to load members');
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
