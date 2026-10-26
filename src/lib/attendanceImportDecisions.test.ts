// Synthetic members only. Matcher verdicts -> admin decisions -> summary -> write plan -> request.
import {
  planAttendanceImport,
  planTotals,
  resolveRow,
  rowNeedsAdmin,
  summarizeAttendanceImport,
  toImportRequest,
} from './attendanceImportDecisions';
import type { RowDecision } from './attendanceImportDecisions';
import { member, RowSpec, scenario, ScenarioOptions } from '../test-utils/identityFixtures';
import type { IdentityMember } from './identityResolution';

function run(specs: RowSpec[], members: IdentityMember[], options: ScenarioOptions = {}) {
  const s = scenario(specs, members, options);
  const plan = planAttendanceImport(s.rows, s.ctx, {
    heldEmails: s.heldEmails,
    observations: s.snapshot.observations,
    eventAcademicYear: s.snapshot.eventAcademicYear,
  });
  return {
    ...s,
    plan,
    totals: planTotals(plan),
    summary: summarizeAttendanceImport(s.rows, s.ctx),
    statusOf: (i: number) => resolveRow(s.rows[i], s.ctx).status,
  };
}

const alex = member('alex', 'Alex', 'Nguyen', { college: 'Muir', year: '2nd Year', email: 'alex@gmail.com' });
const lastYear = { member_id: 'alex', academic_year_start: 2025, year_label: '2nd Year', source: 'attendance_import' as const };

describe('admin decisions', () => {
  const lan = member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' });
  const review = [{ name: 'Lan Tran', email: 'lan.two@gmail.com' }];

  it('an unresolved row writes nothing until decided', () => {
    const { summary, plan } = run(review, [lan]);
    expect(summary.unresolved).toBe(1);
    expect(plan.credits).toEqual([]);
    expect(plan.creates).toEqual([]);
  });

  it('Match Existing credits that member and, by default, remembers the email as admin-confirmed', () => {
    const { plan, summary } = run(review, [lan], { decisions: { 0: { kind: 'match', memberId: 'lan' } } });
    expect(summary).toMatchObject({ existingMembers: 1, adminConfirmed: 1, autoMatched: 0 });
    expect(plan.credits[0]).toMatchObject({ adminConfirmed: true, aliases: [{ email: 'lan.two@gmail.com', method: 'admin_confirmed' }] });
    // An admin's match never fills college or replaces the contact email.
    expect(plan.credits[0].fill).toEqual({});
  });

  it('an admin can match without remembering the email', () => {
    const decision: RowDecision = { kind: 'match', memberId: 'lan', rememberEmail: false };
    const { plan } = run(review, [lan], { decisions: { 0: decision } });
    expect(plan.credits[0].aliases).toEqual([]);
  });

  it('Create New makes a separate member, withholding an email someone else holds', () => {
    const { plan } = run([{ name: 'Lan Tran', email: 'lan@ucsd.edu', college: 'Revelle' }], [{ ...lan, college: 'Muir' }],
      { decisions: { 0: { kind: 'new' } } });
    expect(plan.credits).toEqual([]);
    expect(plan.creates[0]).toMatchObject({ first_name: 'Lan', last_name: 'Tran', email: null, emailWithheld: true });
  });

  it('a match decision can only pick a member the row offered', () => {
    const { statusOf } = run(review, [lan, member('x', 'X', 'Y')], { decisions: { 0: { kind: 'match', memberId: 'x' } } });
    expect(statusOf(0)).toBe('review');
  });

  it('Skip records nothing, and undo (no decision) restores review', () => {
    expect(run(review, [lan], { decisions: { 0: { kind: 'skip' } } }).summary.skipped).toBe(1);
    expect(run(review, [lan]).summary.unresolved).toBe(1);
  });

  it('a similar member ruled out by evidence can still be matched on purpose', () => {
    const anh = member('anh', 'Anh', 'Nguyen', { college: 'Warren' });
    const { statusOf } = run([{ name: 'An Nguyen', college: 'Muir' }], [anh], { decisions: { 0: { kind: 'match', memberId: 'anh' } } });
    expect(statusOf(0)).toBe('match');
  });

  it('a nameless row is invalid and never planned', () => {
    const { summary, plan } = run([{ name: '', email: 'x@ucsd.edu' }], []);
    expect(summary.invalid).toBe(1);
    expect(plan.creates).toEqual([]);
  });
});

