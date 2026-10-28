import {
  MAX_PICKUP_ACADEMIC_YEAR,
  MIN_PICKUP_ACADEMIC_YEAR,
  academicYearStartForSeason,
  formatPickupAcademicYear,
  formatPickupLabel,
  isTermConsistentWithYear,
  parsePickupValue,
  pickupCandidateOf,
  pickupTermCode,
  pickupYearOf,
} from './acePickupYear';

describe('parsePickupValue: exact terms', () => {
  it.each([
    ['FA21', 'FA21', 2021],
    ['WI22', 'WI22', 2021],
    ['SP22', 'SP22', 2021],
    ['FA22', 'FA22', 2022],
    ['SP23', 'SP23', 2022],
    ['FA23', 'FA23', 2023],
    ['WI24', 'WI24', 2023],
    ['SP24', 'SP24', 2023],
    ['FA25', 'FA25', 2025],
    ['SP26', 'SP26', 2025],
    ['FA26', 'FA26', 2026],
    ['SP27', 'SP27', 2026],
  ])('%s → %s in %i–', (input, term, year) => {
    expect(parsePickupValue(input)).toEqual({
      kind: 'term',
      term,
      season: term.slice(0, 2),
      academicYearStart: year,
    });
  });

  it('distinguishes FA23 (2023–24) from SP23 (2022–23)', () => {
    expect(pickupCandidateOf(parsePickupValue('FA23'))).toEqual({ academicYearStart: 2023, term: 'FA23' });
    expect(pickupCandidateOf(parsePickupValue('SP23'))).toEqual({ academicYearStart: 2022, term: 'SP23' });
  });

  it.each([
    ['fa23', 'FA23'],
    ['Fa 23', 'FA23'],
    [' sp24 ', 'SP24'],
    ['FA2023', 'FA23'],
    ['Fall 2023', 'FA23'],
    ['fall 23', 'FA23'],
    ['Winter 2024', 'WI24'],
    ["Spring '24", 'SP24'],
    ['SPRING 2024', 'SP24'],
  ])('normalizes %p to %s', (input, term) => {
    const parsed = parsePickupValue(input);
    expect(parsed.kind).toBe('term');
    expect(parsed.kind === 'term' && parsed.term).toBe(term);
  });

  it('maps the WI/SP 00 boundary back into 1999–00', () => {
    expect(parsePickupValue('SP00')).toMatchObject({ term: 'SP00', academicYearStart: 1999 });
    expect(parsePickupValue('FA00')).toMatchObject({ term: 'FA00', academicYearStart: 2000 });
  });

  it('reads four-digit pre-2000 terms unambiguously', () => {
    expect(parsePickupValue('FA1998')).toMatchObject({ term: 'FA98', academicYearStart: 1998 });
    expect(parsePickupValue('Spring 1999')).toMatchObject({ term: 'SP99', academicYearStart: 1998 });
  });
});

describe('parsePickupValue: two-digit century', () => {
  it('reads 00–69 as the 2000s', () => {
    expect(parsePickupValue('FA69')).toMatchObject({ academicYearStart: 2069 });
  });

  it.each(['FA70', 'SP98', 'WI99', '98-99'])('does not guess the century of %s', (input) => {
    expect(parsePickupValue(input)).toEqual({ kind: 'needs_review', issue: 'ambiguous_century', raw: input });
  });

  it('accepts an explicit century from the source', () => {
    expect(parsePickupValue('FA98', { century: 1900 })).toMatchObject({ term: 'FA98', academicYearStart: 1998 });
    expect(parsePickupValue('98-99', { century: 1900 })).toEqual({ kind: 'academic_year', academicYearStart: 1998 });
    expect(parsePickupValue('99-00', { century: 1900 })).toEqual({ kind: 'academic_year', academicYearStart: 1999 });
  });
});

describe('parsePickupValue: academic year without a term', () => {
  it.each([
    ['2021-22', 2021],
    ['2021–22', 2021],
    ['2021 - 2022', 2021],
    ['2021/22', 2021],
    ['21-22', 2021],
    ['1998–1999', 1998],
    ['2099-00', 2099],
  ])('%s → %i with no made-up term', (input, year) => {
    expect(parsePickupValue(input)).toEqual({ kind: 'academic_year', academicYearStart: year });
    expect(pickupCandidateOf(parsePickupValue(input))).toEqual({ academicYearStart: year, term: null });
  });

  it('rejects spans that are not one academic year', () => {
    expect(parsePickupValue('2021-23')).toMatchObject({ kind: 'needs_review', issue: 'non_consecutive_years' });
    expect(parsePickupValue('2022-2021')).toMatchObject({ kind: 'needs_review', issue: 'non_consecutive_years' });
  });

  it('does not decide which academic year a bare calendar year means', () => {
    expect(parsePickupValue('2021')).toEqual({ kind: 'needs_review', issue: 'calendar_year_only', raw: '2021' });
  });
});

