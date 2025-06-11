export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  points: number;
  created_at: string;
  updated_at: string;
  check_in_form_url: string; // URL to the Google Form for check-in
  event_type: 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
} 