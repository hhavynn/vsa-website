// Protected domain — attendance / House points. Post-event attendance status
// (#653) through admin_event_attendance_readiness: per-event import facts and
// House credit counts, read-only. The only write is an admin statement about an
// event (admin_attest_event_attendance); it never changes attendance or points.
// There is deliberately no client-side points math here.
import { supabase } from '../../lib/supabase';
import { ValidationError, withErrorHandling } from '../errors';

export interface ReadinessJob {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_rows: number | null;
  review_rows: number | null;
  error_count: number | null;
}

export interface ReadinessAttestation {
  status: 'no_signin' | 'verified';
  note: string | null;
  attested_at: string;
  by_current_user: boolean;
}

export interface ReadinessHouseCredit {
  house_profile_id: string;
  display_name: string;
  credits: number;
}

export interface ReadinessEvent {
  id: string;
  name: string;
  date: string | null;
  event_type: string;
  points: number;
  is_published: boolean;
  academic_term_id: string;
  term_label: string | null;
  credits: number;
  scoring_credits: number;
  last_credit_at: string | null;
  jobs: number;
  latest_job: ReadinessJob | null;
  open_review_rows: number;
  reconciled_at: string | null;
  /** Rows the latest reconciliation run left for an admin to decide. */
  reconciliation_pending_rows: number;
  attestation: ReadinessAttestation | null;
  house_credits: ReadinessHouseCredit[];
}

export interface AttendanceReadiness {
  events: ReadinessEvent[];
  totalEvents: number;
  truncated: boolean;
  checkedAt: string;
}

export const ATTENDANCE_READINESS_UNAVAILABLE =
  'The attendance status check is not available yet. Ask a site administrator to apply database migration 20261028090000.';

function missingFunction(code: string | undefined) {
  return code === 'PGRST202' || code === '42883';
}

export const attendanceReadinessRepository = {
  async getReadiness(academicYearStart: number, termId: string | null): Promise<AttendanceReadiness> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_event_attendance_readiness', { p_year: academicYearStart, p_term_id: termId });
      if (error) {
        if (missingFunction(error.code)) throw new ValidationError(ATTENDANCE_READINESS_UNAVAILABLE, 'year');
        throw error;
      }
      const result = (data ?? {}) as { events?: ReadinessEvent[]; total_events?: number; truncated?: boolean; checked_at?: string };
      if (!Array.isArray(result.events)) throw new ValidationError('The attendance status check returned no result.', 'year');
      return {
        events: result.events,
        totalEvents: result.total_events ?? result.events.length,
        truncated: result.truncated === true,
        checkedAt: result.checked_at ?? new Date().toISOString(),
      };
    }, 'Failed to read attendance status');
  },

  async attest(eventId: string, status: 'no_signin' | 'verified' | 'cleared', note: string | null): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.rpc('admin_attest_event_attendance', { p_event_id: eventId, p_status: status, p_note: note });
      if (error) {
        if (missingFunction(error.code)) throw new ValidationError(ATTENDANCE_READINESS_UNAVAILABLE, 'event');
        throw error;
      }
    }, 'Failed to record attendance status');
  },
};
