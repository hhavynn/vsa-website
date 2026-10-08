import {
  MemberSnapshot,
  RecoveryActionRecord,
  RecoveryFindingRecord,
  allowedActions,
  buildFindings,
  countByBucket,
  describeRecoveryPlan,
  emailConflictMemberId,
  filterFindings,
  isStaleFinding,
  latestActionByRow,
  newRequestId,
  relatedMemberIds,
  splitDisplayName,
  validatePlan,
} from './attendanceRecovery';

// Synthetic people only.
function record(overrides: Partial<RecoveryFindingRecord> = {}): RecoveryFindingRecord {
  return {
    row_id: 'row-1',
    import_job_id: 'job-1',
    job_status: 'completed',
    job_created_at: '2026-05-23T00:00:00Z',
    event_id: 'event-1',
    event_name: 'Fall GBM',
    event_date: '2026-05-22T00:00:00Z',
    source_row_index: 0,
    decision: 'review',
    display_name: 'Linh Tran',
    csv_email: 'linh.new@gmail.com',
    csv_college: null,
    csv_year: null,
    attendance_member_id: null,
    matched_member_id: null,
    match_reason: 'ambiguous_match',
    final_reason: null,
    match_method: null,
    manual_decision: null,
    name_score: 88,
    candidate_count: 1,
    can_mark_new: false,
    has_csv_email: true,
    attendance_exists: null,
    matched_member_attended: false,
    email_member_attended: false,
    candidate_attended: false,
    resolved_elsewhere: false,
    duplicate_twin_attended: null,
    email_in_members: false,
    exact_name_members: 0,
    email_conflict: false,
    email_conflict_both_school: false,
    year_differs: false,
    college_differs: false,
    ...overrides,
  };
}

function action(overrides: Partial<RecoveryActionRecord> = {}): RecoveryActionRecord {
  return {
    id: 'a1',
    request_id: 'req-1',
    import_job_row_id: 'row-1',
    previous_action_id: null,
    action: 'restore',
    resulting_status: 'recovered',
    outcome: 'attendance_added',
    event_id: 'event-1',
    member_id: 'm1',
    from_member_id: null,
    created_member: false,
    attendance_id: 'att-1',
    points_awarded: 10,
    removed_attendance: null,
    reason_code: 'identity_confirmed',
    note: null,
    actor_user_id: 'admin-1',
    created_at: '2026-10-08T00:00:00Z',
    ...overrides,
  };
}

const member = (id: string, first: string, last: string, points = 20, events = 2): MemberSnapshot => ({
  id, first_name: first, last_name: last, email: `${id}@ucsd.edu`, college: 'Revelle', year: '2nd', points, events_attended: events,
});

describe('buildFindings', () => {
  it('surfaces a skipped similar-name attendee as unresolved and leaves clean rows out', () => {
    const findings = buildFindings([
      record(),
      record({ row_id: 'row-ok', decision: 'matched', attendance_member_id: 'm9', matched_member_id: 'm9', attendance_exists: true, match_method: 'email' }),
    ], []);
    expect(findings.map((f) => f.record.row_id)).toEqual(['row-1']);
    expect(findings[0].classification.kind).toBe('no_new_member_path');
    expect(findings[0].bucket).toBe('unresolved');
    expect(findings[0].sheetRow).toBe(2);
  });

  it('keeps a recovered row visible even after it stops being flagged', () => {
    const findings = buildFindings([record({ email_member_attended: true })], [action()]);
    expect(findings).toHaveLength(1);
    expect(findings[0].bucket).toBe('recovered');
  });

  it('puts insufficient-evidence rows and on-hold rows under "needs more information"', () => {
    const findings = buildFindings([
      record({ row_id: 'cand', candidate_attended: true }),
      record({ row_id: 'held' }),
    ], [action({ import_job_row_id: 'held', action: 'needs_info', resulting_status: 'needs_info', outcome: 'needs_info' })]);
    expect(countByBucket(findings)).toEqual({ unresolved: 0, needs_info: 2, recovered: 0, dismissed: 0 });
  });

  it('uses the latest entry of the history chain, not the first', () => {
    const chain = [
      action({ id: 'a1', action: 'dismiss', resulting_status: 'dismissed', outcome: 'dismissed' }),
      action({ id: 'a2', previous_action_id: 'a1', action: 'reopen', resulting_status: 'open', outcome: 'reopened' }),
    ];
    expect(latestActionByRow(chain).get('row-1')?.id).toBe('a2');
    expect(buildFindings([record()], chain)[0].bucket).toBe('unresolved');
  });

  it('filters by event, import job and issue type, highest priority first', () => {
    const findings = buildFindings([
      record({ row_id: 'r1', candidate_count: 3 }),
      record({ row_id: 'r2' }),
      record({ row_id: 'r3', event_id: 'event-2', import_job_id: 'job-2' }),
    ], []);
    const base = { bucket: 'unresolved' as const, eventId: '', importJobId: '', kind: '' as const };
    expect(filterFindings(findings, base).map((f) => f.record.row_id)).toEqual(['r2', 'r3', 'r1']);
    expect(filterFindings(findings, { ...base, eventId: 'event-2' }).map((f) => f.record.row_id)).toEqual(['r3']);
    expect(filterFindings(findings, { ...base, importJobId: 'job-1' })).toHaveLength(2);
    expect(filterFindings(findings, { ...base, kind: 'multiple_candidates_unresolved' }).map((f) => f.record.row_id)).toEqual(['r1']);
  });
});

