import { MemberSnapshot, RecoveryActionRecord, RecoveryFinding, RecoveryFindingRecord, buildFindings } from './attendanceRecovery';
import {
  ReviewContext,
  StagedDecision,
  applicableItems,
  applyBatch,
  buildBatchReview,
  classifyApplyError,
  committedRowIds,
  findTotalDrift,
  memberCheck,
  reconcileStaging,
  reconfirmMember,
  resultHeadline,
  stageDecision,
  stagingError,
  summarizeLedger,
  summarizeResults,
  toRecoverRequest,
  describeItem,
  MAX_BATCH,
  UNKNOWN_GRACE_MS,
  unlockableUnknown,
} from './recoveryWorkspace';
import type { RecoverRequest, RecoverResult } from '../data/repos/attendanceRecovery';
import { DatabaseError } from '../data/errors';

// Synthetic people only.
const base: RecoveryFindingRecord = {
  row_id: 'r1', import_job_id: 'job-1', job_status: 'completed', job_created_at: '2026-05-23T00:00:00Z',
  event_id: 'ev-1', event_name: 'Fall GBM', event_date: '2026-05-22T12:00:00Z', source_row_index: 0,
  decision: 'review', display_name: 'Linh Tran', csv_email: 'linh@x.com', csv_college: null, csv_year: null,
  attendance_member_id: null, matched_member_id: null, match_reason: 'ambiguous_match', final_reason: null, match_method: null,
  manual_decision: null, name_score: 88, candidate_count: 1, can_mark_new: true, has_csv_email: true, attendance_exists: null,
  matched_member_attended: false, email_member_attended: false, candidate_attended: false, resolved_elsewhere: false,
  duplicate_twin_attended: null, email_in_members: false, exact_name_members: 0, email_conflict: false,
  email_conflict_both_school: false, year_differs: false, college_differs: false, recovered_credit_present: null,
  original_credit_present: null, created_member_id: null, candidate_member_ids: [],
};
const rec = (id: string, extra: Partial<RecoveryFindingRecord> = {}): RecoveryFindingRecord => ({ ...base, row_id: id, source_row_index: Number(id.replace(/\D/g, '')) || 0, ...extra });
const member = (id: string, first: string, last: string, email: string | null, points = 10): MemberSnapshot => ({
  id, first_name: first, last_name: last, email, college: 'Revelle', year: '2nd', points, events_attended: 1,
});
const linh = member('m-linh', 'Linh', 'Tran', 'linh@x.com', 20);
const bao = member('m-bao', 'Bao', 'Vo', 'bao@x.com', 5);
const kevinLe = member('m-le', 'Kevin', 'Le', 'kevin.le@x.com');
const kimOther = member('m-kim2', 'Kim', 'Ho', 'kim.other@x.com');

function findingsOf(records: RecoveryFindingRecord[], actions: RecoveryActionRecord[] = []): Map<string, RecoveryFinding> {
  return new Map(buildFindings(records, actions).map((f) => [f.record.row_id, f]));
}

function ctx(findings: Map<string, RecoveryFinding>, extra: Partial<ReviewContext> = {}): ReviewContext {
  return {
    findings,
    members: new Map([linh, bao, kevinLe, kimOther].map((m) => [m.id, m])),
    attendance: new Map([['ev-1', new Set<string>()], ['ev-2', new Set<string>()]]),
    eventPoints: new Map([['ev-1', 10], ['ev-2', 15]]),
    emailHolders: new Map(),
    ...extra,
  };
}

const result = (overrides: Partial<RecoverResult> = {}): RecoverResult => ({
  action_id: 'a', status: 'recovered', outcome: 'attendance_added', member_id: 'm', from_member_id: null,
  created_member: false, attendance_id: 'att', points_awarded: 10, replayed: false, ...overrides,
});

