import { MemberSnapshot, RecoveryActionRecord, RecoveryFinding, RecoveryFindingRecord, buildFindings, toEvidence } from './attendanceRecovery';
import { classifyHistoricalRow } from './importHistoryAudit';
import {
  buildLookup,
  bulkEligibility,
  candidatesFor,
  countScope,
  editDistance,
  eventKeyOf,
  eventProgress,
  NO_EVENT_ID,
  filterInsights,
  foldName,
  hasDuplicateEvidence,
  insightFor,
  nextUnfinishedEvent,
  similarMembers,
  sortInsights,
  DEFAULT_FILTERS,
} from './recoveryTriage';

// Synthetic people only.
const base: RecoveryFindingRecord = {
  row_id: 'r1', import_job_id: 'job-1', job_status: 'completed', job_created_at: '2026-05-23T00:00:00Z',
  event_id: 'ev-1', event_name: 'Fall GBM', event_date: '2026-05-22T12:00:00Z', source_row_index: 0,
  decision: 'review', display_name: 'Linh Tran', csv_email: 'linh.new@gmail.com', csv_college: 'Revelle', csv_year: '2nd',
  attendance_member_id: null, matched_member_id: null, match_reason: 'ambiguous_match', final_reason: null, match_method: null,
  manual_decision: null, name_score: 88, candidate_count: 0, can_mark_new: true, has_csv_email: true, attendance_exists: null,
  matched_member_attended: false, email_member_attended: false, candidate_attended: false, resolved_elsewhere: false,
  duplicate_twin_attended: null, email_in_members: false, exact_name_members: 0, email_conflict: false,
  email_conflict_both_school: false, year_differs: false, college_differs: false, recovered_credit_present: null,
  original_credit_present: null, created_member_id: null, candidate_member_ids: [],
};
const member = (id: string, first: string, last: string, email: string | null, extra: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  id, first_name: first, last_name: last, email, college: 'Revelle', year: '2nd', points: 10, events_attended: 1, ...extra,
});
/** A finding even when the row is not flagged (bulk checks see whatever the admin selected). */
function finding(overrides: Partial<RecoveryFindingRecord>, actions: RecoveryActionRecord[] = []): RecoveryFinding {
  const record = { ...base, ...overrides };
  return buildFindings([record], actions)[0] ?? {
    record, classification: classifyHistoricalRow(toEvidence(record)), latestAction: null, status: 'open', bucket: 'unresolved', sheetRow: record.source_row_index + 2,
  };
}

describe('normalization', () => {
  it('folds Vietnamese diacritics instead of deleting them', () => {
    expect(foldName('Nguyễn Thị Đào')).toBe('nguyen thi dao');
    expect(foldName('  Trần   Linh ')).toBe('tran linh');
  });
  it('measures small edit distances and exits early on large ones', () => {
    expect(editDistance('nguyen', 'nguyn')).toBe(1);
    expect(editDistance('linh', 'lynn')).toBe(2);
    expect(editDistance('nguyen', 'ngyuen')).toBe(1);
    expect(editDistance('alexander', 'bo', 2)).toBe(3);
  });
  it('finds accented, swapped, nickname and one-letter variants as similar', () => {
    const roster = [
      member('a', 'Thi', 'Nguyễn', null),
      member('b', 'Nguyen', 'Thi', null),
      member('c', 'Christopher', 'Pham', null),
      member('d', 'Kevin', 'Le', null),
      member('e', 'Anna', 'Vo', null),
    ];
    expect(similarMembers('Thi', 'Nguyen', roster).map((m) => m.id).sort()).toEqual(['a', 'b']);
    expect(similarMembers('Chris', 'Pham', roster).map((m) => m.id)).toEqual(['c']);
    expect(similarMembers('Kevin', 'Lee', roster).map((m) => m.id)).toEqual(['d']);
    expect(similarMembers('Bao', 'Tran', roster)).toEqual([]);
  });
});

