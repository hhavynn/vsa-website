-- Set up storage policies for the gallery_images bucket
DO $$ 
BEGIN
    -- Only create policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow public read access to gallery_images'
    ) THEN
        CREATE POLICY "Allow public read access to gallery_images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'gallery_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated users to upload gallery images'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload gallery images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'gallery_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated users to update gallery images'
    ) THEN
        CREATE POLICY "Allow authenticated users to update gallery images"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'gallery_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated users to delete gallery images'
    ) THEN
        CREATE POLICY "Allow authenticated users to delete gallery images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'gallery_images');
    END IF;
END $$; 