describe('staging', () => {
  it('freezes the exact request at staging (trimmed, lower-cased email) so retries are byte-identical', () => {
    const f = findingsOf([rec('r1')]).get('r1') as RecoveryFinding;
    const decision = stageDecision(f, { kind: 'create_member', newMember: { first_name: ' Linh ', last_name: 'Tran ', email: ' Linh@X.com ', college: '', year: '' } });
    expect(decision.payload).toEqual(toRecoverRequest(decision));
    expect(decision.payload.newMember).toEqual({ first_name: 'Linh', last_name: 'Tran', email: 'linh@x.com', college: '', year: '' });
    expect(decision.payload.expectedPreviousActionId).toBeNull();
    expect(decision.payload.requestId).toBe(decision.requestId);
    const again = stageDecision(f, { kind: 'needs_info', note: '  need sheet  ' });
    expect(again.requestId).not.toBe(decision.requestId);
    expect(again.payload.note).toBe('need sheet');
  });

  it('refuses inputs the finding does not allow, and validates notes', () => {
    const credited = findingsOf([rec('r1', { decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 60 })]).get('r1') as RecoveryFinding;
    expect(stagingError(credited, { kind: 'restore', member: linh })).toMatch(/not available/);
    expect(stagingError(credited, { kind: 'reassign', member: kevinLe, note: '' })).toMatch(/different member/);
    expect(stagingError(credited, { kind: 'needs_info', note: ' ' })).toMatch(/missing/);
    expect(stagingError(credited, { kind: 'dismiss', reason: 'not_actionable', note: '' })).toMatch(/not actionable/);
  });

  it('re-confirming a changed member issues a new request carrying the new fingerprint', () => {
    const f = findingsOf([rec('r1')]).get('r1') as RecoveryFinding;
    const decision = stageDecision(f, { kind: 'restore', member: linh });
    const changed = { ...linh, email: 'linh.new@x.com' };
    const next = reconfirmMember(decision, changed);
    expect(next.requestId).not.toBe(decision.requestId);
    expect(next.kind === 'restore' && next.memberCheck).toBe(memberCheck(changed));
    expect(next.payload.requestId).toBe(next.requestId);
  });
});

