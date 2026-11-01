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


describe('cabinetYearsRepository: write failure boundaries (#291)', () => {
  it('does not report a year creation when the insert is denied', async () => {
    supabaseMock.queueResult('cabinet_years', {
      data: null, error: postgrestError('synthetic insert denied', '42501'),
    });
    await expect(cabinetYearsRepository.createYear({
      start_year: 2026,
    } as Parameters<typeof cabinetYearsRepository.createYear>[0])).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    const queries = supabaseMock.queriesFor('cabinet_years');
    expect(queries).toHaveLength(1);
    expect(queries[0].calls.some((call) => call.method === 'insert')).toBe(true);
  });

  it('does not report a year update when the scoped update is denied', async () => {
    supabaseMock.queueResult('cabinet_years', {
      data: null, error: postgrestError('synthetic update denied', '42501'),
    });
    await expect(cabinetYearsRepository.updateYear('synthetic-year', {
      start_year: 2026,
    })).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    const queries = supabaseMock.queriesFor('cabinet_years');
    expect(queries).toHaveLength(1);
    expect(supabaseMock.filtersFor('cabinet_years')).toContainEqual(['id', 'synthetic-year']);
    expect(queries[0].calls.some((call) => call.method === 'update')).toBe(true);
  });

  it('surfaces the second activation failure without claiming both writes were atomic', async () => {
    supabaseMock
      .queueResult('cabinet_years', { data: null, error: null })
      .queueResult('cabinet_years', {
        data: null, error: postgrestError('synthetic activation denied', '42501'),
      });
    await expect(cabinetYearsRepository.setActiveYear('synthetic-year'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    const queries = supabaseMock.queriesFor('cabinet_years');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toContainEqual({ method: 'neq', args: ['id', 'synthetic-year'] });
    expect(queries[1].calls).toContainEqual({ method: 'eq', args: ['id', 'synthetic-year'] });
    // Characterization, not a fix: the repository does not roll back the first request.
  });
});
