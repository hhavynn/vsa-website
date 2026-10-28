// Protected domain — attendance. Turns the per-event facts from
// admin_event_attendance_readiness into one status per event (#653). Pure: no
// reads, no points math. When the database has no record, the status says so
// ("unknown") instead of claiming the attendance is complete.
import type { ReadinessEvent } from '../data/repos/attendanceReadiness';

export type AttendanceState =
  | 'upcoming'
  | 'pending_import'
  | 'failed'
  | 'needs_review'
  | 'imported'
  | 'verified'
  | 'no_signin'
  | 'unknown';

/** Import auditing (import_jobs) began on this date (#50); earlier imports left no record. */
export const IMPORT_AUDIT_START = '2026-05-23';

export const STATE_LABEL: Record<AttendanceState, string> = {
  upcoming: 'Upcoming',
  pending_import: 'Pending import',
  failed: 'Import failed',
  needs_review: 'Needs review',
  imported: 'Imported',
  verified: 'Verified',
  no_signin: 'No sign-in',
  unknown: 'Unknown: verify manually',
};

/** Worst first: the order the queue is worked in. */
export const STATE_ORDER: AttendanceState[] = ['failed', 'needs_review', 'pending_import', 'unknown', 'imported', 'verified', 'no_signin', 'upcoming'];

export interface EventStatus {
  state: AttendanceState;
  reason: string;
}

const time = (value: string | null | undefined) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);

export function eventStatus(event: ReadinessEvent, now: Date): EventStatus {
  if (!event.date || Date.parse(event.date) > now.getTime()) {
    return { state: 'upcoming', reason: 'Has not happened yet.' };
  }
  const job = event.latest_job;
  if (job && job.status !== 'completed') {
    return /fail|error/i.test(job.status)
      ? { state: 'failed', reason: `The latest import ${job.error_count ? `stopped with ${job.error_count} error${job.error_count === 1 ? '' : 's'}` : 'failed'}. Attendance from it may be missing.` }
      : { state: 'needs_review', reason: `The latest import is still "${job.status}". Check it finished.` };
  }
  if (event.open_review_rows > 0) {
    return { state: 'needs_review', reason: `${event.open_review_rows} imported row${event.open_review_rows === 1 ? '' : 's'} still need a member match. Those people have no credit yet.` };
  }
  if (event.attestation?.status === 'no_signin' && event.credits === 0) {
    return { state: 'no_signin', reason: 'An admin confirmed this event had no sign-in.' };
  }
  const verifiedAt = Math.max(time(event.reconciled_at), event.attestation?.status === 'verified' ? time(event.attestation.attested_at) : Number.NEGATIVE_INFINITY);
  const latestChange = Math.max(time(job?.completed_at), time(event.last_credit_at));
  if (verifiedAt > Number.NEGATIVE_INFINITY && verifiedAt >= latestChange) {
    return {
      state: 'verified',
      reason: event.reconciled_at && time(event.reconciled_at) === verifiedAt
        ? 'Checked against the sign-in sheet by a reconciliation run.'
        : 'An admin confirmed the attendance was checked.',
    };
  }
  if (job) {
    return verifiedAt > Number.NEGATIVE_INFINITY
      ? { state: 'imported', reason: 'Imported again after the last check. Verify it again.' }
      : { state: 'imported', reason: 'Import finished with no open rows. Not yet checked against the sheet.' };
  }
  if (event.credits > 0) {
    return {
      state: 'unknown',
      reason: event.date.slice(0, 10) < IMPORT_AUDIT_START
        ? 'Before import auditing began (May 2026): there is no record of how this attendance was entered.'
        : 'Has attendance but no import record (entered by hand or another way). Verify it against the sheet.',
    };
  }
  return { state: 'pending_import', reason: 'No attendance recorded yet: import the sign-in sheet, or confirm there was none.' };
}

export interface ReadinessSummary {
  counts: Record<AttendanceState, number>;
  /** The most recent import that finished with nothing left to review. */
  lastCleanImport: { eventName: string; completedAt: string } | null;
  /** Past events whose attendance may still change the standings. */
  outstanding: number;
}

export function summarize(events: readonly ReadinessEvent[], now: Date): ReadinessSummary {
  const counts = Object.fromEntries(STATE_ORDER.map((state) => [state, 0])) as Record<AttendanceState, number>;
  let lastCleanImport: ReadinessSummary['lastCleanImport'] = null;
  for (const event of events) {
    const { state } = eventStatus(event, now);
    counts[state] += 1;
    const completedAt = event.latest_job?.completed_at;
    if ((state === 'imported' || state === 'verified') && completedAt && (!lastCleanImport || completedAt > lastCleanImport.completedAt)) {
      lastCleanImport = { eventName: event.name, completedAt };
    }
  }
  return { counts, lastCleanImport, outstanding: counts.failed + counts.needs_review + counts.pending_import + counts.unknown };
}

/** An event that can earn points: it has a term and awards points. */
export function isQualifying(event: Pick<ReadinessEvent, 'points' | 'academic_term_id'>): boolean {
  return event.points > 0 && !!event.academic_term_id;
}
