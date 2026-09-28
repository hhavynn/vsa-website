import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { signInErrorMessage } from './SignInForm';

// setupTests replaces @supabase/supabase-js with a stub; these tests need the
// real error classes and type guards that signInErrorMessage relies on.
// babel-plugin-jest-hoist lifts both calls above the imports.
jest.unmock('@supabase/supabase-js');
jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

describe('signInErrorMessage (#235)', () => {
  const GENERIC = 'Incorrect email or password.';

  it('gives the same message for an unknown account and a wrong password', () => {
    const invalid = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(signInErrorMessage(invalid)).toBe(GENERIC);
  });

  it('does not reveal that an unconfirmed address is registered', () => {
    const unconfirmed = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
    expect(signInErrorMessage(unconfirmed)).toBe(GENERIC);
  });

  it('tells a rate-limited user to wait instead of retrying', () => {
    const limited = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit');
    expect(signInErrorMessage(limited)).toMatch(/too many sign-in attempts/i);
  });

  it('distinguishes a connection failure', () => {
    expect(signInErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(/connection/i);
  });

  it('keeps the admin-verification failure message', () => {
    expect(signInErrorMessage(new Error('Unable to verify admin access.'))).toBe('Unable to verify admin access.');
  });

  it('never echoes arbitrary error text', () => {
    expect(signInErrorMessage(new Error('relation "user_profiles" does not exist'))).toBe(GENERIC);
    expect(signInErrorMessage('boom')).toBe(GENERIC);
  });
});
