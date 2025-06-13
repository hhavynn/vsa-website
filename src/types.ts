export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  points: number;
  created_at: string;
  updated_at: string;
  check_in_form_url: string; // URL to the Google Form for check-in
  event_type: 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';
  image_url?: string;
  check_in_code?: string;
  is_code_expired: boolean;
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
  created_at: string;
  updated_at: string;
  is_admin: boolean;
} 