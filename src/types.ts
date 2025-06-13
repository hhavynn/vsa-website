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