import { PUBLIC_UVSA_SCHOOL_COLUMNS, uvsaSchoolsRepository } from './uvsaSchools';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const school = { id: 'school-1', slug: 'ucsd', school_name: 'Example University', is_active: true };

describe('uvsaSchoolsRepository public/admin read paths (#291)', () => {
  it('fetches only active schools through a public column allowlist', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: [school], error: null });
    await expect(uvsaSchoolsRepository.getSchools()).resolves.toEqual([school]);
    const calls = supabaseMock.queriesFor('uvsa_schools')[0].calls;
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'select', args: [PUBLIC_UVSA_SCHOOL_COLUMNS] },
      { method: 'eq', args: ['is_active', true] },
      { method: 'order', args: ['sort_order', { ascending: true }] },
    ]));
    expect(PUBLIC_UVSA_SCHOOL_COLUMNS).not.toMatch(/verification_notes|confidence_level/);
  });

  it('returns an empty public list for a missing result, not for an authorization error', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchools()).resolves.toEqual([]);

    supabaseMock.queueResult('uvsa_schools', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(uvsaSchoolsRepository.getSchools()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('admin listing uses the full table, retaining inactive schools and internal columns', async () => {
    supabaseMock.queueResult('uvsa_schools', {
      data: [{ ...school, is_active: false, verification_notes: 'internal' }],
      error: null,
    });
    await expect(uvsaSchoolsRepository.getAllSchools()).resolves.toEqual([
      { ...school, is_active: false, verification_notes: 'internal' },
    ]);
    const calls = supabaseMock.queriesFor('uvsa_schools')[0].calls;
    expect(calls).toContainEqual({ method: 'select', args: ['*'] });
    expect(calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] });
  });

  it('uses the limited public projection for slug and id lookups', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: school, error: null });
    await expect(uvsaSchoolsRepository.getSchoolById('school-1')).resolves.toEqual(school);
    supabaseMock.queueResult('uvsa_schools', { data: school, error: null });
    await expect(uvsaSchoolsRepository.getSchoolBySlug('ucsd')).resolves.toEqual(school);
    const [byId, bySlug] = supabaseMock.queriesFor('uvsa_schools').map(q => q.calls);
    expect(byId).toContainEqual({ method: 'eq', args: ['id', 'school-1'] });
    expect(bySlug).toContainEqual({ method: 'eq', args: ['slug', 'ucsd'] });
    for (const calls of [byId, bySlug]) {
      expect(calls).toContainEqual({ method: 'select', args: [PUBLIC_UVSA_SCHOOL_COLUMNS] });
      expect(calls).toContainEqual({ method: 'single', args: [] });
    }
  });

  it('a missing record reports the existing not-found message instead of inventing a school', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchoolById('missing')).rejects.toThrow(
      'Failed to fetch school: School not found'
    );
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.getSchoolBySlug('missing')).rejects.toThrow(
      'Failed to fetch school by slug: School not found'
    );
  });

  it('pins the server-side error path for slug reads and writes', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: postgrestError('denied', '42501') });
    await expect(uvsaSchoolsRepository.getSchoolBySlug('ucsd')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });

    supabaseMock.queueResult('uvsa_schools', { data: school, error: null });
    await expect(uvsaSchoolsRepository.upsertSchool({ slug: 'ucsd' })).resolves.toEqual(school);
    expect(supabaseMock.queriesFor('uvsa_schools')[1].calls).toContainEqual({
      method: 'upsert', args: [{ slug: 'ucsd' }],
    });
  });

  it('deletes only the requested school id and returns errors on denied writes', async () => {
    supabaseMock.queueResult('uvsa_schools', { data: null, error: null });
    await expect(uvsaSchoolsRepository.deleteSchool('school-1')).resolves.toBeUndefined();
    expect(supabaseMock.queriesFor('uvsa_schools')[0].calls).toEqual(expect.arrayContaining([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'school-1'] },
    ]));

    supabaseMock.queueResult('uvsa_schools', { data: null, error: postgrestError('denied', '42501') });
    await expect(uvsaSchoolsRepository.deleteSchool('school-1')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
