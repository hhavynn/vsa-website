-- Drop existing enum if it exists
DROP TYPE IF EXISTS event_type CASCADE;

-- Create enum for event types
CREATE TYPE event_type AS ENUM (
  'general_event',
  'wildn_culture',
  'vcn_dance_practice',
  'vcn_attendance'
);

-- Add event_type column to events table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'event_type'
  ) THEN
    ALTER TABLE events ADD COLUMN event_type event_type NOT NULL DEFAULT 'general_event';
  END IF;
END $$;

-- Create check-in codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS check_in_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code)
);

-- Enable RLS
ALTER TABLE check_in_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Check-in codes are viewable by admins" ON check_in_codes;
DROP POLICY IF EXISTS "Check-in codes are insertable by admins" ON check_in_codes;
DROP POLICY IF EXISTS "Check-in codes are updatable by admins" ON check_in_codes;

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

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_event_points(event_type);
DROP FUNCTION IF EXISTS update_event_points();

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

-- Create trigger function to update points when event_type changes
CREATE OR REPLACE FUNCTION update_event_points()
RETURNS TRIGGER AS $$
BEGIN
  NEW.points := get_event_points(NEW.event_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_event_points ON events;

-- Create trigger to automatically set points based on event_type
CREATE TRIGGER set_event_points
  BEFORE INSERT OR UPDATE OF event_type
  ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_event_points(); 