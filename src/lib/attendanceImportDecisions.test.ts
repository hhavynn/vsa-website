// Synthetic members only. Covers identity resolution for the attendance import:
// matcher verdicts -> admin decisions -> summary -> write plan.
import {
  DecisionRow,
  RowDecision,
  planAttendanceWrites,
  resolveRow,
  summarizeAttendanceImport,
} from './attendanceImportDecisions';
import {
  AttendanceImportMember,
  AttendanceImportRowInput,
  matchAttendanceImportRows,
} from './memberMatching';

const member = (
  id: string,
  first_name: string,
  last_name: string,
  extra: Partial<AttendanceImportMember> = {},
): AttendanceImportMember => ({ id, first_name, last_name, college: null, year: null, email: null, ...extra });

const input = (index: number, name: string, extra: Partial<AttendanceImportRowInput> = {}): AttendanceImportRowInput => ({
  rowId: `row-${index}`,
  originalIndex: index,
  csvRow: {},
  displayName: name,
  matchName: name,
  csvCollege: '',
  csvYear: '',
  csvEmail: '',
  invalidYear: false,
  ...extra,
});

function run(
  inputs: AttendanceImportRowInput[],
  members: AttendanceImportMember[],
  already: string[] = [],
  decisions: Record<string, RowDecision> = {},
) {
  const alreadyMemberIds = new Set(already);
  const rows: DecisionRow[] = matchAttendanceImportRows(inputs, members, alreadyMemberIds).map((r) => ({
    ...r,
    decision: decisions[r.rowId] ?? null,
  }));
  const ctx = { membersById: new Map(members.map((m) => [m.id, m])), alreadyMemberIds };
  return {
    rows,
    ctx,
    summary: summarizeAttendanceImport(rows, ctx),
    plan: planAttendanceWrites(rows, ctx, members),
    statusOf: (i: number) => resolveRow(rows[i], ctx),
  };
}

describe('two distinct people with similar names', () => {
  const members = [member('alex', 'Alex', 'Nguyen', { college: 'Muir', year: '3rd Year', email: 'alex@ucsd.edu' })];

  it('never auto-matches a near name, even with the same college and year', () => {
    const { rows } = run([input(0, 'Alec Nguyen', { csvCollege: 'Muir', csvYear: '3rd Year' })], members);
    expect(rows[0].status).toBe('review');
    expect(rows[0].reason).toBe('fuzzy_name_match');
    expect(rows[0].candidateMemberIds).toEqual(['alex']);
  });

  it('lets the admin create the second person without touching the suggested member', () => {
    const { plan, summary } = run([input(0, 'Alec Nguyen', { csvEmail: 'alec@ucsd.edu' })], members, [], { 'row-0': { kind: 'new' } });
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ first_name: 'Alec', last_name: 'Nguyen', email: 'alec@ucsd.edu', emailWithheld: false });
    expect(summary).toMatchObject({ newMembers: 1, existingMembers: 0, unresolved: 0 });
  });
});

