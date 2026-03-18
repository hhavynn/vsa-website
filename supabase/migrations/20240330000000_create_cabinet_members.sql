-- Create the cabinet_members table
CREATE TABLE IF NOT EXISTS public.cabinet_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  category text NOT NULL, -- 'Executive Board', 'General Board', or 'Interns'
  display_order integer NOT NULL DEFAULT 0,
  image_url text,
  year text,
  college text,
  major text,
  minor text,
  pronouns text,
  favorite_snack text,
  fun_fact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cabinet_members ENABLE ROW LEVEL SECURITY;

-- Policies for cabinet_members
CREATE POLICY "Anyone can view cabinet members"
  ON public.cabinet_members FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert cabinet members"
  ON public.cabinet_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update cabinet members"
  ON public.cabinet_members FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete cabinet members"
  ON public.cabinet_members FOR DELETE USING (auth.role() = 'authenticated');

-- Create storage bucket for cabinet images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cabinet_images', 'cabinet_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for cabinet_images
CREATE POLICY "Public read access for cabinet images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cabinet_images');

CREATE POLICY "Authenticated users can upload cabinet images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cabinet_images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update cabinet images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cabinet_images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete cabinet images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cabinet_images' AND 
    auth.role() = 'authenticated'
  );
