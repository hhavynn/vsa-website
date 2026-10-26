import {
  attendanceMappingProblem,
  buildAttendanceRows,
  detectAttendanceColumns,
  EMPTY_ATTENDANCE_MAPPING,
} from './attendanceCsv';

describe('detectAttendanceColumns', () => {
  it('maps a typical Google Forms export', () => {
    const mapping = detectAttendanceColumns([
      'Timestamp', 'Email Address', 'Name (First & Last)', 'What year are you?', 'What college are you in?',
    ]);
    expect(mapping).toEqual({
      ...EMPTY_ATTENDANCE_MAPPING,
      useFullName: true,
      fullName: 'Name (First & Last)',
      email: 'Email Address',
      year: 'What year are you?',
      college: 'What college are you in?',
    });
  });

  it('prefers separate first and last name columns when both exist', () => {
    const mapping = detectAttendanceColumns(['First Name', 'Last Name', 'Full name', 'UCSD Email']);
    expect(mapping).toMatchObject({ useFullName: false, firstName: 'First Name', lastName: 'Last Name', email: 'UCSD Email' });
  });

  it('never reads unrelated questions as the attendee name', () => {
    const mapping = detectAttendanceColumns([
      'Is this your first event?', 'Last updated', 'Preferred name', 'Big / little name', 'Emergency contact name',
      'Name of your house', 'Student name',
    ]);
    expect(mapping.firstName).toBe('');
    expect(mapping.lastName).toBe('');
    expect(mapping.fullName).toBe('Student name');
  });

  it('does not take a graduation year or a timestamp as the year in school', () => {
    const mapping = detectAttendanceColumns(['Timestamp', 'Expected graduation year', 'Year in school']);
    expect(mapping.year).toBe('Year in school');
  });

  it('keeps a second email question as a secondary email', () => {
    const mapping = detectAttendanceColumns(['Email Address', 'Name', 'UCSD email (if different)']);
    expect(mapping.email).toBe('Email Address');
    expect(mapping.secondaryEmail).toBe('UCSD email (if different)');
  });

  it('never assigns one header to two roles', () => {
    const mapping = detectAttendanceColumns(['Name', 'College']);
    expect(mapping.fullName).toBe('Name');
    expect(mapping.college).toBe('College');
    expect(mapping.year).toBe('');
  });
});

describe('attendanceMappingProblem', () => {
  const headers = ['Name', 'First', 'Last', 'Email'];

  it('requires a name column', () => {
    expect(attendanceMappingProblem({ ...EMPTY_ATTENDANCE_MAPPING, email: 'Email' }, headers)).toMatch(/No name column/);
    expect(attendanceMappingProblem({ ...EMPTY_ATTENDANCE_MAPPING, useFullName: true }, headers)).toMatch(/No name column/);
  });

  it('accepts a full name, or first and/or last name columns', () => {
    expect(attendanceMappingProblem({ ...EMPTY_ATTENDANCE_MAPPING, useFullName: true, fullName: 'Name' }, headers)).toBeNull();
    expect(attendanceMappingProblem({ ...EMPTY_ATTENDANCE_MAPPING, firstName: 'First', lastName: 'Last' }, headers)).toBeNull();
  });

  it('rejects a mapping that names a column this file does not have', () => {
    expect(attendanceMappingProblem({ ...EMPTY_ATTENDANCE_MAPPING, useFullName: true, fullName: 'Full Name' }, headers)).toMatch(/not in this file/);
  });
});

describe('buildAttendanceRows', () => {
  const mapping = {
    ...EMPTY_ATTENDANCE_MAPPING,
    useFullName: true,
    fullName: 'Name',
    email: 'Email',
    secondaryEmail: 'UCSD',
    college: 'College',
    year: 'Year',
  };

  it('keeps accents for display and folds them for matching', () => {
    const [row] = buildAttendanceRows([{ Name: 'nguyễn văn AN', Email: '', UCSD: '', College: 'Muir', Year: '2' }], mapping);
    expect(row.displayName).toBe('Nguyễn Văn An');
    expect(row.name.key).toBe('nguyen van an');
    expect(row.firstName).toBe('Nguyễn');
    expect(row.lastName).toBe('Văn An');
    expect(row.csvYear).toBe('2nd Year');
    expect(row.invalidYear).toBe(false);
  });

  it('normalizes and de-duplicates emails, primary first, and drops non-addresses', () => {
    const [row] = buildAttendanceRows([{ Name: 'An Tran', Email: ' An@Gmail.com ', UCSD: 'an@gmail.com', College: '', Year: '' }], mapping);
    expect(row.emails).toEqual(['an@gmail.com']);
    const [other] = buildAttendanceRows([{ Name: 'An Tran', Email: 'N/A', UCSD: 'ATRAN@UCSD.EDU', College: '', Year: '' }], mapping);
    expect(other.emails).toEqual(['atran@ucsd.edu']);
    expect(other.csvEmail).toBe('atran@ucsd.edu');
  });

  it('treats a comma in a full name as a separator, not a surname-first marker', () => {
    const [row] = buildAttendanceRows([{ Name: 'Lynna, On', Email: '', UCSD: '', College: '', Year: '' }], mapping);
    expect(row.displayName).toBe('Lynna On');
  });

  it('marks an unrecognized year without guessing', () => {
    const [row] = buildAttendanceRows([{ Name: 'An Tran', Email: '', UCSD: '', College: '', Year: 'Alumni' }], mapping);
    expect(row.csvYear).toBe('Alumni');
    expect(row.invalidYear).toBe(true);
  });

  it('builds names from separate first and last columns', () => {
    const [row] = buildAttendanceRows(
      [{ First: 'thanh tâm', Last: 'NGUYỄN' }],
      { ...EMPTY_ATTENDANCE_MAPPING, firstName: 'First', lastName: 'Last' },
    );
    expect(row.displayName).toBe('Thanh Tâm Nguyễn');
    expect(row.name.given).toEqual(['thanh', 'tam']);
    expect(row.name.family).toEqual(['nguyen']);
  });

  it('gives a nameless row an empty display name so it can never become a member', () => {
    const [row] = buildAttendanceRows([{ Name: '  ', Email: 'x@ucsd.edu', UCSD: '', College: '', Year: '' }], mapping);
    expect(row.displayName).toBe('');
  });
});
