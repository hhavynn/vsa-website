-- Drop existing objects if they exist
DROP TYPE IF EXISTS event_type CASCADE;
DROP TABLE IF EXISTS check_in_codes CASCADE;

-- Create enum for event types
CREATE TYPE event_type AS ENUM (
  'general_event',
  'wildn_culture',
  'vcn_dance_practice',
  'vcn_attendance'
);

-- Create check-in codes table
CREATE TABLE check_in_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  event_type event_type NOT NULL,
  points INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE check_in_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for check-in codes
CREATE POLICY "Check-in codes are viewable by admins"
  ON check_in_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Check-in codes are insertable by admins"
  ON check_in_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Check-in codes are updatable by admins"
  ON check_in_codes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Function to get points for event type
CREATE OR REPLACE FUNCTION get_event_points(event_type event_type)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE event_type
    WHEN 'general_event' THEN 10
    WHEN 'wildn_culture' THEN 30
    WHEN 'vcn_dance_practice' THEN 5
    WHEN 'vcn_attendance' THEN 10
  END;
END;
$$ LANGUAGE plpgsql; 