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
