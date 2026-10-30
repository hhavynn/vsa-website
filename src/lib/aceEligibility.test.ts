import type { ReadinessEvent } from '../data/repos/attendanceReadiness';
import {
  classifyPolicyEvents,
  computeAceEligibility,
  eligibilityMemberIds,
  savedPolicy,
  type AceEligibilityInput,
  type EligibilityDraft,
  type EligibilityNode,
} from './aceEligibility';
import { aceEligibilityIssues } from './adminPreflight';

// Synthetic people and events only.
const now = new Date('2026-10-30T12:00:00Z');

const event = (id: string, patch: Partial<ReadinessEvent> = {}): ReadinessEvent =>
  ({
    id,
    name: `Synthetic ${id}`,
    date: '2026-10-10T19:00:00Z',
    is_published: true,
    academic_term_id: 'fall',
    open_review_rows: 0,
    reconciliation_pending_rows: 0,
    reconciled_at: '2026-10-20T00:00:00Z',
    last_credit_at: null,
    latest_job: null,
    attestation: null,
    credits: 1,
    ...patch,
  }) as ReadinessEvent;
const unverified = (id: string) => event(id, { reconciled_at: null });

const draft = (id: string, member: string | null, big: string | null = null): EligibilityDraft => ({
  id,
  little_name: `Little ${id}`,
  little_member_id: member,
  big_ace_member_id: big,
});
const node = (id: string, memberId: string | null): EligibilityNode => ({ id, name: `Big ${id}`, memberId });

const verifiedEvents = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id) => event(id));
const attended = (entries: Record<string, string[]>) => new Map(Object.entries(entries).map(([member, ids]) => [member, new Set(ids)]));

function check(patch: Partial<AceEligibilityInput>) {
  return computeAceEligibility({
    drafts: [],
    nodes: [],
    policy: { littleMin: 4, bigMin: 3, eventIds: verifiedEvents.map((e) => e.id) },
    events: verifiedEvents,
    attendance: new Map(),
    now,
    ...patch,
  });
}