describe('candidates and triage', () => {
  it('recommends a match only when the row email equals a stored email, never on name alone', () => {
    const exact = member('m-1', 'Linh', 'Tran', 'linh.new@gmail.com');
    const twin = member('m-2', 'Linh', 'Tran', 'linh.tran@ucsd.edu');
    const f = finding({ candidate_member_ids: ['m-1', 'm-2'], candidate_count: 2, exact_name_members: 2 });
    const lookup = buildLookup([exact, twin], new Set(), true);
    const insight = insightFor(f, lookup);
    expect(insight.candidates.map((c) => c.member.id)).toEqual(['m-1', 'm-2']);
    expect(insight.candidates.every((c) => c.sharesName)).toBe(true);
    expect(insight.triage.tier).toBe('straightforward');
    expect(insight.triage.recommendation).toMatchObject({ kind: 'restore', memberId: 'm-1' });
    expect(insight.flags).toContain('identical_names');

    const onlyNames = insightFor(finding({ candidate_member_ids: ['m-2'], candidate_count: 1, csv_email: 'someone@else.com' }), lookup);
    expect(onlyNames.triage.tier).toBe('ambiguous');
    expect(onlyNames.triage.recommendation).toBeNull();
  });

  it('calls a row already resolved when the email holder already attended, and suggests a duplicate dismissal', () => {
    const exact = member('m-1', 'Linh', 'Tran', 'linh.new@gmail.com');
    const insight = insightFor(finding({ candidate_member_ids: ['m-1'], candidate_count: 1 }), buildLookup([exact], new Set(['m-1']), true));
    expect(insight.triage.tier).toBe('resolved');
    expect(insight.triage.recommendation).toMatchObject({ kind: 'dismiss', reason: 'legitimate_duplicate' });
    expect(insight.flags).toContain('already_attended');
  });

  it('suggests a new member only with no candidates, names or emails on file, and only once lookups are ready', () => {
    const f = finding({});
    expect(insightFor(f, buildLookup([], null, false)).triage.recommendation).toBeNull();
    expect(insightFor(f, buildLookup([], new Set(), true)).triage).toMatchObject({ tier: 'straightforward', recommendation: { kind: 'create_member' } });
    expect(insightFor(finding({ exact_name_members: 1 }), buildLookup([], new Set(), true)).triage.recommendation).toBeNull();
  });

  it('puts possible wrong matches and investigations in their own tier, without leaving out the credited member as a candidate when the credit is gone', () => {
    const wrong = finding({ decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 70, email_conflict: true });
    const le = member('m-le', 'Kevin', 'Le', 'kevin.le@ucsd.edu');
    const insight = insightFor(wrong, buildLookup([le], new Set(['m-le']), true));
    expect(insight.triage.tier).toBe('incorrect_attribution');
    expect(insight.candidates).toEqual([]);
    expect(insight.flags).toContain('email_conflict');

    const gone = finding({ decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: false });
    expect(candidatesFor(gone, buildLookup([le], new Set(), true)).map((c) => c.member.id)).toEqual(['m-le']);
  });

  it('flags a dismissed finding whose evidence now says attendance is missing', () => {
    const dismissed: RecoveryActionRecord = {
      id: 'a1', request_id: 'q1', import_job_row_id: 'r1', previous_action_id: null, action: 'dismiss', resulting_status: 'dismissed',
      outcome: 'dismissed', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false, attendance_id: null,
      points_awarded: 0, reason_code: 'intentional_skip', note: null, actor_user_id: 'admin', created_at: '2026-10-01T00:00:00Z',
    };
    const f = finding({ decision: 'created', attendance_member_id: null }, [dismissed]);
    expect(insightFor(f, buildLookup([], new Set(), true)).flags).toContain('dismissed_but_missing');
  });
});

