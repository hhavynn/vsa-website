import { cabinetYearsRepository } from './cabinetYears';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('cabinetYearsRepository current behavior (#291)', () => {
  it('sorts years newest first and returns an empty list for no data', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [{ id: 'year-2026' }], error: null });
    await expect(cabinetYearsRepository.getYears()).resolves.toEqual([{ id: 'year-2026' }]);
    expect(supabaseMock.queriesFor('cabinet_years')[0].calls.filter(c => c.method === 'order')).toEqual([
      { method: 'order', args: ['start_year', { ascending: false }] },
      { method: 'order', args: ['display_order', { ascending: false }] },
    ]);

    supabaseMock.queueResult('cabinet_years', { data: null, error: null });
    await expect(cabinetYearsRepository.getYears()).resolves.toEqual([]);
  });

  it('propagates read permission errors rather than masking them as an empty year list', async () => {
    supabaseMock.queueResult('cabinet_years', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(cabinetYearsRepository.getYears()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('writes creation and update timestamps and scopes an update by year ID', async () => {
    const year = { id: 'year-2026', start_year: 2026 };
    supabaseMock.queueResult('cabinet_years', { data: year, error: null });
    await cabinetYearsRepository.createYear({ start_year: 2026 } as Parameters<typeof cabinetYearsRepository.createYear>[0]);
    const insert = supabaseMock.queriesFor('cabinet_years')[0].calls.find(c => c.method === 'insert')?.args[0];
    expect(insert).toEqual(expect.objectContaining({
      start_year: 2026, updated_at: expect.any(String),
    }));

    supabaseMock.queueResult('cabinet_years', { data: year, error: null });
    await cabinetYearsRepository.updateYear('year-2026', { start_year: 2026 });
    expect(supabaseMock.filtersFor('cabinet_years')).toContainEqual(['id', 'year-2026']);
    const update = supabaseMock.queriesFor('cabinet_years')[1].calls.find(c => c.method === 'update')?.args[0];
    expect(update).toEqual(expect.objectContaining({ start_year: 2026, updated_at: expect.any(String) }));
  });

  it('deactivates other years before activating the requested year', async () => {
    supabaseMock.queueResult('cabinet_years', { data: null, error: null })
      .queueResult('cabinet_years', { data: null, error: null });
    await cabinetYearsRepository.setActiveYear('year-2026');
    const operations = supabaseMock.queriesFor('cabinet_years');
    expect(operations).toHaveLength(2);
    expect(operations[0].calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'update', args: [expect.objectContaining({ is_active: false })] }),
      { method: 'neq', args: ['id', 'year-2026'] },
    ]));
    expect(operations[1].calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'update', args: [expect.objectContaining({ is_active: true })] }),
      { method: 'eq', args: ['id', 'year-2026'] },
    ]));
  });

  it('stops after a failed deactivation without attempting to activate another year', async () => {
    supabaseMock.queueResult('cabinet_years', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(cabinetYearsRepository.setActiveYear('year-2026')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    expect(supabaseMock.queriesFor('cabinet_years')).toHaveLength(1);
  });
});
