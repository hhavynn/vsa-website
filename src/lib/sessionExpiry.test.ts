/**
 * Mid-request expiry (#232): a request rejected with an expired JWT forces one
 * token refresh, so a dead session surfaces as SIGNED_OUT (and the admin
 * shell's re-authentication prompt) rather than a generic failure.
 */

import { QueryClient } from 'react-query';
import { handleRequestError, isSessionExpiredError, revalidateSession } from './sessionExpiry';
import { createQueryClient } from './queryClient';
import { DatabaseError, toUserMessage } from '../data/errors';
import { supabaseMock } from '../test-utils/supabaseMock';

jest.mock('./supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => {
  supabaseMock.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Lets the cache's onError handler (and the refresh it starts) settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('isSessionExpiredError', () => {
  it.each([
    ['a DatabaseError for an expired JWT', new DatabaseError('JWT expired', 'PGRST301')],
    ['a DatabaseError for an invalid JWT', new DatabaseError('JWT invalid', 'PGRST302')],
    ['a raw PostgREST error object', { message: 'JWT expired', code: 'PGRST301', details: '', hint: '' }],
  ])('recognises %s', (_label, error) => {
    expect(isSessionExpiredError(error)).toBe(true);
  });

  it.each([
    ['an RLS denial', new DatabaseError('Insufficient permissions', '42501')],
    ['a missing row', new DatabaseError('No rows found', 'PGRST116')],
    ['a plain Error', new Error('JWT expired')],
    ['null', null],
    ['a string', 'PGRST301'],
    ['an object with a non-string code', { code: 301 }],
  ])('does not mistake %s for an expired session', (_label, error) => {
    expect(isSessionExpiredError(error)).toBe(false);
  });
});

describe('revalidateSession', () => {
  it('shares one refresh between failures that land together', async () => {
    await Promise.all([revalidateSession(), revalidateSession(), revalidateSession()]);

    expect(supabaseMock.refreshSessionCalls).toBe(1);
  });

  it('refreshes again for a later failure', async () => {
    await revalidateSession();
    await revalidateSession();

    expect(supabaseMock.refreshSessionCalls).toBe(2);
  });

  it('never rejects, even if the refresh itself blows up', async () => {
    const original = supabaseMock.client.auth.refreshSession;
    supabaseMock.client.auth.refreshSession = async () => {
      throw new Error('network down');
    };
    try {
      await expect(revalidateSession()).resolves.toBeUndefined();
    } finally {
      supabaseMock.client.auth.refreshSession = original;
    }
  });
});

describe('handleRequestError', () => {
  it('refreshes the session for an expired JWT only', async () => {
    handleRequestError(new DatabaseError('Insufficient permissions', '42501'));
    handleRequestError(new Error('boom'));
    expect(supabaseMock.refreshSessionCalls).toBe(0);

    handleRequestError(new DatabaseError('JWT expired', 'PGRST301'));
    await settle();
    expect(supabaseMock.refreshSessionCalls).toBe(1);
  });
});

describe('the app query client', () => {
  it('refreshes the session when any query fails with an expired JWT', async () => {
    const client: QueryClient = createQueryClient();

    await expect(
      client.fetchQuery(['needs-auth'], () => Promise.reject(new DatabaseError('JWT expired', 'PGRST301')))
    ).rejects.toBeInstanceOf(DatabaseError);
    await settle();

    expect(supabaseMock.refreshSessionCalls).toBe(1);
  });

  it('refreshes the session when a mutation fails with an expired JWT', async () => {
    const client = createQueryClient();

    await expect(
      client
        .getMutationCache()
        .build(client, { mutationFn: () => Promise.reject(new DatabaseError('JWT expired', 'PGRST301')) })
        .execute()
    ).rejects.toBeInstanceOf(DatabaseError);
    await settle();

    expect(supabaseMock.refreshSessionCalls).toBe(1);
  });

  it('keeps the defaults the app had before the client moved out of App.tsx', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;

    expect(defaults).toEqual({
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    });
  });

  it('does not refresh the session for ordinary failures', async () => {
    const client = createQueryClient();

    await expect(
      client.fetchQuery(['ordinary'], () => Promise.reject(new DatabaseError('Insufficient permissions', '42501')))
    ).rejects.toBeInstanceOf(DatabaseError);
    await settle();

    expect(supabaseMock.refreshSessionCalls).toBe(0);
  });
});

describe('what the user is told', () => {
  it.each(['PGRST301', 'PGRST302'])('turns %s into a re-authentication message', (code) => {
    expect(toUserMessage(new DatabaseError('JWT expired', code), 'Failed to save')).toBe(
      'Your session expired. Try again, and sign in again if it keeps failing.'
    );
  });

  it('leaves other database errors on their existing messages', () => {
    expect(toUserMessage(new DatabaseError('x', '42501'), 'Failed to save')).toBe(
      "You don't have permission to do that."
    );
    expect(toUserMessage(new DatabaseError('x', 'XX000'), 'Failed to save')).toBe('Failed to save');
  });
});
