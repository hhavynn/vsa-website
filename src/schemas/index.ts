import { z } from 'zod';

// Event schemas
export const EventSchema = z.object({
  id: z.string().uuid('Invalid event ID'),
  name: z.string().min(1, 'Event name is required').max(100, 'Event name must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  date: z.string().datetime('Invalid date format'),
  location: z.string().min(1, 'Location is required').max(100, 'Location must be less than 100 characters'),
  points: z.number().int().min(0, 'Points must be non-negative').max(1000, 'Points must be less than 1000'),
  event_type: z.enum(['gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other']),
  check_in_form_url: z.string().url('Invalid URL format'),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  thumbnail_url: z.string().url('Invalid thumbnail URL').nullable().optional().or(z.literal('')),
  is_code_expired: z.boolean().default(false),
  is_published: z.boolean().default(true),
  academic_term_id: z.string().uuid('Invalid academic term ID').nullable().optional(),
});

export const CreateEventSchema = EventSchema.omit({ id: true });
export const UpdateEventSchema = EventSchema.partial();

// User profile schemas
export const UserProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  avatar_url: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

// Authentication schemas
export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password confirmation must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Feedback schemas
export const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'event', 'other']),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  priority: z.enum(['low', 'medium', 'high']),
  name: z.string().max(100, 'Name must be less than 100 characters').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
});

// Event attendance schemas
export const CheckInCodeSchema = z.object({
  code: z.string().min(1, 'Check-in code is required').max(20, 'Check-in code must be less than 20 characters'),
});


// Admin schemas
export const AdminEventUpdateSchema = z.object({
  id: z.string().uuid('Invalid event ID'),
  name: z.string().min(1, 'Event name is required').max(100, 'Event name must be less than 100 characters').optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters').optional(),
  date: z.string().datetime('Invalid date format').optional(),
  location: z.string().min(1, 'Location is required').max(100, 'Location must be less than 100 characters').optional(),
  points: z.number().int().min(0, 'Points must be non-negative').max(1000, 'Points must be less than 1000').optional(),
  event_type: z.enum(['gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other']).optional(),
  check_in_form_url: z.string().url('Invalid URL format').optional(),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  thumbnail_url: z.string().url('Invalid thumbnail URL').nullable().optional().or(z.literal('')),
  is_code_expired: z.boolean().optional(),
  is_published: z.boolean().optional(),
  academic_term_id: z.string().uuid('Invalid academic term ID').nullable().optional(),
});

const optionalUuid = z.union([z.string().uuid('Use a valid UUID'), z.literal('')]);

export const DataRightsRequestFormSchema = z.object({
  request_type: z.enum([
    'review',
    'correction',
    'export',
    'deletion',
    'anonymization',
    'media_removal',
    'analytics_browser_help',
    'external_form',
    'other',
  ]),
  status: z.enum([
    'intake',
    'identity_verification',
    'preview_needed',
    'pending_review',
    'approved_for_future_action',
    'completed',
    'rejected',
    'cancelled',
  ]),
  subject_auth_user_id: optionalUuid,
  subject_member_id: optionalUuid,
  subject_display_name: z.string().max(200, 'Display name must be 200 characters or fewer'),
  contact_channel: z.string().max(80, 'Contact channel must be 80 characters or fewer'),
  contact_reference: z.string().max(200, 'Contact reference must be 200 characters or fewer'),
  verification_status: z.enum(['not_started', 'pending', 'verified', 'failed', 'not_required']),
  verification_method: z.string().max(200, 'Verification method must be 200 characters or fewer'),
  assigned_to: optionalUuid,
  reviewer_id: optionalUuid,
  priority: z.enum(['low', 'normal', 'high']),
  summary: z.string().max(1000, 'Summary must be 1,000 characters or fewer'),
  internal_notes: z.string().max(2000, 'Internal notes must be 2,000 characters or fewer'),
  decision: z.string().max(1000, 'Decision must be 1,000 characters or fewer'),
}).strict().refine(
  (data) => !data.assigned_to || !data.reviewer_id || data.assigned_to !== data.reviewer_id,
  { message: 'Reviewer must be different from the assigned processor', path: ['reviewer_id'] },
);

export const MemberPhotoRequestFormSchema = z.object({
  submitted_name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or fewer'),
  submitted_email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(200, 'Email must be 200 characters or fewer'),
  note_to_admins: z.string().max(1000, 'Note must be 1,000 characters or fewer'),
  consent_confirmed: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm consent to submit a photo' }),
  }),
}).strict();

