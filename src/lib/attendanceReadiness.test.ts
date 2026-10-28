/**
 * Post-event attendance status (#653). What matters: no sign-in, a failed
 * import, unresolved members, a verified import and pre-audit history each get
 * their own status; missing history is "Unknown", never "done"; a later import
 * undoes an earlier check; and the summary never claims more than the records.
 */
import type { ReadinessEvent } from '../data/repos/attendanceReadiness';
import { eventStatus, isQualifying, summarize } from './attendanceReadiness';

const NOW = new Date('2026-10-28T12:00:00Z');

function event(extra: Partial<ReadinessEvent> = {}): ReadinessEvent {
  return {
    id: 'ev', name: 'Fictional GBM', date: '2026-10-20T02:00:00Z', event_type: 'gbm', points: 1, is_published: true,
    academic_term_id: 'term', term_label: 'Fall 2026', credits: 0, scoring_credits: 0, last_credit_at: null, jobs: 0,
    latest_job: null, open_review_rows: 0, reconciled_at: null, reconciliation_pending_rows: 0, attestation: null, house_credits: [], ...extra,
  };
}
const job = (extra = {}) => ({ id: 'job', status: 'completed', created_at: '2026-10-21T00:00:00Z', completed_at: '2026-10-21T00:05:00Z', total_rows: 40, review_rows: 0, error_count: 0, ...extra });
const state = (e: ReadinessEvent) => eventStatus(e, NOW).state;

it('gives each acceptance case its own status', () => {
  expect(state(event({ attestation: { status: 'no_signin', note: null, attested_at: '2026-10-22T00:00:00Z', by_current_user: true } }))).toBe('no_signin');
  expect(state(event({ latest_job: job({ status: 'failed', completed_at: null, error_count: 2 }), jobs: 1 }))).toBe('failed');
  expect(state(event({ latest_job: job(), jobs: 1, credits: 30, open_review_rows: 3 }))).toBe('needs_review');
  expect(state(event({ latest_job: job(), jobs: 1, credits: 30, last_credit_at: '2026-10-21T00:05:00Z', reconciled_at: '2026-10-22T00:00:00Z' }))).toBe('verified');
  expect(state(event({ date: '2026-03-01T02:00:00Z', credits: 25 }))).toBe('unknown');
  expect(eventStatus(event({ date: '2026-03-01T02:00:00Z', credits: 25 }), NOW).reason).toMatch(/Before import auditing/);
});

it('never reports a past event with no records as done', () => {
  expect(state(event())).toBe('pending_import');
  expect(state(event({ credits: 12 }))).toBe('unknown');
  expect(eventStatus(event({ credits: 12 }), NOW).reason).toMatch(/no import record/);
});

it('treats an import that finished cleanly as imported until it is checked', () => {
  expect(state(event({ latest_job: job(), jobs: 1, credits: 30 }))).toBe('imported');
  const checked = event({ latest_job: job(), jobs: 1, credits: 30, attestation: { status: 'verified', note: null, attested_at: '2026-10-22T00:00:00Z', by_current_user: false } });
  expect(state(checked)).toBe('verified');
  // Imported again after the check: the check no longer covers it.
  const reimported = { ...checked, latest_job: job({ completed_at: '2026-10-23T00:00:00Z' }), jobs: 2 };
  expect(state(reimported)).toBe('imported');
  expect(eventStatus(reimported, NOW).reason).toMatch(/Verify it again/);
});

it('puts a failed or unfinished import ahead of everything else', () => {
  expect(state(event({ latest_job: job({ status: 'running', completed_at: null }), reconciled_at: '2026-10-30T00:00:00Z' }))).toBe('needs_review');
  expect(state(event({ latest_job: job({ status: 'error', completed_at: null }), attestation: { status: 'verified', note: null, attested_at: '2026-10-30T00:00:00Z', by_current_user: true } }))).toBe('failed');
});

it('ignores a stale "no sign-in" mark once credits exist', () => {
  expect(state(event({ credits: 4, attestation: { status: 'no_signin', note: null, attested_at: '2026-10-22T00:00:00Z', by_current_user: true } }))).toBe('unknown');
});

it('leaves future events alone, and never hides an event without a date', () => {
  expect(state(event({ date: '2026-11-05T02:00:00Z' }))).toBe('upcoming');
  expect(state(event({ date: null, credits: 4 }))).toBe('unknown');
});

it('keeps a reconciliation run with pending rows out of Verified', () => {
  expect(state(event({ credits: 30, reconciled_at: '2026-10-22T00:00:00Z', reconciliation_pending_rows: 2 }))).toBe('needs_review');
});

it('calls a pre-audit event with no attendance unknown, not pending', () => {
  expect(state(event({ date: '2026-03-01T02:00:00Z' }))).toBe('unknown');
});

it('summarizes counts, the last clean import and what is outstanding', () => {
  const events = [
    event({ id: 'a', name: 'Clean', latest_job: job({ completed_at: '2026-10-21T00:05:00Z' }), jobs: 1, credits: 30 }),
    event({ id: 'b', name: 'Later but under review', latest_job: job({ completed_at: '2026-10-25T00:05:00Z' }), jobs: 1, credits: 30, open_review_rows: 2 }),
    event({ id: 'c', name: 'Pending' }),
    event({ id: 'd', name: 'Future', date: '2026-12-01T02:00:00Z' }),
  ];
  const summary = summarize(events, NOW);
  expect(summary.lastCleanImport).toEqual({ eventName: 'Clean', completedAt: '2026-10-21T00:05:00Z' });
  expect(summary.outstanding).toBe(2);
  expect(summary.counts).toMatchObject({ imported: 1, needs_review: 1, pending_import: 1, upcoming: 1 });
});

it('counts only termed, point-earning events as qualifying', () => {
  expect(isQualifying({ points: 1, academic_term_id: 't' })).toBe(true);
  expect(isQualifying({ points: 0, academic_term_id: 't' })).toBe(false);
});
