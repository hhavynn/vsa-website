import {
  AttendanceImportMember,
  AttendanceImportRowInput,
  displayNameFromHouseCell,
  getSafeAttendanceMemberEnrichment,
  matchAttendanceImportRows,
  parseCSV,
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
