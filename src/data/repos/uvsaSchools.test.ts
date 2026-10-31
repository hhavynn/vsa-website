/**
 * #291: UVSA school repository public/admin and write contracts.
 * Fully synthetic fixtures; no network or production student data.
 */
import { uvsaSchoolsRepository, PUBLIC_UVSA_SCHOOL_COLUMNS } from './uvsaSchools';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const fictionalSchool = {
  id: 'synthetic-school',
  school_name: 'Fictional University',
  short_name: 'FU',
  slug: 'fictional-university',
  is_active: true,
  sort_order: 2,
};

beforeEach(() => supabaseMock.reset());

describe('UVSA schools repository public/admin boundary (#291)', () => {
  it('reads only active public schools through a column allowlist', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: [fictionalSchool], error: null });
    await expect(uvsaSchoolsRepository.getSchools()).resolves.toEqual([fictionalSchool]);
    const [query] = supabaseMock.queriesFor('uvsa_schools');
    expect(query.calls).toContainEqual({ method: 'select', args: [PUBLIC_UVSA_SCHOOL_COLUMNS] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['is_active', true] });
    expect(query.calls).toContainEqual({ method: 'order', args: ['sort_order', { ascending: true }] });
    expect(PUBLIC_UVSA_SCHOOL_COLUMNS).not.toContain('*');
    expect(PUBLIC_UVSA_SCHOOL_COLUMNS).not.toContain('verification_notes');
    expect(PUBLIC_UVSA_SCHOOL_COLUMNS).not.toContain('confidence_level');
  });

  it('distinguishes an empty public list from a permission error', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchools()).resolves.toEqual([]);
    supabaseMock.queueResult('uvsa_schools', {
      data: null, error: postgrestError('permission denied for UVSA schools', '42501'),
    });
    await expect(uvsaSchoolsRepository.getSchools()).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Insufficient permissions', code: '42501',
    });
  });

  it('reads individual published-school fields by canonical ID and exact slug', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: fictionalSchool, error: null });
    await expect(uvsaSchoolsRepository.getSchoolById('synthetic-school')).resolves.toMatchObject(fictionalSchool);
    expect(supabaseMock.filtersFor('uvsa_schools')).toContainEqual(['id', 'synthetic-school']);
    supabaseMock.queueResult('uvsa_schools', { data: fictionalSchool, error: null });
    await expect(uvsaSchoolsRepository.getSchoolBySlug('fictional-university')).resolves.toMatchObject(fictionalSchool);
    expect(supabaseMock.filtersFor('uvsa_schools')).toContainEqual(['slug', 'fictional-university']);
    const selects = supabaseMock.queriesFor('uvsa_schools')
      .flatMap((query) => query.calls.filter((call) => call.method === 'select').map((call) => call.args[0]));
    expect(selects).toEqual([PUBLIC_UVSA_SCHOOL_COLUMNS, PUBLIC_UVSA_SCHOOL_COLUMNS]);
  });

  it('does not silently reinterpret an absent school or failed ID read', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchoolById('missing'))
      .rejects.toThrow('Failed to fetch school: School not found');
    supabaseMock.queueResult('uvsa_schools', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(uvsaSchoolsRepository.getSchoolById('private')).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Insufficient permissions',
    });
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchoolBySlug('missing-school'))
      .rejects.toThrow('Failed to fetch school by slug: School not found');
  });

  it('separates the admin full projection from public reads, including inactive schools', async () => {
    const inactive = { ...fictionalSchool, is_active: false, verification_notes: 'synthetic admin-only evidence' };
    supabaseMock.queueResult('uvsa_schools', { data: [inactive], error: null });
    await expect(uvsaSchoolsRepository.getAllSchools()).resolves.toEqual([inactive]);
    const query = supabaseMock.queriesFor('uvsa_schools')[0];
    expect(query.calls).toContainEqual({ method: 'select', args: ['*'] });
    expect(query.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] });
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getAllSchools()).resolves.toEqual([]);
  });

  it('preserves explicit admin upsert and delete shape, and propagates failures', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: fictionalSchool, error: null });
    await expect(uvsaSchoolsRepository.upsertSchool({ school_name: 'Fictional University' }))
      .resolves.toMatchObject(fictionalSchool);
    expect(supabaseMock.queriesFor('uvsa_schools')[0].calls).toContainEqual({
      method: 'upsert', args: [{ school_name: 'Fictional University' }],
    });

    supabaseMock.queueResult('uvsa_schools', {
      data: null, error: postgrestError('write denied', '42501'),
    });
    await expect(uvsaSchoolsRepository.upsertSchool({ slug: 'no-save' }))
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });

    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.deleteSchool('synthetic-school')).resolves.toBeUndefined();
    expect(supabaseMock.filtersFor('uvsa_schools')).toContainEqual(['id', 'synthetic-school']);
    supabaseMock.queueResult('uvsa_schools', {
      data: null, error: postgrestError('delete denied', '42501'),
    });
    await expect(uvsaSchoolsRepository.deleteSchool('synthetic-school'))
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });
});