describe('filters, sort, counts, progress', () => {
  const rows = [
    finding({ row_id: 'a', display_name: 'Bao Vo', source_row_index: 3 }),
    finding({ row_id: 'b', display_name: 'Anna Pham', source_row_index: 1, candidate_member_ids: ['m-x'], candidate_count: 1 }),
    finding({ row_id: 'c', display_name: 'Anna Pham', source_row_index: 2, event_id: 'ev-2', event_name: 'Winter Social' }),
  ];
  const lookup = buildLookup([member('m-x', 'Ana', 'Pham', 'ana@x.com')], new Set(), true);
  const insights = rows.map((f) => insightFor(f, lookup));

  it('searches attendees and candidate members, and filters by tier and staged status', () => {
    expect(filterInsights(insights, { ...DEFAULT_FILTERS, search: 'ana@x' }, new Set()).map((i) => i.finding.record.row_id)).toEqual(['b']);
    expect(filterInsights(insights, { ...DEFAULT_FILTERS, tier: 'ambiguous' }, new Set()).map((i) => i.finding.record.row_id)).toEqual(['b']);
    expect(filterInsights(insights, { ...DEFAULT_FILTERS, status: 'staged' }, new Set(['c'])).map((i) => i.finding.record.row_id)).toEqual(['c']);
  });

  it('sorts straightforward first, by source order, and by name to group duplicates', () => {
    expect(sortInsights(insights, 'source').map((i) => i.finding.record.row_id)).toEqual(['b', 'c', 'a']);
    expect(sortInsights(insights, 'easiest')[2].finding.record.row_id).toBe('b');
    expect(sortInsights(insights, 'name').map((i) => i.finding.record.row_id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps findings whose event was deleted reviewable in their own group (Codex review)', () => {
    const orphan = finding({ row_id: 'orphan', event_id: null, event_name: null, event_date: null });
    const progress = eventProgress([...rows, orphan], new Set());
    const group = progress.find((p) => p.eventId === NO_EVENT_ID);
    expect(group).toMatchObject({ name: 'Findings whose event was deleted', total: 1, open: 1, date: null });
    expect(eventKeyOf(orphan)).toBe(NO_EVENT_ID);
  });

  it('counts the scope and per-event progress, and finds the next unfinished event', () => {
    expect(countScope(insights, new Set(['a']))).toMatchObject({ total: 3, unresolved: 3, staged: 1, ambiguous: 1 });
    const progress = eventProgress(rows, new Set(['c']));
    expect(progress.map((p) => [p.eventId, p.total, p.open, p.staged])).toEqual([['ev-1', 2, 2, 0], ['ev-2', 1, 1, 1]]);
    expect(nextUnfinishedEvent(progress, 'ev-1')).toBe('ev-2');
    expect(nextUnfinishedEvent(progress, 'ev-2')).toBe('ev-1');
    expect(nextUnfinishedEvent([progress[0]], 'ev-1')).toBeNull();
  });
});

describe('bulk eligibility (guardian F1/F6)', () => {
  const ready = buildLookup([], new Set(), true);
  it('allows bulk new members only with an email and no possible existing identity, once per person', () => {
    const ok = insightFor(finding({ row_id: 'ok' }), ready);
    const noEmail = insightFor(finding({ row_id: 'no-email', csv_email: null, has_csv_email: false }), ready);
    const twin = insightFor(finding({ row_id: 'twin', source_row_index: 5 }), ready);
    const named = insightFor(finding({ row_id: 'named', display_name: 'Bao Vo', csv_email: 'bao@x.com', exact_name_members: 1 }), ready);
    const elsewhere = insightFor(finding({ row_id: 'elsewhere', display_name: 'Kim Ho', csv_email: 'kim@x.com', resolved_elsewhere: true }), ready);
    const plan = bulkEligibility('create_member', [ok, noEmail, twin, named, elsewhere]);
    expect(plan.eligible.map((i) => i.finding.record.row_id)).toEqual(['ok']);
    expect(plan.skipped.map((s) => s.insight.finding.record.row_id)).toEqual(['no-email', 'twin', 'named', 'elsewhere']);
  });

  it('requires ledger evidence for bulk "legitimate duplicate" and warns about high-priority rows', () => {
    const evidence = insightFor(finding({ row_id: 'dup', decision: 'skipped_duplicate', matched_member_attended: true }), ready);
    const none = insightFor(finding({ row_id: 'none', decision: 'created' }), ready);
    const plan = bulkEligibility('dismiss', [evidence, none], { reason: 'legitimate_duplicate' });
    expect(plan.eligible.map((i) => i.finding.record.row_id)).toEqual(['dup']);
    expect(bulkEligibility('dismiss', [none], { reason: 'intentional_skip' }).warnings[0]).toMatch(/high-priority/);
  });

  it('never bulk-dismisses a row that credits a member, and does not count that member’s own attendance as evidence (guardian M1)', () => {
    const credited = finding({
      row_id: 'credited', decision: 'matched', attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true,
      match_method: 'fuzzy_name', name_score: 60, matched_member_attended: true,
    });
    expect(hasDuplicateEvidence(credited.record)).toBe(false);
    const insight = insightFor(credited, ready);
    (['legitimate_duplicate', 'intentional_skip', 'not_actionable'] as const).forEach((reason) => {
      const plan = bulkEligibility('dismiss', [insight], { reason });
      expect(plan.eligible).toEqual([]);
      expect(plan.skipped[0].reason).toMatch(/dismiss it individually with evidence/);
    });
    // A skipped duplicate whose matched member is someone else is independent evidence.
    expect(hasDuplicateEvidence(finding({ decision: 'skipped_duplicate', matched_member_id: 'm-x', matched_member_attended: true }).record)).toBe(true);
  });

  it('skips rows already on hold for bulk needs-info', () => {
    const hold: RecoveryActionRecord = {
      id: 'a1', request_id: 'q1', import_job_row_id: 'r1', previous_action_id: null, action: 'needs_info', resulting_status: 'needs_info',
      outcome: 'needs_info', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false, attendance_id: null,
      points_awarded: 0, reason_code: 'more_info_needed', note: 'x', actor_user_id: 'admin', created_at: '2026-10-01T00:00:00Z',
    };
    const held = insightFor(finding({}, [hold]), ready);
    expect(bulkEligibility('needs_info', [held]).eligible).toEqual([]);
  });
});