describe('pre-sort ACE eligibility', () => {
  it('applies the saved Little minimum: 4 meets, 3 is short by 1', () => {
    const result = check({
      drafts: [draft('a', 'm-a'), draft('b', 'm-b')],
      attendance: attended({ 'm-a': ['e1', 'e2', 'e3', 'e4'], 'm-b': ['e1', 'e2', 'e3'] }),
    });
    expect(result.littles.map((row) => [row.name, row.status, row.attended, row.required, row.remaining])).toEqual([
      ['Little a', 'meets', 4, 4, null],
      ['Little b', 'short', 3, 4, 1],
    ]);
  });

  it('applies the saved Big minimum separately: 3 meets, 2 is short by 1', () => {
    const result = check({
      drafts: [draft('a', 'm-a', 'n1'), draft('b', 'm-b', 'n2')],
      nodes: [node('n1', 'm-big1'), node('n2', 'm-big2')],
      attendance: attended({ 'm-big1': ['e1', 'e2', 'e3'], 'm-big2': ['e1', 'e2'] }),
    });
    expect(result.bigs.map((row) => [row.name, row.status, row.attended, row.required, row.remaining])).toEqual([
      ['Big n1', 'meets', 3, 3, null],
      ['Big n2', 'short', 2, 3, 1],
    ]);
  });

  it('counts a Big who takes several Littles once', () => {
    const result = check({
      drafts: [draft('a', 'm-a', 'n1'), draft('b', 'm-b', 'n1'), draft('c', 'm-c', 'n1')],
      nodes: [node('n1', 'm-big')],
      attendance: attended({ 'm-big': ['e1'] }),
    });
    expect(result.bigs).toHaveLength(1);
    expect(result.bigs[0]).toMatchObject({ status: 'short', attended: 1, remaining: 2, draftIds: ['a', 'b', 'c'] });
    expect(result.counts.big).toEqual({ meets: 0, short: 1, unknown: 0, 'needs-identity-review': 0 });
  });

  it('counts one person once even when two ACE nodes link the same member', () => {
    const result = check({
      drafts: [draft('a', 'm-a', 'n1'), draft('b', 'm-b', 'n2')],
      nodes: [node('n1', 'm-big'), node('n2', 'm-big')],
      attendance: attended({ 'm-big': ['e1', 'e2', 'e3'] }),
    });
    expect(result.bigs).toHaveLength(1);
    expect(result.bigs[0].draftIds).toEqual(['a', 'b']);
  });

  it('sends missing member links to identity review, never to short', () => {
    const result = check({
      drafts: [draft('a', null, 'n-unlinked'), draft('b', 'm-b', 'n-gone')],
      nodes: [node('n-unlinked', null)],
      attendance: attended({ 'm-b': ['e1', 'e2', 'e3', 'e4'] }),
    });
    expect(result.littles.find((row) => row.name === 'Little a')).toMatchObject({ status: 'needs-identity-review', remaining: null });
    expect(result.bigs.map((row) => row.status)).toEqual(['needs-identity-review', 'needs-identity-review']);
    expect(result.counts.little.short + result.counts.big.short).toBe(0);
  });

  it('still checks Littles who have no Big yet', () => {
    const result = check({ drafts: [draft('a', 'm-a')], attendance: attended({ 'm-a': ['e1'] }) });
    expect(result.littles[0]).toMatchObject({ status: 'short', attended: 1, remaining: 3 });
    expect(result.bigs).toEqual([]);
  });

  it('is Unknown while incomplete import evidence could still close the gap', () => {
    const events = [...verifiedEvents.slice(0, 3), unverified('e9')];
    const result = check({
      drafts: [draft('close', 'm-close'), draft('done', 'm-done'), draft('far', 'm-far')],
      policy: { littleMin: 4, bigMin: 3, eventIds: ['e1', 'e2', 'e3', 'e9'] },
      events,
      attendance: attended({ 'm-close': ['e1', 'e2', 'e3', 'e9'], 'm-done': ['e1', 'e2', 'e3'], 'm-far': ['e1'] }),
    });
    const byName = new Map(result.littles.map((row) => [row.name, row]));
    // An unverified credit never counts toward meeting the minimum…
    expect(byName.get('Little close')).toMatchObject({ status: 'unknown', attended: 3, pendingAttended: 1, remaining: null });
    // …and no confident "short" while that event could still add a credit.
    expect(byName.get('Little done')).toMatchObject({ status: 'unknown', attended: 3, remaining: null });
    // 1 verified + 1 unverified event can never reach 4.
    expect(byName.get('Little far')).toMatchObject({ status: 'short', attended: 1, remaining: 3 });
    expect(result.unverifiedEventIds).toEqual(['e9']);
  });

  it('meets on verified events alone even when another event is unverified', () => {
    const result = check({
      drafts: [draft('a', 'm-a')],
      policy: { littleMin: 4, bigMin: 3, eventIds: ['e1', 'e2', 'e3', 'e4', 'e9'] },
      events: [...verifiedEvents.slice(0, 4), unverified('e9')],
      attendance: attended({ 'm-a': ['e1', 'e2', 'e3', 'e4'] }),
    });
    expect(result.littles[0].status).toBe('meets');
  });

  it('rejects future, undated, unpublished and out-of-year events; their credits never count', () => {
    const events = [
      event('e1'),
      event('e2'),
      event('e3'),
      event('future', { date: '2026-11-15T19:00:00Z' }),
      event('undated', { date: null as unknown as string }),
      event('hidden', { is_published: false }),
    ];
    const result = check({
      drafts: [draft('a', 'm-a')],
      policy: { littleMin: 4, bigMin: 3, eventIds: ['e1', 'e2', 'e3', 'future', 'undated', 'hidden', 'gone'] },
      events,
      attendance: attended({ 'm-a': ['e1', 'e2', 'e3', 'future', 'hidden'] }),
    });
    expect(result.rejectedEvents.map((rejected) => [rejected.id, rejected.reason])).toEqual([
      ['future', 'Has not happened yet'],
      ['undated', 'Has no date'],
      ['hidden', 'Not published'],
      ['gone', "No longer one of this academic year's events"],
    ]);
    expect(result.littles[0]).toMatchObject({ status: 'short', attended: 3, remaining: 1 });
  });

  it('refuses to run without a saved, valid policy', () => {
    expect(() => check({ policy: { littleMin: 0, bigMin: 3, eventIds: [] } })).toThrow(/policy/);
    expect(() => check({ policy: { littleMin: 4, bigMin: 21, eventIds: [] } })).toThrow(/policy/);
    expect(() => check({ policy: { littleMin: 4.5, bigMin: 3, eventIds: [] } })).toThrow(/policy/);
    expect(savedPolicy({ little_min_events: null, big_min_events: 3 }, ['e1'])).toBeNull();
    expect(savedPolicy({ little_min_events: 4, big_min_events: 3 }, null)).toBeNull();
    expect(savedPolicy({}, ['e1'])).toBeNull();
    expect(savedPolicy({ little_min_events: 4, big_min_events: 3 }, [])).toEqual({ littleMin: 4, bigMin: 3, eventIds: [] });
  });

  it('with no qualifying events saved, everyone linked is short rather than meeting', () => {
    const result = check({ drafts: [draft('a', 'm-a')], policy: { littleMin: 4, bigMin: 3, eventIds: [] } });
    expect(result.littles[0]).toMatchObject({ status: 'short', attended: 0, remaining: 4 });
  });

  it('collects each canonical member once, Littles and Bigs', () => {
    expect(
      eligibilityMemberIds(
        [draft('a', 'm-a', 'n1'), draft('b', 'm-a', 'n1'), draft('c', null, 'n2'), draft('d', 'm-d', 'n-gone')],
        [node('n1', 'm-big'), node('n2', null)],
      ),
    ).toEqual(['m-a', 'm-big', 'm-d']);
  });

  it('classifies a saved event list once, ignoring repeats', () => {
    expect(classifyPolicyEvents(['e1', 'e1', 'e9'], [event('e1'), unverified('e9')], now)).toEqual({
      verifiedEventIds: ['e1'],
      unverifiedEventIds: ['e9'],
      rejectedEvents: [],
    });
  });
});

