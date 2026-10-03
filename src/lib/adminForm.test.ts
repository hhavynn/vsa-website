import { DatabaseError, ValidationError } from '../data/errors';
import { serverErrorToForm } from './adminForm';

describe('serverErrorToForm', () => {
  it('lands a unique violation on the matching field', () => {
    const error = new DatabaseError('duplicate key value violates unique constraint "members_email_key"', '23505', 'Key (email)=(a@b.c) already exists.');
    const out = serverErrorToForm(error, { constraints: { members_email_key: { field: 'email', message: 'A member with this email already exists.' } } });
    expect(out.fields).toEqual({ email: 'A member with this email already exists.' });
    expect(out.message).toMatch(/highlighted field/);
  });

  it('keeps unknown unique violations form-level instead of guessing a field', () => {
    const out = serverErrorToForm(new DatabaseError('dup', '23505'));
    expect(out.fields).toEqual({});
    expect(out.message).toMatch(/already exists/);
  });

  it('surfaces RLS and raised-exception messages plainly', () => {
    expect(serverErrorToForm(new DatabaseError('rls', '42501')).message).toMatch(/permission/);
    expect(serverErrorToForm(new DatabaseError('Cycle is locked', 'P0001')).message).toBe('Cycle is locked');
  });

  it('maps a ValidationError with a field, and falls back for the unknown', () => {
    expect(serverErrorToForm(new ValidationError('Bad date', 'date')).fields).toEqual({ date: 'Bad date' });
    expect(serverErrorToForm(new Error('boom')).message).toMatch(/still here/);
    expect(serverErrorToForm('weird', { fallback: 'Nope' }).message).toBe('Nope');
  });
});
