// Complete, ordered reads of the member roster and an event's attendance for
// identity resolution (Admin → Import, Merge Suggestions).
//
// Two rules make an incomplete read impossible to mistake for a real one:
//   1. Keyset pagination on id, continued until an empty page. Offset paging
//      can skip a row when another admin deletes or merges a member mid-read,
//      and stopping at a short page trusts that the server cap equals ours.
//   2. Any page error throws. A failed read must block the import; reading it
//      as "no members" would turn every attendee into a new duplicate member.
import { supabase } from '../../lib/supabase';
import { isPostgrestErrorShape, withErrorHandling } from '../errors';
import type { Json } from '../../types/database';
import type { IdentityAlias } from '../../lib/identityResolution';
import type { YearObservation } from '../../lib/yearStanding';
import type { AttendanceImportRequest } from '../../lib/attendanceImportDecisions';

export const IDENTITY_PAGE_SIZE = 1000;

export interface RosterMember {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  points: number;
  events_attended: number;
  created_at: string;
}

type PageResult<T> = { data: T[] | null; error: unknown };

/** PostgREST errors are plain objects; keep their message when one has no code. */
function toThrowable(error: unknown): unknown {
  if (error instanceof Error || isPostgrestErrorShape(error)) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message);
  }
  return new Error(String(error));
}

/** Reads every row in ascending id order, one keyset page at a time. */
export async function readAllById<T extends { id: string }>(
  readPage: (afterId: string | null, pageSize: number) => PromiseLike<PageResult<T>>,
  pageSize = IDENTITY_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let afterId: string | null = null;
  for (;;) {
    const result: PageResult<T> = await readPage(afterId, pageSize);
    if (result.error) throw toThrowable(result.error);
    const page: T[] = result.data ?? [];
    if (page.length === 0) return rows;
    const lastId: string = page[page.length - 1].id;
    if (afterId !== null && lastId <= afterId) {
      throw new Error('Member pages came back out of order; the roster could not be read completely.');
    }
    rows.push(...page);
    afterId = lastId;
  }
}

const ROSTER_COLUMNS = 'id, first_name, last_name, college, year, email, points, events_attended, created_at';

export type ImportProblemKind =
  | 'event_missing'
  | 'event_has_no_term'
  | 'event_changed'
  | 'member_missing'
  | 'member_changed'
  | 'email_owned_by_other'
  | 'email_held_by_other'
  | 'possible_duplicate_created';

export type AttendanceImportResult =
  | { ok: false; problems: { kind: ImportProblemKind; row_key?: string }[] }
  | {
      ok: true;
      request_id: string;
      replayed?: boolean;
      created: { row_key: string; member_id: string }[];
      attendance_inserted: number;
      attendance_already_present: string[];
      profile_fills: number;
      years_advanced: number;
      years_skipped: string[];
      aliases_added: number;
      observations_added: number;
    };

export class MemberIdentityRepository {
  /** Every member an admin can see. Throws rather than returning a partial roster. */
  async loadRoster(): Promise<RosterMember[]> {
    return withErrorHandling(
      () => readAllById<RosterMember>((afterId, pageSize) => {
        let query = supabase.from('members').select(ROSTER_COLUMNS).order('id', { ascending: true }).limit(pageSize);
        if (afterId) query = query.gt('id', afterId);
        return query as unknown as PromiseLike<PageResult<RosterMember>>;
      }),
      'Could not load the complete member list',
    );
  }

  /** Ids of every member who already has attendance for the event. */
  async loadEventAttendeeIds(eventId: string): Promise<Set<string>> {
    return withErrorHandling(async () => {
      const rows = await readAllById<{ id: string; member_id: string }>((afterId, pageSize) => {
        let query = supabase
          .from('member_event_attendance')
          .select('id, member_id')
          .eq('event_id', eventId)
          .order('id', { ascending: true })
          .limit(pageSize);
        if (afterId) query = query.gt('id', afterId);
        return query as unknown as PromiseLike<PageResult<{ id: string; member_id: string }>>;
      });
      return new Set(rows.map((row) => row.member_id));
    }, 'Could not load existing attendance for this event');
  }

  /** Every confirmed address. Admin-only table; a non-admin reads nothing. */
  async loadIdentityEmails(): Promise<(IdentityAlias & { id: string })[]> {
    return withErrorHandling(
      () => readAllById<IdentityAlias & { id: string }>((afterId, pageSize) => {
        let query = supabase.from('member_identity_emails').select('id, member_id, email').order('id', { ascending: true }).limit(pageSize);
        if (afterId) query = query.gt('id', afterId);
        return query as unknown as PromiseLike<PageResult<IdentityAlias & { id: string }>>;
      }),
      'Could not load confirmed member emails',
    );
  }

  async loadYearObservations(): Promise<YearObservation[]> {
    return withErrorHandling(
      () => readAllById<YearObservation & { id: string }>((afterId, pageSize) => {
        let query = supabase
          .from('member_year_observations')
          .select('id, member_id, academic_year_start, year_label, source')
          .order('id', { ascending: true })
          .limit(pageSize);
        if (afterId) query = query.gt('id', afterId);
        return query as unknown as PromiseLike<PageResult<YearObservation & { id: string }>>;
      }),
      'Could not load recorded member years',
    );
  }

  /** One transaction; returns the problems instead of writing when the preview is stale. */
  async applyAttendanceImport(request: AttendanceImportRequest): Promise<AttendanceImportResult> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_apply_attendance_import', { p_request: request as unknown as Json });
      if (error) throw toThrowable(error);
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof (data as { ok?: unknown }).ok !== 'boolean') {
        throw new Error('The import returned an unexpected result; check Recent Imports before retrying.');
      }
      return data as unknown as AttendanceImportResult;
    }, 'Import failed');
  }

  /** Pairs an admin marked as different people. Ordered offset pages (the table has a composite key). */
  async loadMergeExclusions(): Promise<{ source_id: string; target_id: string }[]> {
    return withErrorHandling(async () => {
      const rows: { source_id: string; target_id: string }[] = [];
      for (let from = 0; ; from += IDENTITY_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('merge_exclusions')
          .select('source_id, target_id')
          .order('target_id', { ascending: true })
          .order('source_id', { ascending: true })
          .range(from, from + IDENTITY_PAGE_SIZE - 1);
        if (error) throw toThrowable(error);
        if (!data || data.length === 0) return rows;
        rows.push(...(data as { source_id: string; target_id: string }[]));
      }
    }, 'Could not load ignored merge pairs');
  }
}

export const memberIdentityRepository = new MemberIdentityRepository();
