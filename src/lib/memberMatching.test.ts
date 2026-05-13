import { displayNameFromHouseCell, parseCSV } from './memberMatching';

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