describe('the write plan', () => {
  it('a Gmail → UCSD match keeps the member id and plans the alias, year advance and observation', () => {
    const { plan, totals } = run([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '3rd' }], [alex],
      { observations: [lastYear] });
    expect(plan.credits).toHaveLength(1);
    expect(plan.credits[0]).toMatchObject({
      member: alex,
      aliases: [{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }],
      year: { from: '2nd Year', to: '3rd Year' },
      observedYear: '3rd Year',
    });
    expect(plan.creates).toEqual([]);
    expect(totals).toMatchObject({ aliasesToAdd: 1, yearAdvances: 1 });
  });

  it('a historical import never rewinds or advances current standing', () => {
    const current = { ...alex, year: '3rd Year' };
    const { plan } = run([{ name: 'Alex Nguyen', email: 'alex@gmail.com', year: '1st' }], [current], {
      observations: [{ ...lastYear, academic_year_start: 2026, year_label: '3rd Year' }],
      eventYear: 2024,
    });
    expect(plan.credits[0].year).toBeNull();
  });

  it('fills an empty contact email only on a name + college + year match, instead of a separate alias', () => {
    const bao = member('bao', 'Bao', 'Le', { college: 'Sixth', year: '1st Year' });
    const { plan } = run([{ name: 'Bao Le', email: 'bao@ucsd.edu', college: 'Sixth', year: '2nd' }], [bao]);
    expect(plan.credits[0].fill).toEqual({ email: 'bao@ucsd.edu' });
    expect(plan.credits[0].aliases).toEqual([]);
  });

  it('a bare name match never fills an email or remembers one (review: weak evidence must not become an alias)', () => {
    const anh = member('anh', 'Anh', 'Nguyen');
    const { plan, rows } = run([{ name: 'Anh Nguyen', email: 'someone@gmail.com' }], [anh]);
    expect(rows[0].reason).toBe('unique_name');
    expect(plan.credits[0].fill).toEqual({});
    expect(plan.credits[0].aliases).toEqual([]);
    const withCollege = run([{ name: 'Anh Nguyen', email: 'someone@gmail.com', college: 'Muir' }], [{ ...anh, college: 'Muir' }]);
    expect(withCollege.rows[0].reason).toBe('name_college');
    expect(withCollege.plan.credits[0].fill).toEqual({});
  });

  it('remembers an email on an admin match by default only for an exact name', () => {
    const alexander = member('al', 'Alexander', 'Nguyen');
    const similar = run([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }], [alexander], { decisions: { 0: { kind: 'match', memberId: 'al' } } });
    expect(similar.plan.credits[0].aliases).toEqual([]);
    const optedIn = run([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }], [alexander],
      { decisions: { 0: { kind: 'match', memberId: 'al', rememberEmail: true } } });
    expect(optedIn.plan.credits[0].aliases).toEqual([{ email: 'alex@gmail.com', method: 'admin_confirmed' }]);
  });

  it('sends the same-name members the preview saw, for automatic matches and new members only', () => {
    const a = member('a', 'Ryan', 'Le', { college: 'Muir' });
    const b = member('b', 'Ryan', 'Le', { college: 'Sixth' });
    const auto = run([{ name: 'Minh Vo' }], [member('m', 'Minh', 'Vo')]);
    expect(auto.plan.credits[0].knownSameNameIds).toEqual(['m']);
    const created = run([{ name: 'Ryan Le' }], [a, b], { decisions: { 0: { kind: 'new' } } });
    expect(created.plan.creates[0].knownSameNameIds.sort()).toEqual(['a', 'b']);
    const chosen = run([{ name: 'Ryan Le' }], [a, b], { decisions: { 0: { kind: 'match', memberId: 'a' } } });
    expect(chosen.plan.credits[0].knownSameNameIds).toBeNull();
  });

  it('two rows for one member write one credit, and the second address joins it', () => {
    const { plan, summary } = run([
      { name: 'Alex Nguyen', email: 'alex@gmail.com', college: 'Muir', year: '3rd' },
      { name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '3rd' },
    ], [alex], { observations: [lastYear] });
    expect(plan.credits).toHaveLength(1);
    expect(plan.credits[0].aliases).toEqual([{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }]);
    expect(summary).toMatchObject({ existingMembers: 1, duplicatesSkipped: 1 });
  });

  it('a repeat comes back for a decision when the row it repeats is skipped', () => {
    const specs = [{ name: 'Alex Nguyen', email: 'alex@gmail.com' }, { name: 'Alex Nguyen', email: 'alex@gmail.com' }];
    const skipped = run(specs, [alex], { decisions: { 0: { kind: 'skip' } } });
    expect(skipped.statusOf(1)).toBe('review');
    expect(rowNeedsAdmin(skipped.rows[1], skipped.ctx)).toBe(true);
    const decided = run(specs, [alex], { decisions: { 0: { kind: 'skip' }, 1: { kind: 'new' } } });
    expect(decided.plan.creates).toHaveLength(1);
  });

  it('several rows an admin points at one member still credit once', () => {
    const lan = member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' });
    const { plan, summary } = run(
      [{ name: 'Lan Tran', email: 'a@gmail.com' }, { name: 'Lan Tran', email: 'b@gmail.com' }],
      [lan],
      { decisions: { 0: { kind: 'match', memberId: 'lan' }, 1: { kind: 'match', memberId: 'lan' } } },
    );
    expect(plan.credits).toHaveLength(1);
    expect(summary.duplicatesSkipped).toBe(1);
  });

  it('keeps each admin-matched row\'s email choice when several rows point at one member', () => {
    const lan = member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' });
    const { plan } = run(
      [{ name: 'Lan Tran', email: 'a@gmail.com' }, { name: 'Lan Tran', email: 'b@gmail.com' }],
      [lan],
      { decisions: { 0: { kind: 'match', memberId: 'lan', rememberEmail: false }, 1: { kind: 'match', memberId: 'lan', rememberEmail: true } } },
    );
    expect(plan.credits).toHaveLength(1);
    expect(plan.credits[0].aliases).toEqual([{ email: 'b@gmail.com', method: 'admin_confirmed' }]);
  });

  it('a new person submitted twice becomes one create carrying both addresses', () => {
    const { plan } = run([
      { name: 'Hoa Pham', email: 'hoa@gmail.com', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa@ucsd.edu', college: 'Sixth', year: '1st' },
    ], []);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ email: 'hoa@gmail.com', aliases: [{ email: 'hoa@ucsd.edu', method: 'same_submission' }] });
  });

  it('an address planned for two people is remembered for neither', () => {
    const specs = [
      { name: 'Hoa Pham', email: 'shared@gmail.com', college: 'Sixth' },
      { name: 'Minh Vo', email: 'x@ucsd.edu', email2: 'shared@gmail.com', college: 'Muir' },
    ];
    // Row 2 repeats row 1's address with another name, so it waits for review.
    expect(run(specs, []).plan.creates).toHaveLength(1);
    const decided = run(specs, [], { decisions: { 1: { kind: 'new' } } });
    expect(decided.plan.creates).toHaveLength(2);
    expect(decided.plan.creates.every((c) => c.email !== 'shared@gmail.com' && c.aliases.every((a) => a.email !== 'shared@gmail.com'))).toBe(true);
    expect(decided.totals.aliasConflicts).toBe(2);
  });

  it('a member who already attended is not re-credited, but a new address is still remembered', () => {
    const { plan, summary } = run([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '2nd' }], [alex],
      { attended: ['alex'], observations: [lastYear], eventYear: 2025 });
    expect(summary.alreadyRecorded).toBe(1);
    expect(plan.credits[0]).toMatchObject({ alreadyAttended: true, aliases: [{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }] });
    expect(planTotals(plan).creditedMembers).toBe(0);
  });

  it('a re-import of an event already recorded plans no new credit at all', () => {
    const { plan } = run([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }], [alex], { attended: ['alex'] });
    expect(plan.credits).toEqual([]);
    expect(plan.creates).toEqual([]);
  });

  it('builds the request the database function expects', () => {
    const { plan } = run([
      { name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '3rd' },
      { name: 'Hoa Pham', email: 'hoa@ucsd.edu', college: 'Sixth', year: 'Alumni' },
    ], [alex], { observations: [lastYear] });
    const request = toImportRequest(plan, {
      requestId: 'req', eventId: 'gbm', expectedPoints: 3, expectedTermId: 'fall',
    });
    expect(request).toEqual({
      request_id: 'req',
      event_id: 'gbm',
      expected_points: 3,
      expected_term_id: 'fall',
      credits: [{
        row_key: 'row-0',
        member_id: 'alex',
        expected: { first_name: 'Alex', last_name: 'Nguyen', college: 'Muir', email: 'alex@gmail.com' },
        year: { from: '2nd Year', to: '3rd Year' },
        aliases: [{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }],
        observed_year: '3rd Year',
        known_same_name_ids: ['alex'],
      }],
      creates: [{
        row_key: 'row-1', first_name: 'Hoa', last_name: 'Pham', college: 'Sixth', year: 'Alumni', email: 'hoa@ucsd.edu',
        known_same_name_ids: [],
      }],
    });
  });
});
