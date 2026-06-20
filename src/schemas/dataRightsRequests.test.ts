import { DataRightsRequestFormSchema } from '.';

const validForm = {
  request_type: 'review',
  status: 'intake',
  subject_auth_user_id: '',
  subject_member_id: '',
  subject_display_name: 'Synthetic Member',
  contact_channel: 'official inbox',
  contact_reference: 'REQ-123',
  verification_status: 'not_started',
  verification_method: '',
  assigned_to: '',
  reviewer_id: '',
  priority: 'normal',
  summary: 'Brief synthetic request summary.',
  internal_notes: '',
  decision: '',
};

describe('DataRightsRequestFormSchema', () => {
  it('accepts minimal non-destructive request metadata', () => {
    expect(DataRightsRequestFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('rejects unsupported workflow fields', () => {
    const result = DataRightsRequestFormSchema.safeParse({
      ...validForm,
      delete_data: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid identifiers and oversized notes', () => {
    const result = DataRightsRequestFormSchema.safeParse({
      ...validForm,
      subject_member_id: 'not-a-uuid',
      internal_notes: 'x'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('requires an independent reviewer', () => {
    const adminId = '11111111-1111-4111-8111-111111111111';
    const result = DataRightsRequestFormSchema.safeParse({
      ...validForm,
      assigned_to: adminId,
      reviewer_id: adminId,
    });

    expect(result.success).toBe(false);
  });
});
