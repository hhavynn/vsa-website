-- Add check_in_code and is_code_expired to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS check_in_code TEXT,
ADD COLUMN IF NOT EXISTS is_code_expired BOOLEAN DEFAULT false;

-- Create event_attendance table to track user attendance
CREATE TABLE IF NOT EXISTS event_attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL,
    check_in_type TEXT NOT NULL CHECK (check_in_type IN ('code', 'manual')),
    checked_in_by UUID REFERENCES auth.users(id),
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id) -- Prevent duplicate check-ins
);

-- Enable RLS
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for event_attendance
CREATE POLICY "Users can view their own attendance"
    ON event_attendance FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance"
    ON event_attendance FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can insert attendance"
    ON event_attendance FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can update attendance"
    ON event_attendance FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can delete attendance"
    ON event_attendance FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

-- Function to generate a random check-in code
CREATE OR REPLACE FUNCTION generate_check_in_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate check-in code when event is created
CREATE OR REPLACE FUNCTION set_event_check_in_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in_code IS NULL THEN
        NEW.check_in_code := generate_check_in_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_event_check_in_code
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION set_event_check_in_code(); 