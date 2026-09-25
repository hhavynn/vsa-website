import {
  AttendanceImportMember,
  AttendanceImportRowInput,
  displayNameFromHouseCell,
  getSafeAttendanceMemberEnrichment,
  matchAttendanceImportRows,
  parseCSV,
  resolveMemberYearAdvance,
} from './memberMatching';

describe('house assignment parsing helpers', () => {
  test('strips preference rank and timestamp from wide house cells', () => {
    expect(displayNameFromHouseCell('Ai E Phan (first) (2025-10-15 20:55:54)')).toBe('Ai E Phan');
  });

  test('strips preference rank and dash timestamp from wide house cells', () => {
    expect(displayNameFromHouseCell('Adriel Luis Abaoag (second) \u2014 Sat 10/18/2025 14:37:49')).toBe('Adriel Luis Abaoag');
  });

  test('normalizes comma-separated names without treating preference as class year', () => {
    expect(displayNameFromHouseCell('Alyssa, Nott (first) (2025-10-15 21:05:46)')).toBe('Alyssa Nott');
  });

  test('parses quoted CSV cells that contain commas', () => {
    const rows = parseCSV('Bowser\n"Alyssa, Nott (first) (2025-10-15 21:05:46)"');
    expect(rows[0].Bowser).toBe('Alyssa, Nott (first) (2025-10-15 21:05:46)');
  });
});

const member = (overrides: Partial<AttendanceImportMember> & { id: string; first_name: string; last_name: string }): AttendanceImportMember => ({
  college: null,
  year: null,
  email: null,
  ...overrides,
});

const row = (overrides: Partial<AttendanceImportRowInput> = {}): AttendanceImportRowInput => {
  const displayName = overrides.displayName ?? 'Alex Nguyen';
  return {
    rowId: overrides.rowId ?? 'row-1',
    originalIndex: overrides.originalIndex ?? 0,
    csvRow: overrides.csvRow ?? {},
    displayName,
    matchName: overrides.matchName ?? displayName,
    csvCollege: overrides.csvCollege ?? '',
    csvYear: overrides.csvYear ?? '',
    csvEmail: overrides.csvEmail ?? '',
    invalidYear: overrides.invalidYear ?? false,
  };
};

const matchOne = (
  input: AttendanceImportRowInput,
  members: AttendanceImportMember[],
  alreadyImported = new Set<string>(),
) => matchAttendanceImportRows([input], members, alreadyImported)[0];