describe('parsePickupValue: unknown and invalid', () => {
  it.each([null, undefined, '', '   '])('treats %p as unknown', (input) => {
    expect(parsePickupValue(input)).toEqual({ kind: 'unknown', reason: 'empty' });
  });

  it.each(['legacy', 'Legacy', ' LEGACY '])('treats %p as unknown legacy', (input) => {
    expect(parsePickupValue(input)).toEqual({ kind: 'unknown', reason: 'legacy' });
    expect(pickupCandidateOf(parsePickupValue(input))).toBeNull();
  });

  it.each(['FA', 'FA2', 'FA023', 'XY23', 'FA-23', 'gen 3', 'Fall of 2023', 'TBD', '23'])(
    'flags %p as malformed',
    (input) => {
      expect(parsePickupValue(input)).toEqual({ kind: 'needs_review', issue: 'malformed', raw: input });
    },
  );

  it('flags summer as unsupported rather than guessing its academic year', () => {
    expect(parsePickupValue('SU23')).toMatchObject({ kind: 'needs_review', issue: 'unsupported_season' });
    expect(parsePickupValue('Summer 2023')).toMatchObject({ kind: 'needs_review', issue: 'unsupported_season' });
  });

  it('flags years outside the supported range', () => {
    expect(parsePickupValue('FA1959')).toMatchObject({ kind: 'needs_review', issue: 'out_of_range' });
    expect(parsePickupValue('SP1960')).toMatchObject({ kind: 'needs_review', issue: 'out_of_range' });
    expect(parsePickupValue('FA2101')).toMatchObject({ kind: 'needs_review', issue: 'out_of_range' });
    expect(parsePickupValue('1959-60')).toMatchObject({ kind: 'needs_review', issue: 'out_of_range' });
    expect(parsePickupValue(`${MIN_PICKUP_ACADEMIC_YEAR}-${MIN_PICKUP_ACADEMIC_YEAR + 1}`).kind).toBe('academic_year');
    expect(parsePickupValue(`FA${MAX_PICKUP_ACADEMIC_YEAR}`).kind).toBe('term');
  });
});

describe('term helpers', () => {
  it('derives the academic year from season and calendar year', () => {
    expect(academicYearStartForSeason('FA', 2023)).toBe(2023);
    expect(academicYearStartForSeason('WI', 2024)).toBe(2023);
    expect(academicYearStartForSeason('SP', 2024)).toBe(2023);
  });

  it('builds canonical term codes', () => {
    expect(pickupTermCode('FA', 2023)).toBe('FA23');
    expect(pickupTermCode('SP', 2023)).toBe('SP24');
    expect(pickupTermCode('WI', 1999)).toBe('WI00');
    expect(pickupTermCode('FA', 2005)).toBe('FA05');
  });

  it('formats academic years', () => {
    expect(formatPickupAcademicYear(2023)).toBe('2023–24');
    expect(formatPickupAcademicYear(2009)).toBe('2009–10');
    expect(formatPickupAcademicYear(1999)).toBe('1999–00');
  });

  it('checks term/year consistency like the database does', () => {
    expect(isTermConsistentWithYear('FA23', 2023)).toBe(true);
    expect(isTermConsistentWithYear('SP24', 2023)).toBe(true);
    expect(isTermConsistentWithYear('SP23', 2023)).toBe(false);
    expect(isTermConsistentWithYear('FA23', 1923)).toBe(false);
    expect(isTermConsistentWithYear('fa23', 2023)).toBe(false);
    expect(isTermConsistentWithYear('SU23', 2023)).toBe(false);
  });
});

describe('pickupYearOf', () => {
  it('reads approved year and term', () => {
    expect(pickupYearOf({ pickup_academic_year_start: 2023, pickup_term: 'FA23' })).toEqual({
      status: 'verified',
      academicYearStart: 2023,
      term: 'FA23',
    });
  });

  it('keeps a year-only approval without inventing a term', () => {
    expect(pickupYearOf({ pickup_academic_year_start: 2021, pickup_term: null })).toEqual({
      status: 'verified',
      academicYearStart: 2021,
      term: null,
    });
  });

  it('treats rows from before the migration and null years as unknown', () => {
    expect(pickupYearOf({})).toEqual({ status: 'unknown' });
    expect(pickupYearOf({ pickup_academic_year_start: null, pickup_term: null })).toEqual({ status: 'unknown' });
  });

  it('never shows a value that breaks the database invariants', () => {
    expect(pickupYearOf({ pickup_academic_year_start: null, pickup_term: 'FA23' })).toEqual({ status: 'unknown' });
    expect(pickupYearOf({ pickup_academic_year_start: 2023, pickup_term: 'SP23' })).toEqual({ status: 'unknown' });
    expect(pickupYearOf({ pickup_academic_year_start: 2023.5 })).toEqual({ status: 'unknown' });
    expect(pickupYearOf({ pickup_academic_year_start: 1800 })).toEqual({ status: 'unknown' });
  });

  it('labels the exact term first, else the academic year, else nothing', () => {
    expect(formatPickupLabel({ status: 'verified', academicYearStart: 2023, term: 'SP24' })).toBe('SP24');
    expect(formatPickupLabel({ status: 'verified', academicYearStart: 2021, term: null })).toBe('2021–22');
    expect(formatPickupLabel({ status: 'unknown' })).toBeNull();
  });
});
