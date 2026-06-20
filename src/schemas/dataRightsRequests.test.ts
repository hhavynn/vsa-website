import {
  DataRightsDependencyPreviewSchema,
  DataRightsExportBundleSchema,
  DataRightsRequestFormSchema,
} from '.';

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

const validPreview = {
  version: 1,
  request_id: '11111111-1111-4111-8111-111111111111',
  read_only: true,
  subject_signals: {
    has_auth_user_id: true,
    auth_user_exists: true,
    has_member_id: true,
    member_exists: true,
    has_display_name: true,
    subject_is_admin: false,
    identity_confidence: 'confirmed_link',
  },
  counts: {
    profile_rows: 1,
    linked_member_rows: 1,
    candidate_member_rows: 1,
    confirmed_member_rows: 1,
    auth_attendance_rows: 2,
    member_attendance_rows: 3,
    user_points_rows: 1,
    house_membership_rows: 1,
    feedback_rows: 0,
    legacy_chat_log_rows: 0,
    import_raw_rows: 1,
  },
  references: {
    avatar_reference_present: false,
    ai_usage_attributable: false,
    media_attribution: 'needs_schema_verification',
    external_provider_review_required: true,
  },
  warnings: ['Synthetic warning.'],
  next_steps: ['Synthetic next step.'],
};

describe('DataRightsDependencyPreviewSchema', () => {
  it('accepts the versioned read-only count response', () => {
    expect(DataRightsDependencyPreviewSchema.safeParse(validPreview).success).toBe(true);
  });

  it('rejects raw content or destructive action fields', () => {
    const result = DataRightsDependencyPreviewSchema.safeParse({
      ...validPreview,
      raw_rows: [{ private_content: 'not allowed' }],
      delete_data: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative counts and non-read-only responses', () => {
    const result = DataRightsDependencyPreviewSchema.safeParse({
      ...validPreview,
      read_only: false,
      counts: { ...validPreview.counts, feedback_rows: -1 },
    });

    expect(result.success).toBe(false);
  });
});

const validExportBundle = {
  version: 1,
  request_id: '11111111-1111-4111-8111-111111111111',
  generated_at: '2026-06-19T12:00:00.000Z',
  subject: { has_auth_user_id: true, has_member_id: false },
  auth_account: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'synthetic@example.invalid',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    last_sign_in_at: null,
  },
  profile: null,
  member_records: [],
  attendance: {
    auth_attendance: [{
      id: '33333333-3333-4333-8333-333333333333',
      event_id: '44444444-4444-4444-8444-444444444444',
      event_name: 'Synthetic Event',
      event_date: '2026-06-01T00:00:00.000Z',
      event_location: null,
      event_type: 'other',
      points_earned: 1,
      check_in_type: 'manual',
      checked_in_at: '2026-06-01T01:00:00.000Z',
      created_at: '2026-06-01T01:00:00.000Z',
    }],
    member_attendance: [],
  },
  points: { auth_points: [], member_totals: [] },
  house_memberships: [],
  feedback: [],
  media_references: [],
  browser_and_analytics_notes: ['Synthetic browser note.'],
  external_systems: ['Synthetic external-system note.'],
  exclusions: ['Synthetic exclusion.'],
  warnings: [],
};

describe('DataRightsExportBundleSchema', () => {
  it('accepts a versioned allowlisted export bundle', () => {
    expect(DataRightsExportBundleSchema.safeParse(validExportBundle).success).toBe(true);
  });

  it('rejects forbidden attendance fields', () => {
    const result = DataRightsExportBundleSchema.safeParse({
      ...validExportBundle,
      attendance: {
        ...validExportBundle.attendance,
        auth_attendance: [{
          ...validExportBundle.attendance.auth_attendance[0],
          check_in_code: 'must-not-export',
          checked_in_by: '55555555-5555-4555-8555-555555555555',
        }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects raw import and request-note payloads', () => {
    const result = DataRightsExportBundleSchema.safeParse({
      ...validExportBundle,
      raw_import_rows: [{ value: 'must-not-export' }],
      internal_notes: 'must-not-export',
    });

    expect(result.success).toBe(false);
  });
});