describe('attendance import matching helpers', () => {
  test('unique exact email match auto-matches', () => {
    const existing = member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'alex@ucsd.edu' });

    const result = matchOne(row({ csvEmail: ' ALEX@UCSD.EDU ' }), [existing]);

    expect(result.status).toBe('match');
    expect(result.reason).toBe('exact_email_match');
    expect(result.method).toBe('email');
    expect(result.matchedMember?.id).toBe('m1');
    expect(result.emailIsSchoolEmail).toBe(true);
  });

  test('duplicate member email becomes review', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'alex@ucsd.edu' }),
      member({ id: 'm2', first_name: 'Alyx', last_name: 'Nguyen', email: 'alex@ucsd.edu' }),
    ];

    const result = matchOne(row({ csvEmail: 'alex@ucsd.edu' }), members);

    expect(result.status).toBe('review');
    expect(result.reason).toBe('duplicate_email_conflict');
    expect(result.canMarkNew).toBe(false);
    expect(result.canForceMatch).toBe(false);
  });

  test('email match with clearly different name becomes review', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'alex@ucsd.edu' }),
    ];

    const result = matchOne(row({ displayName: 'Bao Tran', matchName: 'Bao Tran', csvEmail: 'alex@ucsd.edu' }), members);

    expect(result.status).toBe('review');
    expect(result.reason).toBe('email_name_conflict');
    expect(result.canMarkNew).toBe(false);
    expect(result.matchedMember?.id).toBe('m1');
  });

  test('missing email falls back to unique exact name', () => {
    const existing = member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen' });

    const result = matchOne(row(), [existing]);

    expect(result.status).toBe('match');
    expect(result.reason).toBe('exact_name_match');
    expect(result.method).toBe('exact_name');
  });

  test('similar duplicate names become review', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen' }),
      member({ id: 'm2', first_name: 'Alec', last_name: 'Nguyen' }),
    ];

    const result = matchOne(row({ displayName: 'Allex Nguyen', matchName: 'Allex Nguyen' }), members);

    expect(result.status).toBe('review');
    expect(result.reason).toBe('ambiguous_match');
  });

  test('fuzzy name with same college and year matches only when unambiguous', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alexandra', last_name: 'Nguyen', college: 'Muir', year: 'Senior' }),
      member({ id: 'm2', first_name: 'Bao', last_name: 'Tran', college: 'Muir', year: 'Senior' }),
    ];

    const result = matchOne(row({
      displayName: 'Alexandria Nguyen',
      matchName: 'Alexandria Nguyen',
      csvCollege: 'Muir College',
      csvYear: 'Senior',
    }), members);

    expect(result.status).toBe('match');
    expect(result.reason).toBe('fuzzy_name_match');
    expect(result.matchedMember?.id).toBe('m1');
  });

  test('multiple close fuzzy candidates become review', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', college: 'Muir', year: 'Senior' }),
      member({ id: 'm2', first_name: 'Alec', last_name: 'Nguyen', college: 'Muir', year: 'Senior' }),
    ];

    const result = matchOne(row({
      displayName: 'Allex Nguyen',
      matchName: 'Allex Nguyen',
      csvCollege: 'Muir',
      csvYear: 'Senior',
    }), members);

    expect(result.status).toBe('review');
    expect(result.reason).toBe('ambiguous_match');
  });

  test('existing member email is not overwritten', () => {
    const existing = member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'old@ucsd.edu' });
    const result = matchOne(row({ csvEmail: '', csvCollege: 'Muir', csvYear: 'Senior' }), [existing]);

    const updates = getSafeAttendanceMemberEnrichment({ ...result, csvEmail: 'new@ucsd.edu' }, [existing]);

    expect(updates.email).toBeUndefined();
  });

  test('missing member email is enriched only when safe', () => {
    const existing = member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen' });
    const result = matchOne(row({ csvEmail: 'alex@ucsd.edu' }), [existing]);

    const updates = getSafeAttendanceMemberEnrichment(result, [existing]);

    expect(result.reason).toBe('exact_name_match');
    expect(updates.email).toBe('alex@ucsd.edu');
  });

  test('missing member email is not enriched when another member uses it', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen' }),
      member({ id: 'm2', first_name: 'Bao', last_name: 'Tran', email: 'alex@ucsd.edu' }),
    ];
    const result = matchOne(row({ csvEmail: 'alex@ucsd.edu' }), members);

    const updates = getSafeAttendanceMemberEnrichment({ ...result, status: 'match', method: 'exact_name', matchedMember: members[0] }, members);

    expect(result.status).toBe('review');
    expect(updates.email).toBeUndefined();
  });

  test('duplicate CSV rows by email do not create duplicate member or attendance actions', () => {
    const rows = [
      row({ rowId: 'row-1', csvEmail: 'alex@ucsd.edu' }),
      row({ rowId: 'row-2', originalIndex: 1, csvEmail: 'alex@ucsd.edu' }),
    ];

    const results = matchAttendanceImportRows(rows, [], new Set());

    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('duplicate');
    expect(results[1].reason).toBe('duplicate_row');
  });

  test('already imported event/member rows are skipped', () => {
    const existing = member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'alex@ucsd.edu' });

    const result = matchOne(row({ csvEmail: 'alex@ucsd.edu' }), [existing], new Set(['m1']));

    expect(result.status).toBe('already');
    expect(result.reason).toBe('already_imported');
  });

  test('unresolved review/conflict rows produce no write actions', () => {
    const members = [
      member({ id: 'm1', first_name: 'Alex', last_name: 'Nguyen', email: 'alex@ucsd.edu' }),
      member({ id: 'm2', first_name: 'Alyx', last_name: 'Nguyen', email: 'alex@ucsd.edu' }),
    ];

    const result = matchOne(row({ csvEmail: 'alex@ucsd.edu' }), members);

    expect(result.status).toBe('review');
    expect(result.canMarkNew).toBe(false);
    expect(getSafeAttendanceMemberEnrichment(result, members)).toEqual({});
  });
});

describe('member year advances across seasons (attendance import)', () => {
  // Regression: a returning member matched by a new season's import kept the
  // standing they were first imported with. Fill-only enrichment never wrote
  // `year` unless it was empty, so a 2nd year who filled in this season's form
  // as a 3rd year stayed a 2nd year forever.
  test("a returning member's year advances to the standing on the new form", () => {
    expect(resolveMemberYearAdvance('2nd Year', '3rd Year', false)).toBe('3rd Year');
  });

  test('an empty year is still filled, as before', () => {
    expect(resolveMemberYearAdvance(null, '1st Year', false)).toBe('1st Year');
    expect(resolveMemberYearAdvance('', '4th Year', false)).toBe('4th Year');
  });

  test('an unchanged year produces no write', () => {
    expect(resolveMemberYearAdvance('3rd Year', '3rd Year', false)).toBeNull();
  });

  // The reason this is an advance rather than a plain overwrite: attendance for
  // a past event is imported from a CSV collected at that time, so backfilling
  // last season's event must not rewind a member who has since moved up.
  test('a stale backfill cannot rewind a member to an earlier year', () => {
    expect(resolveMemberYearAdvance('3rd Year', '2nd Year', false)).toBeNull();
    expect(resolveMemberYearAdvance('5th Year', '1st Year', false)).toBeNull();
  });

  test('an unrecognised CSV year is never written', () => {
    expect(resolveMemberYearAdvance('2nd Year', 'Senior', true)).toBeNull();
    expect(resolveMemberYearAdvance('2nd Year', '', false)).toBeNull();
  });

  test('a transfer progresses onto the shared scale', () => {
    expect(resolveMemberYearAdvance('1st Year Transfer', '2nd Year Transfer', false)).toBe('2nd Year Transfer');
    expect(resolveMemberYearAdvance('2nd Year Transfer', '3rd Year', false)).toBe('3rd Year');
  });

  test('a lateral move between tracks is left to an admin, not an import', () => {
    // Same rank, different label: a correction rather than a year passing.
    expect(resolveMemberYearAdvance('2nd Year', '2nd Year Transfer', false)).toBeNull();
  });

  test('an unrecognised stored year is replaced by a valid one', () => {
    expect(resolveMemberYearAdvance('Sophomore', '3rd Year', false)).toBe('3rd Year');
  });

  test('the whole enrichment path advances year on a high-confidence match', () => {
    const existing = member({
      id: 'm1',
      first_name: 'Lynna',
      last_name: 'Nguyen',
      email: 'lynna@ucsd.edu',
      year: '2nd Year',
    });
    const result = matchOne(row({ csvEmail: 'lynna@ucsd.edu', csvYear: '3rd Year' }), [existing]);

    const updates = getSafeAttendanceMemberEnrichment(result, [existing]);

    expect(result.status).toBe('match');
    expect(updates.year).toBe('3rd Year');
  });

  test('a low-confidence match never moves a year', () => {
    const existing = member({ id: 'm1', first_name: 'Lynna', last_name: 'Nguyen', year: '2nd Year' });
    const result = matchOne(row({ displayName: 'Lynna Nguyen', csvYear: '3rd Year' }), [existing]);

    const updates = getSafeAttendanceMemberEnrichment(
      { ...result, method: 'fuzzy_name', score: 0 },
      [existing],
    );

    expect(updates.year).toBeUndefined();
  });
});
