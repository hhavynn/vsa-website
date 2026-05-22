-- Update the type check constraint to include 'event'
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check CHECK (type IN ('bug', 'feature', 'improvement', 'event', 'other'));

-- Add name and email columns to feedback table
ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update RLS policies to allow anonymous inserts
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;

CREATE POLICY "Anyone can insert feedback" 
ON public.feedback 
FOR INSERT 
WITH CHECK (true);

-- Ensure user_id can be null for anonymous feedback
ALTER TABLE public.feedback 
ALTER COLUMN user_id DROP NOT NULL;

-- Allow admins to view all feedback (ensure policy exists and is correct)
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback" ON public.feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Allow admins to update feedback status
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback" ON public.feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );
