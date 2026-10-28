import { cabinetRolesRepository } from './cabinetRolesRepository';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('cabinetRolesRepository current behavior (#291)', () => {
  it('lists roles in display order with a stable empty result', async () => {
    const role = { role_slug: 'president', display_order: 1 };
    supabaseMock.queueResult('cabinet_role_descriptions', { data: [role], error: null });
    await expect(cabinetRolesRepository.getAllRoles()).resolves.toEqual([role]);
    expect(supabaseMock.queriesFor('cabinet_role_descriptions')[0].calls).toContainEqual({
      method: 'order', args: ['display_order', { ascending: true }],
    });
    supabaseMock.queueResult('cabinet_role_descriptions', { data: null, error: null });
    await expect(cabinetRolesRepository.getAllRoles()).resolves.toEqual([]);
  });

  it('surfaces database permission errors instead of an empty catalog', async () => {
    supabaseMock.queueResult('cabinet_role_descriptions', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(cabinetRolesRepository.getAllRoles()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('creates through a single-row insert and rejects a null returned row', async () => {
    supabaseMock.queueResult('cabinet_role_descriptions', { data: { role_slug: 'president' }, error: null });
    await expect(cabinetRolesRepository.createRole({
      role_slug: 'president', role_name: 'President',
    } as Parameters<typeof cabinetRolesRepository.createRole>[0])).resolves.toEqual({
      role_slug: 'president',
    });
    const q = supabaseMock.queriesFor('cabinet_role_descriptions')[0];
    expect(q.calls.find(c => c.method === 'insert')?.args[0]).toEqual({
      role_slug: 'president', role_name: 'President',
    });
    expect(q.calls.some(c => c.method === 'single')).toBe(true);

    supabaseMock.queueResult('cabinet_role_descriptions', { data: null, error: null });
    await expect(cabinetRolesRepository.createRole({
      role_slug: 'president', role_name: 'President',
    } as Parameters<typeof cabinetRolesRepository.createRole>[0])).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Failed to create cabinet role description',
    });
  });

  it('updates and deletes by role_slug, not by an arbitrary display name', async () => {
    supabaseMock.queueResult('cabinet_role_descriptions', { data: { role_slug: 'president' }, error: null });
    await cabinetRolesRepository.updateRole('president', { role_name: 'President' });
    expect(supabaseMock.filtersFor('cabinet_role_descriptions')).toContainEqual(['role_slug', 'president']);
    expect(supabaseMock.queriesFor('cabinet_role_descriptions')[0].calls.find(c => c.method === 'update')?.args[0]).toEqual({
      role_name: 'President',
    });
    supabaseMock.queueResult('cabinet_role_descriptions', { data: null, error: null });
    await cabinetRolesRepository.deleteRole('president');
    expect(supabaseMock.usedMethod('cabinet_role_descriptions', 'delete')).toBe(true);
    expect(supabaseMock.filtersFor('cabinet_role_descriptions')).toHaveLength(2);
  });

  it('propagates rejected deletes without pretending the role was removed', async () => {
    supabaseMock.queueResult('cabinet_role_descriptions', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(cabinetRolesRepository.deleteRole('president')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
