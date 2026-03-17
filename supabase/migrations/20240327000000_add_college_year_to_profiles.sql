-- Add college and year fields to user_profiles for attendance import matching
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS year text;