describe('two distinct people with identical names', () => {
  const twins = [
    member('a', 'Sam', 'Le', { college: 'Muir', email: 'sam.a@ucsd.edu' }),
    member('b', 'Sam', 'Le', { college: 'Warren', email: 'sam.b@ucsd.edu' }),
  ];

  it('is ambiguous and offers match and create', () => {
    const { rows } = run([input(0, 'Sam Le')], twins);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'ambiguous_match', canForceMatch: true, canMarkNew: true });
    expect(rows[0].candidateMemberIds.sort()).toEqual(['a', 'b']);
  });

  it('creates a third person with the same name when confirmed', () => {
    const { plan } = run([input(0, 'Sam Le', { csvEmail: 'sam.c@ucsd.edu' })], twins, [], { 'row-0': { kind: 'new' } });
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ first_name: 'Sam', last_name: 'Le', email: 'sam.c@ucsd.edu' });
    expect(plan.updates).toEqual([]);
  });

  it('sends a unique exact name with a different email to review instead of overriding it', () => {
    const { rows } = run([input(0, 'Sam Le', { csvEmail: 'other@gmail.com' })], [twins[0]]);
    expect(rows[0].status).toBe('review');
    expect(rows[0].reason).toBe('identity_conflict');
    expect(rows[0].canMarkNew).toBe(true);
  });

  it('sends a unique exact name with a different college to review', () => {
    const { rows } = run([input(0, 'Sam Le', { csvCollege: 'Revelle' })], [twins[0]]);
    expect(rows[0].reason).toBe('identity_conflict');
  });

  it('still auto-matches a unique exact name with consistent evidence', () => {
    const { rows } = run([input(0, 'Sam Le', { csvCollege: 'Muir College', csvEmail: 'sam.a@ucsd.edu' })], [twins[0]]);
    expect(rows[0]).toMatchObject({ status: 'match', matchedMember: expect.objectContaining({ id: 'a' }) });
  });

  it('still auto-matches a unique exact name when the member has no email on file', () => {
    const { rows } = run([input(0, 'Sam Le', { csvEmail: 'sam@ucsd.edu' })], [member('a', 'Sam', 'Le')]);
    expect(rows[0].status).toBe('match');
  });
});

describe('fuzzy matches with and without an email', () => {
  const members = [member('dan', 'Dan', 'Lee', { email: 'dan@ucsd.edu' })];

  it.each([
    ['without an email', {}],
    ['with an unknown email', { csvEmail: 'dani@ucsd.edu' }],
  ])('goes to review %s and can still become a new member', (_label, extra) => {
    const { rows, plan } = run([input(0, 'Dan Le', extra)], members, [], { 'row-0': { kind: 'new' } });
    expect(rows[0]).toMatchObject({ status: 'review', canForceMatch: true, canMarkNew: true });
    expect(plan.creates).toHaveLength(1);
  });
});

describe('conflicting email and name', () => {
  const members = [member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' })];

  it('reviews it and creates the new person without the email already on file', () => {
    const { rows, plan } = run([input(0, 'Bao Pham', { csvEmail: 'LAN@ucsd.edu' })], members, [], { 'row-0': { kind: 'new' } });
    expect(rows[0].reason).toBe('email_name_conflict');
    expect(plan.creates[0]).toMatchObject({ first_name: 'Bao', email: null, emailWithheld: true });
    expect(plan.updates).toEqual([]);
  });

  it('does not let a second new row claim an email an earlier new row will take', () => {
    const { plan } = run(
      [
        input(0, 'Bao Pham', { csvEmail: 'shared@ucsd.edu' }),
        input(1, 'Bao Phan', { csvEmail: 'shared@ucsd.edu' }),
      ],
      [],
      [],
      { 'row-1': { kind: 'new' } },
    );
    expect(plan.creates.map((c) => c.email)).toEqual(['shared@ucsd.edu', null]);
  });
});

describe('multiple members sharing an email', () => {
  const members = [
    member('m1', 'Alex', 'Nguyen', { email: 'shared@ucsd.edu' }),
    member('m2', 'Alyx', 'Nguyen', { email: 'shared@ucsd.edu' }),
  ];

  it('needs an explicit choice and never picks one itself', () => {
    const { rows, summary } = run([input(0, 'Alex Nguyen', { csvEmail: 'shared@ucsd.edu' })], members);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'duplicate_email_conflict', canForceMatch: true });
    expect(summary.unresolved).toBe(1);
  });

  it('credits exactly the member the admin chose', () => {
    const { plan } = run([input(0, 'Alex Nguyen', { csvEmail: 'shared@ucsd.edu' })], members, [], {
      'row-0': { kind: 'match', memberId: 'm2' },
    });
    expect(plan.updates.map((u) => u.member.id)).toEqual(['m2']);
  });
});

