import { getLegacyHouseArchiveByYear, getVerifiedLegacyHouseYears, LEGACY_HOUSE_ARCHIVE } from './legacyHouseArchive';

describe('legacy House archive data', () => {
  it('includes the verified House eras plus the archive gap', () => {
    expect(LEGACY_HOUSE_ARCHIVE.map((entry) => entry.academicYear)).toEqual([
      '2018-2019',
      '2019-2020',
      '2020-2021',
      '2021-2022',
      '2022-2023',
      '2023-2024',
      '2024-2025',
      '2025-2026',
      '2026-2027',
    ]);
  });

  it('keeps the 2025-2026 Mario Houses archived, linked to their own year', () => {
    const mario = getLegacyHouseArchiveByYear('2025-2026');
    expect(mario?.houses).toEqual(['Bowser', 'Donkey Kong', 'Boo', 'Toad']);
    expect(mario?.theme).toBe('Super Mario');
    expect(mario?.status).toBe('verified');
    expect(Object.values(mario?.currentHouseLinks ?? {})).toEqual([
      '/house/year/2025-2026/bowser',
      '/house/year/2025-2026/donkey-kong',
      '/house/year/2025-2026/boo',
      '/house/year/2025-2026/toad',
    ]);
  });

  it('records 2026-2027 as the current My Little Pony year, spelled "Pinkie Pie"', () => {
    const pony = getLegacyHouseArchiveByYear('2026-2027');
    expect(pony?.houses).toEqual(['Twilight Sparkle', 'Applejack', 'Pinkie Pie', 'Rarity']);
    expect(pony?.status).toBe('current');
    expect(LEGACY_HOUSE_ARCHIVE.filter((entry) => entry.status === 'current').map((entry) => entry.academicYear)).toEqual(['2026-2027']);
    expect(JSON.stringify(LEGACY_HOUSE_ARCHIVE)).not.toMatch(/Pinky/);
  });

  it('marks 2020-2021 as an unconfirmed archive gap', () => {
    const gapYear = getLegacyHouseArchiveByYear('2020-2021');
    expect(gapYear?.status).toBe('unconfirmed');
    expect(gapYear?.houses).toEqual([]);
  });

  it('keeps the designer Houses in 2019-2020', () => {
    expect(getLegacyHouseArchiveByYear('2019-2020')?.houses).toEqual(['Gucci', 'Comme des Garçons', 'Supreme', 'Yves Saint Laurent']);
  });

  it('keeps 2023-2024 as the beverage year', () => {
    expect(getLegacyHouseArchiveByYear('2023-2024')?.houses).toEqual([
      'Ca Phe Sua Da',
      'Banana Milk',
      'Matcha',
      'Yakult',
    ]);
  });

  it('records 2024-2025 as the three-House Sanrio year', () => {
    expect(getLegacyHouseArchiveByYear('2024-2025')?.houses).toEqual(['Badtz-maru', 'Keroppi', 'Kuromi']);
  });

  it('excludes the archive gap from verified years', () => {
    expect(getVerifiedLegacyHouseYears().map((entry) => entry.academicYear)).not.toContain('2020-2021');
  });
});
