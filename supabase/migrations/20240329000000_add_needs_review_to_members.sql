-- Add 'needs_review' boolean column to members
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
