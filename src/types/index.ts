export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  points: number;
  event_type: 'gbm' | 'mixer' | 'winter_retreat' | 'vcn' | 'wildn_culture' | 'external_event' | 'other';
  check_in_form_url: string;
  image_url?: string;
  check_in_code?: string;
  is_code_expired: boolean;
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
  image_url: string | null;
  image_alt: string | null;
  display_order: number;
  source_doc_url: string | null;
  internal_notes: string | null;
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
  member_id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  graduation_year: string | null;
  total_points: number;
  events_attended: number;
}

export interface HouseYearlyPoints {
  house: string;
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
  total_points: number;
  events_attended: number;
  unique_members: number;
  average_points_per_member: number | null;
  latest_activity_at: string | null;
}

export interface HouseRecentActivity {
  house: string;
  event_id: string;
  event_name: string;
  event_date: string;
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
  contributing_members: number;
  latest_activity_at: string | null;
}