describe('allowedActions', () => {
  const one = (r: RecoveryFindingRecord, actions: RecoveryActionRecord[] = []) => buildFindings([r], actions)[0];

  it('offers match, create, dismiss and hold for a skipped row', () => {
    expect(allowedActions(one(record()))).toEqual(['restore', 'create_member', 'dismiss', 'needs_info']);
  });

  it('offers correction (not restore) for a row that credits a member', () => {
    const matched = record({ decision: 'matched', attendance_member_id: 'm1', matched_member_id: 'm1', attendance_exists: true, match_method: 'fuzzy_name', name_score: 70 });
    expect(allowedActions(one(matched))).toEqual(['reassign', 'dismiss', 'needs_info']);
  });

  it('never writes for a recovered finding and only reopens a dismissed one', () => {
    expect(allowedActions(one(record(), [action()]))).toEqual([]);
    expect(allowedActions(one(record(), [action({ action: 'dismiss', resulting_status: 'dismissed', outcome: 'dismissed' })]))).toEqual(['reopen']);
  });

  it('allows no attendance write for rows without an event or from a failed import', () => {
    expect(allowedActions(one(record({ event_id: null })))).toEqual(['dismiss', 'needs_info']);
    expect(allowedActions(one(record({ job_status: 'failed' })))).toEqual(['dismiss', 'needs_info']);
  });
});

describe('describeRecoveryPlan', () => {
  it('lists the attendance insert and the trigger-recalculated total for a restore', () => {
    const lines = describeRecoveryPlan({ action: 'restore', member: member('m1', 'Linh', 'Tran'), memberAttended: false }, 'Fall GBM', 10);
    expect(lines[0]).toBe('Add attendance: Linh Tran × Fall GBM, 10 points.');
    expect(lines[1]).toContain('20 → 30 points, 2 → 3 events');
    expect(lines.join(' ')).toContain('No member profile, other attendance, or import record changes.');
  });

  it('awards nothing when the destination already has the attendance', () => {
    const lines = describeRecoveryPlan({ action: 'restore', member: member('m1', 'Anna', 'Pham'), memberAttended: true }, 'Fall GBM', 10);
    expect(lines[0]).toMatch(/^No attendance added: Anna Pham already has attendance/);
    expect(lines.join(' ')).not.toMatch(/→/);
  });

  it('describes a move as a removal and an addition that commit together', () => {
    const lines = describeRecoveryPlan({
      action: 'reassign', from: member('m5', 'Kevin', 'Le', 10, 1), fromPointsEarned: 10, to: member('m6', 'Kevin', 'Lee', 0, 0), toAttended: false, keepOriginal: false, note: 'sheet says Lee',
    }, 'Fall GBM', 10);
    expect(lines[0]).toBe('Remove attendance: Kevin Le × Fall GBM (10 points). Their total recalculates by trigger: 10 → 0 points, 1 → 0 events.');
    expect(lines[1]).toBe('Add attendance: Kevin Lee × Fall GBM, 10 points.');
    expect(lines).toContain('Both changes commit together or not at all.');
  });

  it('keeps the original when asked and only adds the correct member', () => {
    const lines = describeRecoveryPlan({
      action: 'reassign', from: member('m3', 'Minh', 'Nguyen'), fromPointsEarned: 10, to: member('m4', 'Minh', 'Nguyen', 0, 0), toAttended: false, keepOriginal: true, note: '',
    }, 'Fall GBM', 10);
    expect(lines[0]).toBe("Keep Minh Nguyen's attendance for Fall GBM.");
  });

  it('shows a new member without an email explicitly', () => {
    const lines = describeRecoveryPlan({ action: 'create_member', newMember: { first_name: 'Lynn', last_name: 'Tranh', email: '', college: 'Revelle', year: '' } }, 'Fall GBM', 10);
    expect(lines[0]).toBe('Create member: Lynn Tranh, no email (Revelle).');
    expect(lines).toContain('No existing member is changed or merged.');
  });

  it('dismissals change no attendance', () => {
    expect(describeRecoveryPlan({ action: 'dismiss', reason: 'legitimate_duplicate', note: '' }, 'Fall GBM', 10)).toContain('No attendance or member changes.');
  });
});

