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

async function readSelectedAttendance(memberIds: readonly string[], events: readonly string[]): Promise<Map<string, Set<string>>> {
  const members=Array.from(new Set(memberIds)).sort();
  if (members.length>10000) throw new ValidationError('The ACE roster is too large to review');
  const records = new Map<string, Set<string>>();
  const memberSet=new Set(members), eventSet=new Set(events);
  for (let eventStart=0;eventStart<events.length;eventStart+=50) {
    const eventPart=events.slice(eventStart,eventStart+50);
    for (let start=0;start<members.length;start+=100) {
      const part=members.slice(start,start+100);
      for (let from=0;;from+=500) {
        const {data,error}=await supabase.from('member_event_attendance')
          .select('member_id,event_id')
          .in('member_id',part)
          .in('event_id',eventPart)
          .order('member_id',{ascending:true})
          .order('event_id',{ascending:true})
          .range(from,from+499);
        if(error)throw error;
        const page=(data??[]) as Array<{member_id:string;event_id:string}>;
        for(const row of page) {
          if(!memberSet.has(row.member_id)||!eventSet.has(row.event_id))throw new Error('Attendance returned a row outside approved scope');
          const prior=records.get(row.member_id)??new Set<string>();
          prior.add(row.event_id);records.set(row.member_id,prior);
        }
        if(page.length<500)break;
      }
    }
  }
  return records;
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

  /**
   * Read only canonical verified attendance rows for chosen ACE-eligible events.
   * No attendance writes, point calculations or self-reported applicant credit.
   * Chunk by 100 member IDs, read every page, fail the entire evaluation if
   * ANY read fails. Admin page must separately verify event import readiness.
   */
  async getVerifiedSelectedAttendance(memberIds: readonly string[], eventIds: readonly string[]): Promise<Map<string, Set<string>>> {
    const events=Array.from(new Set(eventIds)).sort();
    if (!events.length || events.length>20) throw new ValidationError('Choose 1–20 approved eligible events');
    return withErrorHandling(() => readSelectedAttendance(memberIds, events), 'Failed to read verified ACE attendance');
  },

  /**
   * The same read for a saved ACE eligibility policy (up to 100 events), with
   * events chunked as well so no request grows past the URL limit.
   */
  async getPolicyEventAttendance(memberIds: readonly string[], eventIds: readonly string[]): Promise<Map<string, Set<string>>> {
    const events=Array.from(new Set(eventIds)).sort();
    if (!events.length || events.length>100) throw new ValidationError('Choose 1–100 qualifying events');
    return withErrorHandling(() => readSelectedAttendance(memberIds, events), 'Failed to read ACE eligibility attendance');
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
