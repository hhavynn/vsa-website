-- Add UPDATE and DELETE policies for event_images bucket
-- This allows authenticated users to update and delete event images when editing events

-- Policy to allow authenticated users to update event images
CREATE POLICY "Allow authenticated users to update event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event_images');

-- Policy to allow authenticated users to delete event images
CREATE POLICY "Allow authenticated users to delete event images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event_images');