describe('a repeated email in one CSV', () => {
  it('lets the later row be matched to the existing email owner', () => {
    const owner = member('kim', 'Kim', 'Do', { email: 'kim@ucsd.edu' });
    const { rows, plan, summary } = run(
      [input(0, 'Zed Quinn', { csvEmail: 'kim@ucsd.edu' }), input(1, 'Kim Do', { csvEmail: 'kim@ucsd.edu' })],
      [owner],
      [],
      { 'row-0': { kind: 'skip' }, 'row-1': { kind: 'match', memberId: 'kim' } },
    );
    expect(rows[0].status).toBe('review');
    expect(summary.unresolved).toBe(0);
    expect(plan.updates.map((u) => u.member.id)).toEqual(['kim']);
  });

  it('offers the email owner as a candidate on the later row', () => {
    const owner = member('kim', 'Kim', 'Do', { email: 'kim@ucsd.edu' });
    const rows = matchAttendanceImportRows(
      [input(0, 'Kim Do', { csvEmail: 'kim@ucsd.edu' }), input(1, 'Someone Else', { csvEmail: 'kim@ucsd.edu' })],
      [owner],
      new Set(),
    );
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'duplicate_email_conflict', canForceMatch: true });
    expect(rows[1].candidateMemberIds).toEqual(['kim']);
  });
});

describe('manual selection among candidates', () => {
  const members = [
    member('a', 'Sam', 'Le', { college: 'Muir' }),
    member('b', 'Sam', 'Le', { college: 'Warren' }),
    member('c', 'Sam', 'Lee', { college: 'Sixth' }),
  ];

  it('credits the chosen candidate, not the matcher best guess', () => {
    const { rows, plan } = run([input(0, 'Sam Le', { csvCollege: 'Muir' })], members, [], {
      'row-0': { kind: 'match', memberId: 'b' },
    });
    expect(rows[0].matchedMember?.id).not.toBe('b');
    expect(plan.updates.map((u) => u.member.id)).toEqual(['b']);
  });

  it('ignores a choice that was never offered for the row', () => {
    const { statusOf, plan } = run([input(0, 'Sam Le')], members, [], { 'row-0': { kind: 'match', memberId: 'zzz' } });
    expect(statusOf(0).status).toBe('review');
    expect(plan.updates).toEqual([]);
  });

  it('treats a chosen member who already has attendance as already recorded, not a second record', () => {
    const { statusOf, plan, summary } = run([input(0, 'Sam Le')], members, ['b'], { 'row-0': { kind: 'match', memberId: 'b' } });
    expect(statusOf(0).status).toBe('already');
    expect(plan.updates).toEqual([]);
    expect(summary.alreadyRecorded).toBe(1);
  });

  it('can be undone before confirming', () => {
    const rows = run([input(0, 'Sam Le')], members, [], { 'row-0': { kind: 'new' } });
    expect(rows.plan.creates).toHaveLength(1);
    const undone = run([input(0, 'Sam Le')], members, [], {});
    expect(undone.statusOf(0).status).toBe('review');
    expect(undone.plan.creates).toEqual([]);
  });
});

describe('a confirmed new member', () => {
  it('is a plan entry of its own and never an update to the suggested member', () => {
    const suggested = member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu', college: 'Muir' });
    const { plan, summary } = run([input(0, 'Lan Tran', { csvEmail: 'lan2@gmail.com', csvCollege: 'Revelle' })], [suggested], [], {
      'row-0': { kind: 'new' },
    });
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toEqual([
      expect.objectContaining({ first_name: 'Lan', last_name: 'Tran', college: 'Revelle', email: 'lan2@gmail.com' }),
    ]);
    expect(summary).toMatchObject({ newMembers: 1, existingMembers: 0 });
  });
});

