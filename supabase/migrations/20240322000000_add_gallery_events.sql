-- Create gallery_events table
CREATE TABLE IF NOT EXISTS gallery_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    images TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE gallery_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read gallery events
CREATE POLICY "Allow public read access to gallery_events"
    ON gallery_events FOR SELECT
    USING (true);

-- Only allow authenticated users to insert gallery events
CREATE POLICY "Allow authenticated users to insert gallery_events"
    ON gallery_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only allow authenticated users to update gallery events
CREATE POLICY "Allow authenticated users to update gallery_events"
    ON gallery_events FOR UPDATE
    TO authenticated
    USING (true);

-- Only allow authenticated users to delete gallery events
CREATE POLICY "Allow authenticated users to delete gallery_events"
    ON gallery_events FOR DELETE
    TO authenticated
    USING (true); 