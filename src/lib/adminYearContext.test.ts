import { describeYearContext, rowsForYear, yearsInRows } from './adminYearContext';

describe('describeYearContext', () => {
  it('marks the current academic year', () => {
    expect(describeYearContext(2026, 2026)).toMatchObject({ kind: 'current', badge: 'Current year', label: '2026–27', isArchived: false });
  });

  it('labels an earlier year as archived data', () => {
    const context = describeYearContext(2025, 2026);
    expect(context.kind).toBe('archived');
    expect(context.badge).toBe('Viewing archived 2025–26 data');
    expect(context.isArchived).toBe(true);
  });

  it('labels a later year as upcoming, not archived', () => {
    const context = describeYearContext(2027, 2026);
    expect(context).toMatchObject({ kind: 'upcoming', isArchived: false, label: '2027–28' });
    expect(context.badge).toContain('2027–28');
  });

  it('rolls the century boundary label correctly', () => {
    expect(describeYearContext(2099, 2099).label).toBe('2099–00');
  });
});

describe('rowsForYear', () => {
  const rows = [
    { id: 'a', academic_year_start: 2025 },
    { id: 'b', academic_year_start: 2026 },
    { id: 'c', academic_year_start: null },
    { id: 'd' },
    { id: 'e', academic_year_start: 2026 },
  ];

  it('never mixes records from another year', () => {
    expect(rowsForYear(rows, 2026).map((row) => row.id)).toEqual(['b', 'e']);
    expect(rowsForYear(rows, 2025).map((row) => row.id)).toEqual(['a']);
  });

  it('drops rows with no year instead of guessing', () => {
    expect(rowsForYear(rows, 2024)).toEqual([]);
  });
});

describe('yearsInRows', () => {
  it('lists distinct years newest first', () => {
    expect(yearsInRows([{ academic_year_start: 2024 }, { academic_year_start: 2026 }, { academic_year_start: 2024 }, {}])).toEqual([2026, 2024]);
  });
});
