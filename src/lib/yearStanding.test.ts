import { assessYearEvidence, classifyYear, planYearAdvance, YearObservation } from './yearStanding';

const obs = (academic_year_start: number, year_label: string, source: YearObservation['source'] = 'attendance_import'): YearObservation =>
  ({ member_id: 'm', academic_year_start, year_label, source });

describe('classifyYear', () => {
  it('ranks official, transfer and legacy labels on one scale', () => {
    expect(classifyYear('3rd Year')).toEqual({ kind: 'undergrad', rank: 3, transfer: false });
    expect(classifyYear('2nd Year Transfer')).toEqual({ kind: 'undergrad', rank: 2, transfer: true });
    expect(classifyYear('Sophomore')).toEqual({ kind: 'undergrad', rank: 2, transfer: false });
    expect(classifyYear('senior')).toEqual({ kind: 'undergrad', rank: 4, transfer: false });
  });

  it('recognizes alumni and graduate students, and leaves everything else unknown', () => {
    expect(classifyYear('Alumni').kind).toBe('post');
    expect(classifyYear('Graduate student').kind).toBe('post');
    expect(classifyYear('PhD').kind).toBe('post');
    expect(classifyYear('').kind).toBe('unknown');
    expect(classifyYear('idk').kind).toBe('unknown');
  });
});

describe('assessYearEvidence', () => {
  const member = { year: '2nd Year' };

  it.each([
    ['1st Year', 2024, '2nd Year', 2025],
    ['2nd Year', 2025, '3rd Year', 2026],
    ['3rd Year', 2026, '4th Year', 2027],
  ])('%s in %i fits %s in %i', (before, beforeYear, now, eventYear) => {
    expect(assessYearEvidence(now, member, [obs(beforeYear, before)], eventYear)).toBe('compatible');
  });

  it('fits a backfill from before the observation', () => {
    expect(assessYearEvidence('1st Year', member, [obs(2026, '3rd Year')], 2024)).toBe('compatible');
  });

  it('calls a large gap for the same year implausible', () => {
    expect(assessYearEvidence('1st Year', member, [obs(2026, '4th Year')], 2026)).toBe('implausible');
  });

  it('is looser with migration estimates than with reported years', () => {
    expect(assessYearEvidence('4th Year', member, [obs(2025, '2nd Year')], 2025)).toBe('uncertain');
    expect(assessYearEvidence('4th Year', member, [obs(2025, '2nd Year', 'profile_estimate')], 2025)).toBe('compatible');
  });

  it('allows transfer students an extra year either way', () => {
    expect(assessYearEvidence('4th Year', member, [obs(2025, '1st Year Transfer')], 2026)).toBe('compatible');
  });

  it('accepts alumni wording once the member would be past 3rd year, and never calls it a contradiction', () => {
    expect(assessYearEvidence('Alumni', member, [obs(2023, '3rd Year')], 2026)).toBe('compatible');
    expect(assessYearEvidence('Alumni', member, [obs(2026, '1st Year')], 2026)).toBe('uncertain');
  });

  it('treats a student past 5th year conservatively', () => {
    expect(assessYearEvidence('5th Year', member, [obs(2022, '4th Year')], 2026)).toBe('compatible');
    expect(assessYearEvidence('1st Year', member, [obs(2022, '4th Year')], 2026)).toBe('implausible');
  });

  it('is unknown for a missing or unrecognized row year', () => {
    expect(assessYearEvidence('', member, [obs(2025, '2nd Year')], 2026)).toBe('unknown');
    expect(assessYearEvidence('Class of 2028??', member, [obs(2025, '2nd Year')], 2026)).toBe('unknown');
  });

  it('without dated observations, compares with the profile but never calls it implausible', () => {
    expect(assessYearEvidence('3rd Year', member, [], 2026)).toBe('compatible');
    expect(assessYearEvidence('5th Year', member, [], 2026)).toBe('uncertain');
  });

  it('prefers the observation nearest the event', () => {
    const history = [obs(2022, '1st Year'), obs(2025, '4th Year')];
    expect(assessYearEvidence('4th Year', member, history, 2025)).toBe('compatible');
  });
});

describe('planYearAdvance', () => {
  it('advances forward for a current event', () => {
    expect(planYearAdvance('2nd Year', '3rd Year', false, [obs(2025, '2nd Year')], 2026)).toBe('3rd Year');
  });

  it('never rewinds or moves sideways', () => {
    expect(planYearAdvance('3rd Year', '2nd Year', false, [], 2026)).toBeNull();
    expect(planYearAdvance('3rd Year', '3rd Year', false, [], 2026)).toBeNull();
  });

  it('never changes current standing from an event older than the latest observation', () => {
    expect(planYearAdvance('1st Year Transfer', '3rd Year', false, [obs(2026, '1st Year Transfer')], 2024)).toBeNull();
  });

  it('fills an empty year, and keeps an unrankable stored value', () => {
    expect(planYearAdvance(null, '1st Year', false, [], 2026)).toBe('1st Year');
    expect(planYearAdvance('Graduate', '4th Year', false, [], 2026)).toBeNull();
  });

  it('ranks legacy labels on the stored side', () => {
    expect(planYearAdvance('Sophomore', '3rd Year', false, [], 2026)).toBe('3rd Year');
    expect(planYearAdvance('Senior', '3rd Year', false, [], 2026)).toBeNull();
  });

  it('ignores invalid and non-official years', () => {
    expect(planYearAdvance('1st Year', 'Alumni', true, [], 2026)).toBeNull();
    expect(planYearAdvance('1st Year', '', false, [], 2026)).toBeNull();
  });

  it('does not promote anyone because time passed', () => {
    expect(planYearAdvance('1st Year', '1st Year', false, [obs(2022, '1st Year')], 2026)).toBeNull();
  });
});