describe('batch review', () => {
  it('groups effects and sums member totals across events', () => {
    const findings = findingsOf([rec('r1'), rec('r2', { event_id: 'ev-2', display_name: 'Linh T', csv_email: 'linh@x.com' }), rec('r3', { display_name: 'Bao Vo', csv_email: 'bao@x.com' }), rec('r4', { display_name: 'New Person', csv_email: 'new@x.com' })]);
    const decisions = [
      stageDecision(findings.get('r1') as RecoveryFinding, { kind: 'restore', member: linh }),
      stageDecision(findings.get('r2') as RecoveryFinding, { kind: 'restore', member: linh }),
      stageDecision(findings.get('r3') as RecoveryFinding, { kind: 'dismiss', reason: 'intentional_skip', note: '' }),
      stageDecision(findings.get('r4') as RecoveryFinding, { kind: 'create_member', newMember: { first_name: 'New', last_name: 'Person', email: 'new@x.com', college: '', year: '' } }),
    ];
    const items = buildBatchReview(decisions, ctx(findings));
    expect(items.map((i) => i.group)).toEqual(['credit', 'credit', 'dismiss', 'create']);
    const ledger = summarizeLedger(items);
    expect(ledger).toMatchObject({ attendanceAdded: 3, pointsAdded: 35, membersCreated: 1, dismissed: 1, attendanceRemoved: 0, blocked: 0 });
    expect(ledger.memberTotals).toEqual([expect.objectContaining({ pointsBefore: 20, pointsAfter: 45, eventsBefore: 1, eventsAfter: 3 })]);
  });

  it('blocks a finding another admin changed after staging (concurrent admins)', () => {
    const f = findingsOf([rec('r1')]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'restore', member: linh });
    const other: RecoveryActionRecord = {
      id: 'act-other', request_id: 'q-other', import_job_row_id: 'r1', previous_action_id: null, action: 'needs_info', resulting_status: 'needs_info',
      outcome: 'needs_info', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false, attendance_id: null,
      points_awarded: 0, reason_code: 'more_info_needed', note: 'x', actor_user_id: 'admin-2', created_at: '2026-10-08T00:00:00Z',
    };
    const [item] = buildBatchReview([decision], ctx(findingsOf([rec('r1')], [other])));
    expect(item.group).toBe('blocked');
    expect(item.blockers[0]).toMatch(/Changed since you staged it/);
  });

  it('asks to re-confirm when the member changed before submission', () => {
    const f = findingsOf([rec('r1')]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'restore', member: linh });
    const changed = { ...linh, email: 'other@x.com' };
    const [item] = buildBatchReview([decision], ctx(f, { members: new Map([[linh.id, changed]]) }));
    expect(item).toMatchObject({ group: 'blocked', needsReconfirm: true });
    const [after] = buildBatchReview([reconfirmMember(decision, changed)], ctx(f, { members: new Map([[linh.id, changed]]) }));
    expect(after.group).toBe('credit');
  });

  it('marks already-recorded restores as needing acknowledgement, and they add no points', () => {
    const f = findingsOf([rec('r1')]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'restore', member: linh });
    const items = buildBatchReview([decision], ctx(f, { attendance: new Map([['ev-1', new Set(['m-linh'])]]) }));
    expect(items[0]).toMatchObject({ group: 'already_recorded', requiresAck: true, points: 0 });
    expect(applicableItems(items, new Set(), new Set())).toEqual([]);
    expect(applicableItems(items, new Set(), new Set(['r1']))).toHaveLength(1);
    expect(summarizeLedger(items, new Set(), new Set(['r1']))).toMatchObject({ attendanceAdded: 0, alreadyRecorded: 1 });
  });

  it('never lets two rows credit one member for one event, or one person go to two members (guardian F2)', () => {
    const f = findingsOf([
      rec('r1'), rec('r2', { display_name: 'Linh Tran', csv_email: 'linh@x.com' }),
      rec('r3', { display_name: 'Bao Vo', csv_email: 'shared@x.com' }), rec('r4', { display_name: 'Bao Vo', csv_email: 'shared@x.com' }),
      rec('r5', { display_name: 'Kim Ho', csv_email: 'kim@x.com' }), rec('r6', { display_name: 'Kim Ho', csv_email: 'kim.other@x.com' }),
    ]);
    const get = (id: string) => f.get(id) as RecoveryFinding;
    const items = buildBatchReview([
      stageDecision(get('r1'), { kind: 'restore', member: linh }),
      stageDecision(get('r2'), { kind: 'restore', member: linh }),
      stageDecision(get('r3'), { kind: 'restore', member: bao }),
      stageDecision(get('r4'), { kind: 'create_member', newMember: { first_name: 'Bao', last_name: 'Vo', email: '', college: '', year: '' } }),
      stageDecision(get('r5'), { kind: 'restore', member: kevinLe }),
      stageDecision(get('r6'), { kind: 'restore', member: kimOther }),
    ], ctx(f));
    const byRow = new Map(items.map((i) => [i.decision.rowId, i]));
    expect(byRow.get('r1')?.blockers.join(' ')).toMatch(/same member/);
    expect(byRow.get('r2')?.group).toBe('blocked');
    expect(byRow.get('r3')?.blockers.join(' ')).toMatch(/share an email/);
    expect(byRow.get('r4')?.group).toBe('blocked');
    // Same name but contradicting emails: may be two people; not blocked for that reason.
    expect(byRow.get('r5')?.group).toBe('credit');
    expect(byRow.get('r6')?.group).toBe('credit');
  });

  it('blocks duplicate and already-used emails for new members, and similar names in bulk (guardian F1)', () => {
    const f = findingsOf([rec('r1', { csv_email: 'dup@x.com', display_name: 'Anna Pham' }), rec('r2', { csv_email: 'dup@x.com', display_name: 'Ana Pham', event_id: 'ev-2' }), rec('r3', { csv_email: 'held@x.com', display_name: 'Held Person' }), rec('r4', { csv_email: 'nguyen@x.com', display_name: 'Thi Nguyen' })]);
    const get = (id: string) => f.get(id) as RecoveryFinding;
    const create = (id: string, first: string, last: string, email: string, origin: 'row' | 'bulk' = 'row') =>
      stageDecision(get(id), { kind: 'create_member', newMember: { first_name: first, last_name: last, email, college: '', year: '' } }, { origin });
    const holder = member('m-held', 'Someone', 'Else', 'held@x.com');
    const items = buildBatchReview([
      create('r1', 'Anna', 'Pham', 'dup@x.com'),
      create('r2', 'Ana', 'Pham', 'dup@x.com'),
      create('r3', 'Held', 'Person', 'held@x.com'),
      create('r4', 'Thi', 'Nguyen', 'nguyen@x.com', 'bulk'),
    ], ctx(f, { emailHolders: new Map([['held@x.com', holder]]), roster: [member('m-n', 'Thi', 'Nguyễn', null)] }));
    expect(items.map((i) => i.group)).toEqual(['blocked', 'blocked', 'blocked', 'blocked']);
    expect(items[0].blockers.join(' ')).toMatch(/Another staged new member has this email/);
    expect(items[2].blockers.join(' ')).toMatch(/already has this email/);
    expect(items[3].blockers.join(' ')).toMatch(/Similar members exist/);
  });

  it('blocks near-identical new members staged in one bulk batch, and warns on individually staged ones (guardian M3)', () => {
    const f = findingsOf([rec('r1', { display_name: 'Tony Nguyen', csv_email: 'tony@x.com' }), rec('r2', { display_name: 'Tony Ngyuen', csv_email: 'tony.n@y.com', event_id: 'ev-2' })]);
    const create = (id: string, first: string, last: string, email: string, origin: 'row' | 'bulk') =>
      stageDecision(f.get(id) as RecoveryFinding, { kind: 'create_member', newMember: { first_name: first, last_name: last, email, college: '', year: '' } }, { origin });
    const bulk = buildBatchReview([create('r1', 'Tony', 'Nguyen', 'tony@x.com', 'bulk'), create('r2', 'Tony', 'Ngyuen', 'tony.n@y.com', 'bulk')], ctx(f, { roster: [] }));
    expect(bulk.map((i) => i.group)).toEqual(['blocked', 'blocked']);
    expect(bulk[0].blockers.join(' ')).toMatch(/Similar to another staged new member \(Tony Ngyuen\)/);
    const single = buildBatchReview([create('r1', 'Tony', 'Nguyen', 'tony@x.com', 'row'), create('r2', 'Tony', 'Ngyuen', 'tony.n@y.com', 'row')], ctx(f, { roster: [] }));
    expect(single.map((i) => i.group)).toEqual(['create', 'create']);
    expect(single[0].warnings.join(' ')).toMatch(/You confirmed these are different people/);
  });

  it('blocks a stored decision whose payload no longer matches what it shows (guardian L4)', () => {
    const f = findingsOf([rec('r1')]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'restore', member: linh });
    const tampered = { ...decision, payload: { ...decision.payload, memberId: 'm-bao' } };
    const [item] = buildBatchReview([tampered], ctx(f));
    expect(item.group).toBe('blocked');
    expect(item.blockers[0]).toMatch(/does not match the request/);
  });

  it('counts a correction on a 0-point event as an attendance addition (Codex review)', () => {
    const f = findingsOf([rec('r1', { decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 60 })]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'reassign', member: bao, note: '' });
    const [item] = buildBatchReview([decision], ctx(f, { attendance: new Map([['ev-1', new Set(['m-le'])]]), eventPoints: new Map([['ev-1', 0]]) }));
    expect(item).toMatchObject({ group: 'investigate', addsAttendance: true, points: 0 });
    expect(summarizeLedger([item])).toMatchObject({ attendanceAdded: 1, pointsAdded: 0 });
    expect(summarizeLedger([item]).memberTotals).toEqual([expect.objectContaining({ eventsBefore: 1, eventsAfter: 2, pointsAfter: 5 })]);
    expect(describeItem(item, 'Fall GBM')[1]).toBe('Add attendance: Bao Vo × Fall GBM, 0 points (expected).');
    const [restore] = buildBatchReview([stageDecision(findingsOf([rec('r2')]).get('r2') as RecoveryFinding, { kind: 'restore', member: linh })], ctx(findingsOf([rec('r2')]), { eventPoints: new Map([['ev-1', 0]]) }));
    expect(summarizeLedger([restore])).toMatchObject({ attendanceAdded: 1, pointsAdded: 0 });
  });

  it('keeps a wrong match risky-but-safe: the original stays credited and nothing is removed', () => {
    const f = findingsOf([rec('r1', { decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 60 })]);
    const decision = stageDecision(f.get('r1') as RecoveryFinding, { kind: 'reassign', member: bao, note: '' });
    const [item] = buildBatchReview([decision], ctx(f, { attendance: new Map([['ev-1', new Set(['m-le'])]]) }));
    expect(item.group).toBe('investigate');
    expect(summarizeLedger([item])).toMatchObject({ attendanceAdded: 1, originalsFlagged: 1, attendanceRemoved: 0 });
    const [gone] = buildBatchReview([decision], ctx(f));
    expect(gone.blockers.join(' ')).toMatch(/no longer has this attendance/);
  });
});

