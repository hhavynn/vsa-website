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
  venue: string | null;
  description: string | null;
  video_url: string | null;
  photo_album_url: string | null;
  album_source: string | null;
  cover_image_url: string | null;
  photo_credit: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
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