describe('unresolved and skipped rows', () => {
  const members = [member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' })];
  const inputs = [input(0, 'Minh Vo'), input(1, 'Lan Trann')];

  it('counts an undecided near match as unresolved and writes nothing for it', () => {
    const { summary, plan } = run(inputs, members);
    expect(summary).toMatchObject({ validRows: 2, newMembers: 1, unresolved: 1, skipped: 0 });
    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toEqual([]);
  });

  it('moves an explicitly skipped row out of unresolved and writes nothing for it', () => {
    const { summary, plan, statusOf } = run(inputs, members, [], { 'row-1': { kind: 'skip' } });
    expect(statusOf(1).status).toBe('skipped');
    expect(summary).toMatchObject({ unresolved: 0, skipped: 1 });
    expect(plan.creates.map((c) => c.first_name)).toEqual(['Minh']);
  });

  it('never turns an unresolved row into a member or a match', () => {
    const { plan } = run([input(0, 'Lan Trann')], members);
    expect(plan).toEqual({ updates: [], creates: [] });
  });

  it('reports rows without a name as invalid instead of counting them as new', () => {
    const { summary, plan } = run([input(0, '  ')], []);
    expect(summary).toMatchObject({ validRows: 0, invalid: 1, newMembers: 0 });
    expect(plan.creates).toEqual([]);
  });
});

describe('reimporting', () => {
  const members = [member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' }), member('mai', 'Mai', 'Ho')];

  it('brings a previously skipped attendee back for a decision', () => {
    const first = run([input(0, 'Mai Ho'), input(1, 'Lan Trann')], members, [], { 'row-1': { kind: 'skip' } });
    expect(first.statusOf(1).status).toBe('skipped');
    // Mai was credited by the first run; the skipped row left no attendance behind.
    const second = run([input(0, 'Mai Ho'), input(1, 'Lan Trann')], members, ['mai']);
    expect(second.statusOf(0).status).toBe('already');
    expect(second.statusOf(1).status).toBe('review');
    expect(second.summary).toMatchObject({ alreadyRecorded: 1, unresolved: 1 });
  });

  it('recognizes existing attendance and plans no writes, so points cannot double', () => {
    const { plan, summary } = run([input(0, 'Mai Ho'), input(1, 'Lan Tran', { csvEmail: 'lan@ucsd.edu' })], members, ['mai', 'lan']);
    expect(summary).toMatchObject({ alreadyRecorded: 2, existingMembers: 0, newMembers: 0 });
    expect(plan).toEqual({ updates: [], creates: [] });
  });

  it('lets an admin confirm a same-named different person even when the existing one already attended', () => {
    const { plan } = run([input(0, 'Mai Ho')], members, ['mai'], { 'row-0': { kind: 'new' } });
    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toEqual([]);
  });
});

describe('duplicate attendees in one CSV', () => {
  const members = [member('mai', 'Mai', 'Ho', { college: 'Muir' })];

  it('skips an exact repeat of the same name, college and year', () => {
    const { summary, plan } = run([input(0, 'Mai Ho'), input(1, 'Mai Ho')], members);
    expect(summary).toMatchObject({ existingMembers: 1, duplicatesSkipped: 1 });
    expect(plan.updates).toHaveLength(1);
  });

  it('flags a second row that resolves to the same member instead of silently dropping it', () => {
    const { rows, summary } = run(
      [input(0, 'Mai Ho', { csvCollege: 'Muir' }), input(1, 'Mai Ho', { csvCollege: 'Warren' })],
      [member('mai', 'Mai', 'Ho')],
    );
    expect(rows[0].status).toBe('match');
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'member_claimed_by_earlier_row', canMarkNew: true });
    expect(summary).toMatchObject({ existingMembers: 1, unresolved: 1 });
  });

  it('credits one member once even when an admin matches two rows to them', () => {
    const twins = [member('a', 'Sam', 'Le'), member('b', 'Sam', 'Le')];
    const { plan, summary } = run(
      [input(0, 'Sam Le', { csvCollege: 'Muir' }), input(1, 'Sam Le', { csvCollege: 'Warren' })],
      twins,
      [],
      { 'row-0': { kind: 'match', memberId: 'a' }, 'row-1': { kind: 'match', memberId: 'a' } },
    );
    expect(plan.updates).toHaveLength(1);
    expect(summary).toMatchObject({ existingMembers: 1, duplicatesSkipped: 1 });
  });
});