describe('eligibility preflight warnings', () => {
  const policy = { littleMin: 4, bigMin: 3, eventIds: ['e1', 'e2', 'e3', 'e4', 'e5'] };

  it('names exactly who is short, as warnings and never blockers', () => {
    const result = check({
      drafts: [draft('a', 'm-a', 'n1'), draft('b', 'm-b', 'n1')],
      nodes: [node('n1', 'm-big')],
      attendance: attended({ 'm-a': ['e1', 'e2'], 'm-b': ['e1', 'e2', 'e3', 'e4'], 'm-big': ['e1'] }),
    });
    const issues = aceEligibilityIssues({ policy, result, error: null });
    expect(issues.every((issue) => issue.level === 'warning')).toBe(true);
    expect(issues.map((issue) => [issue.title, issue.detail])).toEqual([
      ['1 Little below the 4-event minimum', 'Little a (2 of 4)'],
      ['1 Big below the 3-event minimum', 'Big n1 (1 of 3)'],
    ]);
  });

  it('warns when no policy is saved or the check failed, without blocking', () => {
    expect(aceEligibilityIssues({ policy: null, result: null, error: null })).toEqual([
      expect.objectContaining({ id: 'ace-eligibility:no-policy', level: 'warning' }),
    ]);
    expect(aceEligibilityIssues({ policy, result: null, error: 'denied' })).toEqual([
      expect.objectContaining({ id: 'ace-eligibility:error', level: 'warning', detail: 'denied' }),
    ]);
    expect(aceEligibilityIssues({ policy, result: null, error: null })).toEqual([]);
  });

  it('lists identity reviews, unknowns and saved events that stopped counting', () => {
    const result = check({
      drafts: [draft('a', null), draft('b', 'm-b')],
      policy: { ...policy, littleMin: 2, eventIds: ['e1', 'e9', 'future'] },
      events: [event('e1'), unverified('e9'), event('future', { date: '2026-12-01T00:00:00Z' })],
      attendance: attended({ 'm-b': ['e1'] }),
    });
    const ids = aceEligibilityIssues({ policy, result, error: null }).map((issue) => issue.id);
    expect(ids).toEqual(['ace-eligibility:unknown', 'ace-eligibility:identity', 'ace-eligibility:rejected-events']);
  });
});
