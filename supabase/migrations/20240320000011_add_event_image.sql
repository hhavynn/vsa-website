-- Add image_url column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for event images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('event_images', 'event_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event_images');

-- Create policy to allow public to view event images
CREATE POLICY "Allow public to view event images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event_images'); 