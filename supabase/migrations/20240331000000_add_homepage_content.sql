CREATE TABLE IF NOT EXISTS public.homepage_content (
  id text PRIMARY KEY,
  presidents_names text NOT NULL,
  presidents_role text NOT NULL,
  presidents_message text NOT NULL,
  presidents_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'homepage_content'
      AND policyname = 'Anyone can view homepage content'
  ) THEN
    CREATE POLICY "Anyone can view homepage content"
      ON public.homepage_content FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'homepage_content'
      AND policyname = 'Authenticated users can insert homepage content'
  ) THEN
    CREATE POLICY "Authenticated users can insert homepage content"
      ON public.homepage_content FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'homepage_content'
      AND policyname = 'Authenticated users can update homepage content'
  ) THEN
    CREATE POLICY "Authenticated users can update homepage content"
      ON public.homepage_content FOR UPDATE
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

INSERT INTO public.homepage_content (
  id,
  presidents_names,
  presidents_role,
  presidents_message,
  presidents_photo_url
)
VALUES (
  'presidents_message',
  'Gracie Nguyen & Phuong Le',
  'Co-Presidents | VSA at UC San Diego',
  'Hello and welcome to the VSA family! 💕

We’re Gracie and Phuong, and we’re beyond excited to serve as your Co-Presidents this year! Over the summer, our passionate cabinet has been planning a year full of fun, meaningful, and memorable events that we’re so excited to share with you.

VSA at UC San Diego isn’t just a student org, it’s a home away from home. It’s a place where strangers become close friends, and where you’ll find support, community, and endless opportunities to grow. Whether you’re here to embrace Vietnamese culture, meet new people, or just find your place on campus, VSA has something special for you.

Some of our most cherished college memories and lifelong friendships started right here. And we can’t wait for you to experience the same kind of magic.

So come hang out with us! Join our events, connect with our amazing members, and become a part of something truly meaningful. We’re so excited to meet you and welcome you into the family.

Let’s make this year one to remember, together. 🧡

With love,
Gracie & Phuong
Co-Presidents | VSA at UC San Diego',
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('presidents_images', 'presidents_images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Public read access for presidents images'
  ) THEN
    CREATE POLICY "Public read access for presidents images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'presidents_images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Authenticated users can upload presidents images'
  ) THEN
    CREATE POLICY "Authenticated users can upload presidents images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'presidents_images'
        AND auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Authenticated users can update presidents images'
  ) THEN
    CREATE POLICY "Authenticated users can update presidents images"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'presidents_images'
        AND auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Authenticated users can delete presidents images'
  ) THEN
    CREATE POLICY "Authenticated users can delete presidents images"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'presidents_images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;
