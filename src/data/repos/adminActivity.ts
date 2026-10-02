// Admin activity log: best-effort writes after an operational change, and
// reads for Admin → Recent Changes and the Overview. The log is append-only
// (see migration 20261002040000); undo is recorded as a new entry.
//
// Recording NEVER throws or blocks the change it describes: if the log table is
// missing (migration not applied yet) or the insert fails, the admin's edit
// still stands and only a console warning is left.
import { supabase } from '../../lib/supabase';
import {
  ActivityDraft,
  ActivityEntry,
  ActivityFilterKey,
  actionPrefixesFor,
  actorLabel,
  clampSummary,
  sanitizeMetadata,
} from '../../lib/adminActivity';
import { withErrorHandling } from '../errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ActivityRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  academic_year_start: number | null;
  summary: string;
  metadata: unknown;
  created_at: string;
}

function toEntry(row: ActivityRow): ActivityEntry {
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    academicYearStart: row.academic_year_start,
    summary: row.summary,
    metadata,
    createdAt: row.created_at,
  };
}

export interface ListActivityOptions {
  filter?: ActivityFilterKey;
  limit?: number;
  academicYearStart?: number | null;
}

export class AdminActivityRepository {
  /** Returns the new entry's id, or null when it could not be recorded. */
  async record(draft: ActivityDraft): Promise<string | null> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const metadata = sanitizeMetadata({ ...draft.metadata, actor: actorLabel(sessionData.session?.user) });
      const { data, error } = await supabase
        .from('admin_activity_log')
        .insert({
          action: draft.action,
          entity_type: draft.entityType,
          entity_id: draft.entityId && UUID.test(draft.entityId) ? draft.entityId : null,
          academic_year_start: draft.academicYearStart ?? null,
          summary: clampSummary(draft.summary),
          metadata: metadata as never,
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    } catch (error) {
      console.warn('Admin activity could not be recorded', error);
      return null;
    }
  }

  async list(options: ListActivityOptions = {}): Promise<ActivityEntry[]> {
    return withErrorHandling(async () => {
      let request = supabase
        .from('admin_activity_log')
        .select('id, actor_user_id, action, entity_type, entity_id, academic_year_start, summary, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(options.limit ?? 50);
      const prefixes = actionPrefixesFor(options.filter ?? 'all');
      if (prefixes) request = request.or(prefixes.map((prefix) => `action.like.${prefix}%`).join(','));
      if (typeof options.academicYearStart === 'number') request = request.eq('academic_year_start', options.academicYearStart);
      const { data, error } = await request;
      if (error) throw error;
      return ((data ?? []) as ActivityRow[]).map(toEntry);
    }, 'Failed to load recent changes');
  }
}

export const adminActivityRepository = new AdminActivityRepository();

/** Fire-and-forget: log an operational change without awaiting or failing on it. */
export function logAdminActivity(draft: ActivityDraft): void {
  void adminActivityRepository.record(draft);
}