describe('validatePlan', () => {
  it('requires evidence before removing the original member and a note for holds', () => {
    const from = member('m5', 'Kevin', 'Le');
    const to = member('m6', 'Kevin', 'Lee');
    expect(validatePlan({ action: 'reassign', from, fromPointsEarned: 10, to, toAttended: false, keepOriginal: false, note: ' ' })).toMatch(/Record why/);
    expect(validatePlan({ action: 'reassign', from, fromPointsEarned: 10, to, toAttended: false, keepOriginal: true, note: '' })).toBeNull();
    expect(validatePlan({ action: 'reassign', from, fromPointsEarned: 10, to: from, toAttended: false, keepOriginal: true, note: '' })).toMatch(/different member/);
    expect(validatePlan({ action: 'needs_info', note: '' })).toMatch(/Note what/);
    expect(validatePlan({ action: 'dismiss', reason: 'not_actionable', note: '' })).toMatch(/Explain/);
    expect(validatePlan({ action: 'dismiss', reason: 'intentional_skip', note: '' })).toBeNull();
  });

  it('checks the new member name and email shape', () => {
    const base = { first_name: 'Minh', last_name: 'Nguyen', email: '', college: '', year: '' };
    expect(validatePlan({ action: 'create_member', newMember: base })).toBeNull();
    expect(validatePlan({ action: 'create_member', newMember: { ...base, last_name: ' ' } })).toMatch(/first and last/);
    expect(validatePlan({ action: 'create_member', newMember: { ...base, email: 'not-an-email' } })).toMatch(/valid email/);
  });
});

describe('database error helpers', () => {
  it('reads the member holding a duplicate email from the hint', () => {
    expect(emailConflictMemberId({ hint: 'email_in_use:m5' })).toBe('m5');
    expect(emailConflictMemberId({ hint: 'stale_finding' })).toBeNull();
    expect(emailConflictMemberId(new Error('x'))).toBeNull();
  });

  it('recognises stale and closed findings', () => {
    expect(isStaleFinding({ hint: 'stale_finding' })).toBe(true);
    expect(isStaleFinding({ hint: 'finding_closed' })).toBe(true);
    expect(isStaleFinding({ hint: '' })).toBe(false);
  });
});

describe('helpers', () => {
  it('makes distinct v4 request ids', () => {
    const a = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newRequestId()).not.toBe(a);
  });

  it('splits a sheet name for the create form', () => {
    expect(splitDisplayName('Mai Anh Nguyen')).toEqual({ first_name: 'Mai Anh', last_name: 'Nguyen' });
    expect(splitDisplayName('Cher')).toEqual({ first_name: 'Cher', last_name: '' });
    expect(splitDisplayName(null)).toEqual({ first_name: '', last_name: '' });
  });

  it('collects candidates, the suggested and the credited member once each', () => {
    expect(relatedMemberIds(
      record({ matched_member_id: 'm1', attendance_member_id: 'm1' }),
      { candidate_member_ids: ['m1', 'm2'], suggested_member_id: 'm3' },
    )).toEqual(['m1', 'm2', 'm3']);
  });
});
