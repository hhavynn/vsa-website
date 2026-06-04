export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  end_date?: string | null;
  location: string;
  points: number;
  event_type: 'gbm' | 'mixer' | 'winter_retreat' | 'vcn' | 'wildn_culture' | 'external_event' | 'other';
  check_in_form_url: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
  check_in_code?: string;
  is_code_expired: boolean;
  is_published: boolean;
  academic_term_id?: string | null;
}

export interface EventRecap {
  id: string;
  event_id: string;
  owner_names: string | null;
  cabinet_roles: string | null;
  attendance_notes: string | null;
  what_worked: string | null;
  what_failed: string | null;
  next_time_improvements: string | null;
  budget_notes: string | null;
  aftersocial_notes: string | null;
  risks_issues: string | null;
  drive_folder_url: string | null;
  planning_doc_url: string | null;
  gallery_event_id: string | null;
  public_highlight: string | null;
  is_public_highlight_published: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: string;
  code: string;
  label: string;
  academic_year_start: number;
  academic_year_end: number;
  quarter: 'fall' | 'winter' | 'spring' | 'summer';
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CabinetYear {
  id: string;
  label: string;
  slug: string;
  start_year: number;
  end_year: number;
  theme_name: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface VCNArchive {
  id: string;
  year: number;
  title: string | null;
  annual_number: string | null;
  theme_name: string | null;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  description: string | null;
  video_url: string | null;
  photo_album_url: string | null;
  album_source: string | null;
  cover_image_url: string | null;
  cover_thumbnail_url: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  photo_credit: string | null;
  is_published: boolean;
  is_featured: boolean;
  is_current: boolean;
  ticket_status: ProgramContentStatus;
  ticket_url: string | null;
  ticket_note: string | null;
  display_order: number;
  source_doc_url: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProgramPageKey = 'ace' | 'intern' | 'house' | 'wnc';
export type ProgramSectionKey = 'current_cycle' | 'application_cta' | 'event_cta' | 'notice';
export type ProgramContentStatus = 'hidden' | 'coming_soon' | 'open' | 'closed' | 'active';

export interface ProgramContent {
  id: string;
  page_key: ProgramPageKey;
  section_key: ProgramSectionKey;
  title: string | null;
  body: string | null;
  status: ProgramContentStatus;
  primary_link_label: string | null;
  primary_link_url: string | null;
  secondary_link_label: string | null;
  secondary_link_url: string | null;
  open_at: string | null;
  close_at: string | null;
  deadline_at: string | null;
  event_date: string | null;
  venue: string | null;
  is_published: boolean;
  display_order: number;
  source_doc_url: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ApplicationKey =
  | 'ace_application'
  | 'house_fall'
  | 'house_winter'
  | 'house_spring'
  | 'intern_application'
  | 'cabinet_application'
  | 'vcn_stage_ninja_interest'
  | 'vcn_props_team_interest'
  | 'wnc_team_form';

export type ApplicationStatus = 'disabled' | 'not_open' | 'open' | 'closed';

// Admin-only row (raw target_url visible to admins).
export interface ApplicationLink {
  id: string;
  application_key: ApplicationKey;
  title: string;
  description: string | null;
  button_label: string;
  target_url: string;
  open_at: string;
  due_at: string;
  is_enabled: boolean;
  before_open_message: string | null;
  after_close_message: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// Public-safe row from the public_application_links view. target_url is null
// unless the window is currently active; status is computed in the database.
export interface PublicApplicationLink {
  id: string;
  application_key: ApplicationKey;
  title: string;
  description: string | null;
  button_label: string;
  target_url: string | null;
  status: ApplicationStatus;
  open_at: string;
  due_at: string;
  is_enabled: boolean;
  before_open_message: string | null;
  after_close_message: string | null;
  sort_order: number;
  updated_at: string;
}

export type ResourceLinkVisibility = 'admin_only';

export interface ResourceLink {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string;
  role: string | null;
  program: string | null;
  workflow: string | null;
  academic_year_start: number | null;
  academic_year_end: number | null;
  is_current: boolean;
  is_archived: boolean;
  visibility: ResourceLinkVisibility;
  owner_role: string | null;
  last_verified_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AceFamily {
  id: string;
  academic_year_start: number | null;
  academic_year_end: number | null;
  name: string;
  slug: string;
  cover_image_url: string | null;
  theme_color: string | null;
  description: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AceFamilyMember {
  id: string;
  family_id: string;
  name: string;
  role_label: string | null;
  photo_url: string | null;
  parent_member_id: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface HousePageAsset {
  id: string;
  academic_year_start: number;
  academic_year_end: number;
  house: string;
  house_key: string;
  display_name: string;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  image_alt: string | null;
  cover_image_url: string | null;
  accent_color: string | null;
  emoji: string | null;
  display_order: number;
  is_active: boolean;
  house_parent_image_url: string | null;
  house_parent_heading: string | null;
  house_parent_body: string | null;
  source_doc_url: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseEvent {
  id: string;
  house_profile_id: string;
  academic_year_start: number;
  academic_year_end: number;
  title: string;
  slug: string | null;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  gallery_url: string | null;
  recap_url: string | null;
  rsvp_url: string | null;
  google_calendar_enabled: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  house?: HousePageAsset;
  houses?: HousePageAsset[];
}

export interface HouseMembership {
  id: string;
  member_id: string;
  house_profile_id: string;
  academic_year_start: number;
  academic_year_end: number;
  effective_start_date: string;
  effective_end_date: string | null;
  source: string | null;
  source_import_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  points_earned: number;
  check_in_type: 'code' | 'manual';
  checked_in_by?: string;
  checked_in_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberYearlyPoints {
  member_id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  graduation_year: string | null;
  user_id: string | null;
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
  events_attended: number;
}

export interface HouseMemberRankEntry {
  house: string;
  house_profile_id: string;
  display_name: string;
  image_url: string | null;
  accent_color: string | null;
  member_id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  graduation_year: string | null;
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
  events_attended: number;
  unique_events: number;
  latest_activity_at: string | null;
}

export interface HouseYearlyPoints {
  house: string;
  house_profile_id: string;
  display_name: string;
  image_url: string | null;
  accent_color: string | null;
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
  events_attended: number;
  unique_events: number;
  unique_members: number;
  average_points_per_member: number | null;
  latest_activity_at: string | null;
}

export interface HouseAllTimePoints {
  house: string;
  house_profile_id: string;
  display_name: string;
  image_url: string | null;
  accent_color: string | null;
  academic_year_start: number;
  academic_year_end: number;
  unique_events: number;
  total_points: number;
  events_attended: number;
  unique_members: number;
  average_points_per_member: number | null;
  latest_activity_at: string | null;
}

export interface HouseRecentActivity {
  house: string;
  house_profile_id: string;
  display_name: string;
  image_url: string | null;
  accent_color: string | null;
  event_id: string;
  event_name: string;
  event_date: string;
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
  contributing_members: number;
  latest_activity_at: string | null;
}

export type UVSAConfidenceLevel = 'high' | 'medium' | 'low';
export type UVSASystemType = 'UC' | 'CSU' | 'Private';

export interface UVSASchool {
  id: string;
  school_name: string;
  short_name: string;
  slug: string;
  system_type: UVSASystemType;
  city: string | null;
  vsa_name: string | null;
  instagram_url: string | null;
  linktree_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  description: string | null;
  known_for: string[];
  recurring_events: string[];
  logo_url: string | null;
  image_url: string | null;
  confidence_level: UVSAConfidenceLevel;
  verification_notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ExternalEventStatus = 'draft' | 'upcoming' | 'past' | 'historical' | 'canceled';

export interface ExternalEvent {
  id: string;
  uvsa_school_id: string | null;
  title: string;
  event_type: string | null;
  date: string | null;
  academic_term_id: string | null;
  location: string | null;
  description: string | null;
  points: number;
  rsvp_url: string | null;
  ride_form_url: string | null;
  instagram_url: string | null;
  host_info_url: string | null;
  ride_info: string | null;
  status: ExternalEventStatus;
  photo_album_url: string | null;
  recap: string | null;
  source_notes: string | null;
  confidence_level: UVSAConfidenceLevel;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  // Join data
  uvsa_school?: UVSASchool;
}
