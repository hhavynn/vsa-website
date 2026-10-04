// Data access for Content Health: the one cache-table read the Overview and the
// Health page share, and acknowledging a finding. Never touches content: an
// acknowledgement is a note about a finding, not a change to the thing it is about.
//
// RLS (migration 20261004000000) lets an admin write `acknowledgement` rows only,
// as themselves. Link-check results come from the scheduled job.
import { supabase } from '../../lib/supabase';
import { ContentHealthFinding, ContentHealthStateRow, buildAcknowledgement } from '../../lib/contentHealth';
import { withErrorHandling } from '../errors';

const STATE_COLUMNS =
  'kind, subject_key, check_status, http_status, failure_reason, checked_at, failing_since, consecutive_failures, detail, fingerprint, acknowledged_at, expires_at';

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/** The table is not there yet (migration not applied). A state, not a failure. */
function isMissingTable(error: unknown): boolean {
  const code = (error as PostgrestLikeError | null)?.code;
  return code === 'PGRST205' || code === '42P01';
}

export class ContentHealthRepository {
  /**
   * Everything the report needs from the cache table in ONE request: failed link
   * checks, the last run's summary row, and acknowledgements. Healthy (ok) and
   * skipped link rows are left in the table and never read. `null` means the table
   * is unavailable, so the report says links were not checked rather than "all fine".
   */
  async readState(): Promise<ContentHealthStateRow[] | null> {
    try {
      const { data, error, count } = await supabase
        .from('content_health_state')
        .select(STATE_COLUMNS, { count: 'exact' })
        .or('check_status.eq.failed,kind.eq.acknowledgement,kind.eq.check_run');
      if (error) {
        if (!isMissingTable(error)) console.error('Content health: failed to load link checks and acknowledgements', error);
        return null;
      }
      // A response cut off by the API row cap would drop findings silently.
      if (count !== null && count !== undefined && data && count > data.length) {
        console.error(`Content health: link checks were truncated (${data.length} of ${count} rows)`);
        return null;
      }
      return (data ?? []) as unknown as ContentHealthStateRow[];
    } catch (error) {
      console.error('Content health: failed to load link checks and acknowledgements', error);
      return null;
    }
  }

  /** Accept a known finding for now. Renews an existing acknowledgement of the same finding. */
  async acknowledge(finding: ContentHealthFinding, now: Date = new Date()): Promise<void> {
    return withErrorHandling(async () => {
      if (!finding.acknowledgeable) throw new Error('This finding is cleared by reviewing the content, not by acknowledging it.');
      const ack = buildAcknowledgement(finding, now);
      const { error } = await supabase.from('content_health_state').upsert(
        {
          kind: 'acknowledgement',
          subject_key: ack.subject_key,
          fingerprint: ack.fingerprint,
          acknowledged_at: now.toISOString(),
          expires_at: ack.expires_at,
        },
        { onConflict: 'kind,subject_key' },
      );
      if (error) throw error;
    }, 'Failed to acknowledge this finding');
  }

  /** Stop ignoring a finding: it counts again right away. */
  async removeAcknowledgement(key: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('content_health_state').delete().eq('kind', 'acknowledgement').eq('subject_key', key);
      if (error) throw error;
    }, 'Failed to stop ignoring this finding');
  }
}

export const contentHealthRepository = new ContentHealthRepository();