describe('execution', () => {
  it('classifies rejections, timeouts, the rate limiter and lost responses', () => {
    expect(classifyApplyError({ code: 'P0001', hint: 'stale_finding', message: 'changed' }).status).toBe('conflict');
    expect(classifyApplyError({ code: 'P0001', hint: 'email_in_use:abc', message: 'in use' }).status).toBe('conflict');
    expect(classifyApplyError({ code: 'P0001', message: 'Rows from a failed import cannot be recovered here' }).status).toBe('failed');
    expect(classifyApplyError({ code: '42501', message: 'nope' })).toEqual({ status: 'failed', message: "You don't have permission to do that." });
    expect(classifyApplyError({ code: '57014', message: 'timeout' }).message).toMatch(/nothing was written/);
    expect(classifyApplyError({ code: 'over_request_rate_limit', message: 'blocked' }).status).toBe('failed');
    expect(classifyApplyError(new TypeError('Failed to fetch')).status).toBe('unknown');
    expect(classifyApplyError({ message: 'Bad gateway' }).status).toBe('unknown');
  });

  it('reports mixed results per row, never throws, and keeps failures staged with their request', async () => {
    const f = findingsOf([rec('r1'), rec('r2'), rec('r3'), rec('r4')]);
    const decisions = ['r1', 'r2', 'r3', 'r4'].map((id) => stageDecision(f.get(id) as RecoveryFinding, { kind: 'needs_info', note: 'x' }));
    const recover = jest.fn(async (request: RecoverRequest) => {
      if (request.rowId === 'r2') throw new DatabaseError('changed', 'P0001', '', 'stale_finding');
      if (request.rowId === 'r3') throw new TypeError('Failed to fetch');
      return result({ replayed: request.rowId === 'r4' });
    });
    const results = await applyBatch(decisions, recover);
    const byRow = new Map(results.map((r) => [r.rowId, r.status]));
    expect(Object.fromEntries(byRow)).toEqual({ r1: 'applied', r2: 'conflict', r3: 'unknown', r4: 'replayed' });
    const next = reconcileStaging(decisions, results);
    expect(next.map((d) => [d.rowId, d.issue?.status, d.requestId])).toEqual([
      ['r2', 'conflict', decisions[1].requestId],
      ['r3', 'unknown', decisions[2].requestId],
    ]);
    expect(resultHeadline(summarizeResults(results))).toBe('Applied 2 of 4 changes. 1 conflict, 1 with no answer; those rows stay staged.');
  });

  it('bounds concurrency and runs one member’s rows one after another', async () => {
    const f = findingsOf(Array.from({ length: 12 }, (_, i) => rec(`r${i}`, { event_id: `ev-${i}` })));
    const decisions: StagedDecision[] = Array.from({ length: 12 }, (_, i) =>
      stageDecision(f.get(`r${i}`) as RecoveryFinding, { kind: 'restore', member: i < 4 ? linh : member(`m-${i}`, 'P', `${i}`, null) }));
    let inFlight = 0;
    let peak = 0;
    const linhInFlight: number[] = [];
    let linhNow = 0;
    const recover = async (request: RecoverRequest) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      if (request.memberId === 'm-linh') { linhNow += 1; linhInFlight.push(linhNow); }
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (request.memberId === 'm-linh') linhNow -= 1;
      inFlight -= 1;
      return result();
    };
    const progress: number[] = [];
    const results = await applyBatch(decisions, recover, { onProgress: (done) => progress.push(done) });
    expect(results).toHaveLength(12);
    expect(peak).toBeLessThanOrEqual(2);
    expect(Math.max(...linhInFlight)).toBe(1);
    expect(progress[progress.length - 1]).toBe(12);
  });

  it('refuses a batch over the cap instead of silently sending only part of it (Codex review)', async () => {
    const f = findingsOf(Array.from({ length: MAX_BATCH + 1 }, (_, i) => rec(`r${i}`)));
    const decisions = Array.from(f.values()).map((finding) => stageDecision(finding, { kind: 'needs_info', note: 'x' }));
    const recover = jest.fn(async () => result());
    await expect(applyBatch(decisions, recover)).rejects.toThrow(/at most 200 changes; this one has 201\. Nothing was sent/);
    expect(recover).not.toHaveBeenCalled();
    await expect(applyBatch(decisions.slice(0, MAX_BATCH), recover)).resolves.toHaveLength(MAX_BATCH);
  });

  it('unlocks an unanswered row only when the history lacks it and the attempt can no longer be running (guardian M2)', () => {
    const f = findingsOf([rec('r1'), rec('r2'), rec('r3')]);
    const [recent, old, landed] = ['r1', 'r2', 'r3'].map((id) => stageDecision(f.get(id) as RecoveryFinding, { kind: 'needs_info', note: 'x' }));
    const now = 10_000_000;
    const marked = reconcileStaging([recent, old, landed], [
      { rowId: 'r1', status: 'unknown', message: '' }, { rowId: 'r2', status: 'unknown', message: '' }, { rowId: 'r3', status: 'unknown', message: '' },
    ], now);
    expect(marked.every((d) => d.issue?.at === now)).toBe(true);
    const aged = marked.map((d) => (d.rowId === 'r1' ? d : { ...d, issue: { ...d.issue!, at: now - UNKNOWN_GRACE_MS } }));
    expect(Array.from(unlockableUnknown(aged, new Set(['r3']), now))).toEqual(['r2']);
  });

  it('recognizes a committed request whose response was lost (repeated submission)', () => {
    const f = findingsOf([rec('r1'), rec('r2')]);
    const decisions = ['r1', 'r2'].map((id) => stageDecision(f.get(id) as RecoveryFinding, { kind: 'needs_info', note: 'x' }));
    const committed = committedRowIds(decisions, [{ request_id: decisions[0].requestId, import_job_row_id: 'r1' }, { request_id: decisions[1].requestId, import_job_row_id: 'other-row' }]);
    expect(Array.from(committed)).toEqual(['r1']);
  });

  it('reports cached-total drift without changing anything', () => {
    const drift = findTotalDrift([linh, bao], [
      { member_id: 'm-linh', points_earned: 10 }, { member_id: 'm-linh', points_earned: 10 },
      { member_id: 'm-bao', points_earned: 5 },
    ]);
    expect(drift.map((d) => [d.member.id, d.ledgerPoints, d.ledgerEvents])).toEqual([['m-linh', 20, 2]]);
  });
});
