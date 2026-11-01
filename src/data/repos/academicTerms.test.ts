import { academicTermsRepository } from './academicTerms';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const WI27 = {
  id: 'wi27',
  code: 'WI27',
  label: 'Winter 2027',
  quarter: 'winter',
  academic_year_start: 2026,
  academic_year_end: 2027,
  starts_on: '2027-01-04',
  ends_on: '2027-03-20',
  is_active: false,
  display_order: 20262,
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

describe('academicTermsRepository.ensureTermForDate', () => {
  beforeEach(() => supabaseMock.reset());

  it('returns an existing term without overwriting its admin-set dates', async () => {
    supabaseMock.queueResult('academic_terms', { data: WI27, error: null });

    const term = await academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z');

    expect(term).toEqual(WI27);
    expect(supabaseMock.usedMethod('academic_terms', 'upsert')).toBe(false);
  });

  it('creates the term with default dates when it does not exist yet', async () => {
    supabaseMock
      .queueResult('academic_terms', { data: null, error: null })
      .queueResult('academic_terms', { data: { ...WI27, starts_on: '2027-01-01', ends_on: '2027-03-31' }, error: null });

    const term = await academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z');

    expect(term?.code).toBe('WI27');
    expect(supabaseMock.usedMethod('academic_terms', 'upsert')).toBe(true);
  });
});

describe('academicTermsRepository.getActiveTerm', () => {
  beforeEach(() => supabaseMock.reset());

  it('reads the active term through the repository', async () => {
    supabaseMock.queueResult('academic_terms', { data: WI27, error: null });

    await expect(academicTermsRepository.getActiveTerm()).resolves.toEqual(WI27);
    expect(supabaseMock.filtersFor('academic_terms')).toContainEqual(['is_active', true]);
  });

  it('returns null when no term is active', async () => {
    supabaseMock.queueResult('academic_terms', { data: null, error: null });

    await expect(academicTermsRepository.getActiveTerm()).resolves.toBeNull();
  });

  it('surfaces a failed lookup instead of returning null', async () => {
    supabaseMock.queueResult('academic_terms', { data: null, error: postgrestError('permission denied', '42501') });

    await expect(academicTermsRepository.getActiveTerm()).rejects.toThrow();
  });
});


describe('academicTermsRepository: remaining read/write boundaries (#291)', () => {
  beforeEach(() => supabaseMock.reset());

  it('lists terms newest academic year first and then by display order', async () => {
    supabaseMock.queueResult('academic_terms', { data: [WI27], error: null });

    await expect(academicTermsRepository.getTerms()).resolves.toEqual([WI27]);
    const orders = supabaseMock.queriesFor('academic_terms')[0].calls
      .filter((call) => call.method === 'order');
    expect(orders).toEqual([
      { method: 'order', args: ['academic_year_start', { ascending: false }] },
      { method: 'order', args: ['display_order', { ascending: false }] },
    ]);
  });

  it('returns an empty term list for a real empty or null result, not for a denied read', async () => {
    supabaseMock.queueResult('academic_terms', { data: [], error: null });
    await expect(academicTermsRepository.getTerms()).resolves.toEqual([]);

    supabaseMock.queueResult('academic_terms', { data: null, error: null });
    await expect(academicTermsRepository.getTerms()).resolves.toEqual([]);

    supabaseMock.queueResult('academic_terms', {
      data: null, error: postgrestError('synthetic permission denied', '42501'),
    });
    await expect(academicTermsRepository.getTerms()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('does not query or create a term for an invalid date', async () => {
    await expect(academicTermsRepository.ensureTermForDate('not a date')).resolves.toBeNull();
    expect(supabaseMock.queriesFor('academic_terms')).toHaveLength(0);
  });

  it('does not upsert a term if the existing-term lookup fails', async () => {
    supabaseMock.queueResult('academic_terms', {
      data: null, error: postgrestError('synthetic read denied', '42501'),
    });
    await expect(academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(supabaseMock.queriesFor('academic_terms')).toHaveLength(1);
    expect(supabaseMock.usedMethod('academic_terms', 'upsert')).toBe(false);
  });

  it('propagates a failed default-term upsert rather than claiming a term exists', async () => {
    supabaseMock
      .queueResult('academic_terms', { data: null, error: null })
      .queueResult('academic_terms', {
        data: null, error: postgrestError('synthetic write denied', '42501'),
      });

    await expect(academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    const queries = supabaseMock.queriesFor('academic_terms');
    expect(queries).toHaveLength(2);
    expect(queries[1].calls).toContainEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({ code: 'WI27', academic_year_start: 2026 }),
        { onConflict: 'code' },
      ],
    });
  });

  it('creates a term with its supplied dates and an updated timestamp', async () => {
    supabaseMock.queueResult('academic_terms', { data: WI27, error: null });
    const { id, created_at, updated_at, ...termInput } = WI27;
    await expect(academicTermsRepository.createTerm(
      termInput as Parameters<typeof academicTermsRepository.createTerm>[0]
    )).resolves.toEqual(WI27);
    const calls = supabaseMock.queriesFor('academic_terms')[0].calls;
    expect(calls).toContainEqual({
      method: 'insert',
      args: [expect.objectContaining({
        code: 'WI27',
        starts_on: '2027-01-04',
        ends_on: '2027-03-20',
        updated_at: expect.any(String),
      })],
    });
    expect(calls.some((call) => call.method === 'single')).toBe(true);
  });

  it('preserves the database permission error when createTerm fails', async () => {
    supabaseMock.queueResult('academic_terms', {
      data: null, error: postgrestError('synthetic create denied', '42501'),
    });
    const { id, created_at, updated_at, ...termInput } = WI27;
    await expect(academicTermsRepository.createTerm(
      termInput as Parameters<typeof academicTermsRepository.createTerm>[0]
    )).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
  });

  it('updates only the specified term and surfaces update failures', async () => {
    const updated = { ...WI27, starts_on: '2027-01-05' };
    supabaseMock.queueResult('academic_terms', { data: updated, error: null });
    await expect(academicTermsRepository.updateTerm('wi27', {
      starts_on: '2027-01-05',
    })).resolves.toEqual(updated);
    expect(supabaseMock.filtersFor('academic_terms')).toContainEqual(['id', 'wi27']);
    const calls = supabaseMock.queriesFor('academic_terms')[0].calls;
    expect(calls).toContainEqual({
      method: 'update',
      args: [expect.objectContaining({
        starts_on: '2027-01-05', updated_at: expect.any(String),
      })],
    });

    supabaseMock.queueResult('academic_terms', {
      data: null, error: postgrestError('synthetic update denied', '42501'),
    });
    await expect(academicTermsRepository.updateTerm('wi27', {
      starts_on: '2027-01-06',
    })).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(supabaseMock.filtersFor('academic_terms')).toContainEqual(['id', 'wi27']);
  });

  it('deactivates other terms before activating exactly the requested ID', async () => {
    supabaseMock
      .queueResult('academic_terms', { data: null, error: null })
      .queueResult('academic_terms', { data: null, error: null });
    await expect(academicTermsRepository.setActiveTerm('wi27')).resolves.toBeUndefined();
    const queries = supabaseMock.queriesFor('academic_terms');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toEqual(expect.arrayContaining([
      { method: 'neq', args: ['id', 'wi27'] },
      expect.objectContaining({
        method: 'update', args: [expect.objectContaining({ is_active: false })],
      }),
    ]));
    expect(queries[1].calls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['id', 'wi27'] },
      expect.objectContaining({
        method: 'update', args: [expect.objectContaining({ is_active: true })],
      }),
    ]));
  });

  it('does not attempt activation when deactivation fails', async () => {
    supabaseMock.queueResult('academic_terms', {
      data: null, error: postgrestError('synthetic deactivate denied', '42501'),
    });
    await expect(academicTermsRepository.setActiveTerm('wi27'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(supabaseMock.queriesFor('academic_terms')).toHaveLength(1);
  });

  it('reports an activation failure after the deactivation step instead of claiming success', async () => {
    supabaseMock
      .queueResult('academic_terms', { data: null, error: null })
      .queueResult('academic_terms', {
        data: null, error: postgrestError('synthetic activate denied', '42501'),
      });
    await expect(academicTermsRepository.setActiveTerm('wi27'))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    // Characterization only: the two requests are not a client-side transaction.
    expect(supabaseMock.queriesFor('academic_terms')).toHaveLength(2);
  });
});
