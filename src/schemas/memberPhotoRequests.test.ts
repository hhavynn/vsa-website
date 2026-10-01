import { MemberPhotoRequestFormSchema } from '.';

const validForm = {
  submitted_name: 'Synthetic Member',
  submitted_email: 'synthetic@ucsd.edu',
  note_to_admins: 'Please use this photo for my profile.',
  consent_confirmed: true as const,
};

describe('MemberPhotoRequestFormSchema', () => {
  it('accepts a valid consented request', () => {
    expect(MemberPhotoRequestFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('requires consent to be explicitly true', () => {
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, consent_confirmed: false }).success,
    ).toBe(false);
  });

  it('rejects missing name and invalid email', () => {
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, submitted_name: '   ' }).success,
    ).toBe(false);
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, submitted_email: 'not-an-email' })
        .success,
    ).toBe(false);
  });

  it('rejects oversized notes and unknown fields', () => {
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, note_to_admins: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, storage_path_approved: 'sneaky' })
        .success,
    ).toBe(false);
  });
});

describe('MemberPhotoRequestFormSchema email domain', () => {
  const validForm = {
    submitted_name: 'Synthetic Member',
    submitted_email: 'synthetic@ucsd.edu',
    note_to_admins: '',
    consent_confirmed: true as const,
  };

  it('requires a @ucsd.edu address, matching the upload broker', () => {
    const result = MemberPhotoRequestFormSchema.safeParse({ ...validForm, submitted_email: 'me@gmail.com' });
    const issues = result.success ? [] : result.error.errors;
    expect(result.success).toBe(false);
    expect(issues[0]?.path).toEqual(['submitted_email']);
    expect(issues[0]?.message).toMatch(/@ucsd\.edu/);
  });

  it('accepts mixed-case UCSD addresses', () => {
    expect(
      MemberPhotoRequestFormSchema.safeParse({ ...validForm, submitted_email: 'Me@UCSD.edu' }).success,
    ).toBe(true);
  });
});
