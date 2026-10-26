import { findDuplicateMembers, DuplicateCandidateMember } from './duplicateMembers';

let clock = 0;
const m = (id: string, first: string, last: string, extra: Partial<DuplicateCandidateMember> = {}): DuplicateCandidateMember => ({
  id, first_name: first, last_name: last, college: null, year: null, email: null, points: 0, events_attended: 0,
  created_at: `2026-01-01T00:00:${String(clock++ % 60).padStart(2, '0')}Z`, ...extra,
});
const none = new Set<string>();

describe('findDuplicateMembers', () => {
  it('pairs two records that share a confirmed address, even under different contact emails', () => {
    const a = m('a', 'Alex', 'Nguyen', { email: 'alex@gmail.com' });
    const b = m('b', 'Alexander', 'Nguyen', { email: 'anguyen@ucsd.edu' });
    const [pair] = findDuplicateMembers([a, b], [{ member_id: 'b', email: 'alex@gmail.com' }], [], none);
    expect(pair).toMatchObject({ reason: 'shared_email', target: a, source: b });
  });

  it('pairs the same name and college across accents and middle initials', () => {
    const a = m('a', 'Nguyễn Văn', 'An', { college: 'Muir' });
    const b = m('b', 'Nguyen Van', 'An', { college: 'John Muir College' });
    const c = m('c', 'Kevin J.', 'Tran', { college: 'Sixth' });
    const d = m('d', 'Kevin', 'Tran', { college: 'Sixth' });
    const pairs = findDuplicateMembers([a, b, c, d], [], [], none);
    expect(pairs.map((p) => [p.target.id, p.source.id, p.reason])).toEqual([
      ['a', 'b', 'same_name_college'],
      ['c', 'd', 'same_name_college'],
    ]);
  });

  it('pairs an omitted middle name only within one college', () => {
    const a = m('a', 'Vincent', 'Nguyen', { college: 'Warren' });
    const b = m('b', 'Vincent Truong', 'Nguyen', { college: 'Warren' });
    const c = m('c', 'Vincent Minh', 'Nguyen', { college: 'Revelle' });
    const pairs = findDuplicateMembers([a, b, c], [], [], none);
    expect(pairs.map((p) => `${p.target.id}${p.source.id}:${p.reason}`)).toEqual(['ab:middle_name_college']);
  });

  it('still lists the same name across colleges, marked as evidence against', () => {
    const a = m('a', 'Ryan', 'Le', { college: 'Muir' });
    const b = m('b', 'Ryan', 'Le', { college: 'Sixth' });
    const [pair] = findDuplicateMembers([a, b], [], [], none);
    expect(pair.reason).toBe('same_name');
    expect(pair.evidence).toContainEqual({ tone: 'against', text: 'Different colleges' });
  });

  it('notes when recorded years do not line up', () => {
    const a = m('a', 'Ryan', 'Le', { college: 'Muir', year: '4th Year' });
    const b = m('b', 'Ryan', 'Le', { college: 'Muir', year: '1st Year' });
    const [pair] = findDuplicateMembers([a, b], [], [
      { member_id: 'a', academic_year_start: 2026, year_label: '4th Year', source: 'attendance_import' },
      { member_id: 'b', academic_year_start: 2026, year_label: '1st Year', source: 'attendance_import' },
    ], none);
    expect(pair.evidence).toContainEqual({ tone: 'against', text: 'Recorded years do not line up' });
  });

  it('never pairs merely similar names, and hides ignored pairs', () => {
    const a = m('a', 'An', 'Nguyen');
    const b = m('b', 'Anh', 'Nguyen');
    const c = m('c', 'Lan', 'Tran');
    const d = m('d', 'Lan', 'Tran');
    expect(findDuplicateMembers([a, b], [], [], none)).toEqual([]);
    expect(findDuplicateMembers([c, d], [], [], new Set(['d-c']))).toEqual([]);
  });

  it('ranks a shared email above a shared name', () => {
    const pairs = findDuplicateMembers([
      m('a', 'Ryan', 'Le'), m('b', 'Ryan', 'Le'),
      m('c', 'Kim', 'Do', { email: 'kim@ucsd.edu' }), m('d', 'Kimberly', 'Do', { email: 'kim@ucsd.edu' }),
    ], [], [], none);
    expect(pairs.map((p) => p.reason)).toEqual(['shared_email', 'same_name']);
  });

  it('finds pairs in a large roster without comparing everyone with everyone', () => {
    const roster = Array.from({ length: 4000 }, (_, i) => m(`m${i}`, `Given${i}`, ['Nguyen', 'Tran', 'Le'][i % 3]));
    roster.push(m('dup', 'Given6', 'Nguyen'));
    const started = Date.now();
    const pairs = findDuplicateMembers(roster, [], [], none);
    expect(pairs.map((p) => [p.target.id, p.source.id].sort())).toEqual([['dup', 'm6']]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
