/**
 * AuthRepository.isUserAdmin (#231): the lookup behind the admin shell.
 *
 * It is a UX gate, not authorization (RLS is), so what matters is that it
 * reads only the one column it needs and that anything other than an explicit
 * `true` -- or a failed lookup -- is "not admin".
 */

import { authRepository } from './auth';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => {
  supabaseMock.reset();
});

describe('AuthRepository.isUserAdmin', () => {
  it('is true for a profile flagged admin', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });

    await expect(authRepository.isUserAdmin('user-1')).resolves.toBe(true);
  });

  it('is false for a profile that is not admin', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });

    await expect(authRepository.isUserAdmin('user-1')).resolves.toBe(false);
  });

  it.each([
    ['a null flag', { is_admin: null }],
    ['a missing profile row', null],
    ['a truthy non-boolean', { is_admin: 'true' }],
  ])('is false for %s', async (_label, data) => {
    supabaseMock.queueResult('user_profiles', { data, error: null });

    await expect(authRepository.isUserAdmin('user-1')).resolves.toBe(false);
  });

  it('asks only for is_admin, filtered to the given user', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });

    await authRepository.isUserAdmin('user-42');

    const [query] = supabaseMock.queriesFor('user_profiles');
    expect(query.calls).toContainEqual({ method: 'select', args: ['is_admin'] });
    expect(supabaseMock.filtersFor('user_profiles')).toContainEqual(['id', 'user-42']);
  });

  it('rejects, rather than answering false, when the lookup fails', async () => {
    // The caller decides how to fail: useAdmin treats a rejection as "not
    // admin". Swallowing it here would make an outage look like a demotion.
    supabaseMock.queueResult('user_profiles', {
      data: null,
      error: postgrestError('permission denied for table user_profiles', '42501'),
    });

    await expect(authRepository.isUserAdmin('user-1')).rejects.toBeInstanceOf(DatabaseError);
  });
});