export const DataRightsDependencyPreviewSchema = z.object({
  version: z.literal(1),
  request_id: z.string().uuid(),
  read_only: z.literal(true),
  subject_signals: z.object({
    has_auth_user_id: z.boolean(),
    auth_user_exists: z.boolean(),
    has_member_id: z.boolean(),
    member_exists: z.boolean(),
    has_display_name: z.boolean(),
    subject_is_admin: z.boolean(),
    identity_confidence: z.enum(['confirmed_link', 'explicit_identifier', 'needs_review']),
  }).strict(),
  counts: z.object({
    profile_rows: z.number().int().nonnegative(),
    linked_member_rows: z.number().int().nonnegative(),
    candidate_member_rows: z.number().int().nonnegative(),
    confirmed_member_rows: z.number().int().nonnegative(),
    auth_attendance_rows: z.number().int().nonnegative(),
    member_attendance_rows: z.number().int().nonnegative(),
    user_points_rows: z.number().int().nonnegative(),
    house_membership_rows: z.number().int().nonnegative(),
    feedback_rows: z.number().int().nonnegative(),
    legacy_chat_log_rows: z.number().int().nonnegative(),
    import_raw_rows: z.number().int().nonnegative(),
  }).strict(),
  references: z.object({
    avatar_reference_present: z.boolean(),
    ai_usage_attributable: z.literal(false),
    media_attribution: z.literal('needs_schema_verification'),
    external_provider_review_required: z.boolean(),
  }).strict(),
  warnings: z.array(z.string().min(1)),
  next_steps: z.array(z.string().min(1)),
}).strict();

const DataRightsExportEventSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  event_name: z.string(),
  event_date: z.string(),
  event_location: z.string().nullable(),
  event_type: z.string(),
  points_earned: z.number().int(),
}).strict();

export const DataRightsExportBundleSchema = z.object({
  version: z.literal(1),
  request_id: z.string().uuid(),
  generated_at: z.string(),
  subject: z.object({
    has_auth_user_id: z.boolean(),
    has_member_id: z.boolean(),
  }).strict(),
  auth_account: z.object({
    id: z.string().uuid(),
    email: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string().nullable(),
    last_sign_in_at: z.string().nullable(),
  }).strict().nullable(),
  profile: z.object({
    id: z.string().uuid(),
    email: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    college: z.string().nullable(),
    year: z.string().nullable(),
    is_admin: z.boolean(),
    discord_user_id: z.string().nullable(),
    discord_username: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }).strict().nullable(),
  member_records: z.array(z.object({
    id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
    college: z.string().nullable(),
    year: z.string().nullable(),
    house: z.string().nullable(),
    points: z.number().int(),
    events_attended: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
  }).strict()),
  attendance: z.object({
    auth_attendance: z.array(DataRightsExportEventSchema.extend({
      check_in_type: z.enum(['code', 'manual']),
      checked_in_at: z.string(),
      created_at: z.string(),
    }).strict()),
    member_attendance: z.array(DataRightsExportEventSchema.extend({
      member_id: z.string().uuid(),
      imported_at: z.string(),
    }).strict()),
  }).strict(),
  points: z.object({
    auth_points: z.array(z.object({
      id: z.string().uuid(),
      total_points: z.number().int(),
      points: z.number().int().nullable(),
      created_at: z.string(),
      updated_at: z.string(),
    }).strict()),
    member_totals: z.array(z.object({
      member_id: z.string().uuid(),
      total_points: z.number().int(),
      events_attended: z.number().int(),
    }).strict()),
  }).strict(),
  house_memberships: z.array(z.object({
    id: z.string().uuid(),
    member_id: z.string().uuid(),
    house_key: z.string(),
    house_name: z.string(),
    academic_year_start: z.number().int(),
    academic_year_end: z.number().int(),
    effective_start_date: z.string(),
    effective_end_date: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }).strict()),
  feedback: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['bug', 'feature', 'improvement', 'event', 'other']),
    title: z.string(),
    description: z.string(),
    status: z.enum(['open', 'pending', 'in_progress', 'resolved', 'closed']),
    created_at: z.string(),
    updated_at: z.string(),
  }).strict()),
  media_references: z.array(z.object({
    kind: z.enum(['avatar', 'discord_avatar']),
    url: z.string(),
  }).strict()),
  browser_and_analytics_notes: z.array(z.string().min(1)),
  external_systems: z.array(z.string().min(1)),
  exclusions: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
}).strict();

// Type exports for TypeScript
export type Event = z.infer<typeof EventSchema>;
export type EventFormData = z.infer<typeof EventSchema>;
export type CreateEventFormData = z.infer<typeof CreateEventSchema>;
export type UpdateEventFormData = z.infer<typeof UpdateEventSchema>;
export type UserProfileFormData = z.infer<typeof UserProfileSchema>;
export type SignInFormData = z.infer<typeof SignInSchema>;
export type SignUpFormData = z.infer<typeof SignUpSchema>;
export type FeedbackFormData = z.infer<typeof FeedbackSchema>;
export type CheckInCodeFormData = z.infer<typeof CheckInCodeSchema>;
export type AdminEventUpdateFormData = z.infer<typeof AdminEventUpdateSchema>;
export type DataRightsRequestFormData = z.infer<typeof DataRightsRequestFormSchema>;
export type MemberPhotoRequestFormData = z.infer<typeof MemberPhotoRequestFormSchema>;
export type DataRightsDependencyPreview = z.infer<typeof DataRightsDependencyPreviewSchema>;
export type DataRightsExportBundle = z.infer<typeof DataRightsExportBundleSchema>;
