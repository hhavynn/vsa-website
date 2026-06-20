-- Migration to harden event_attendance and user_points RLS policies,
-- preventing ordinary users from directly inserting or modifying attendance/points,
-- and ensuring they only check in via the secure check_in_to_event RPC.

-- ============================================================
-- 1. HARDEN event_attendance WRITE POLICIES
-- ============================================================

-- Drop all legacy/incorrect insert, update, and delete policies for ordinary users on event_attendance.
-- Note: PR #154 already dropped "Users can insert their own attendance with valid code" in 20260620000000_move_check_in_code_to_secrets_table.sql.
DROP POLICY IF EXISTS "Users can insert their own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can delete their own attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Users can delete own attendance" ON public.event_attendance;

-- Secure select policies: Users can view their own records, and admins can view all.
-- (Already handled by 20260619000000_emergency_security_hardening.sql, but we ensure they remain active).
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.event_attendance;
CREATE POLICY "Users can view their own attendance" ON public.event_attendance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.event_attendance;
CREATE POLICY "Admins can view all attendance" ON public.event_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin policies: only admins can insert, update, and delete attendance records directly (for manual check-in UI).
DROP POLICY IF EXISTS "Admins can modify attendance" ON public.event_attendance;
CREATE POLICY "Admins can modify attendance" ON public.event_attendance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ============================================================
-- 2. HARDEN user_points WRITE POLICIES
-- ============================================================

-- Ensure total_points column exists on user_points
ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS total_points integer not null default 0;

-- Migrate legacy points if total_points is uninitialized
UPDATE public.user_points 
SET total_points = coalesce(points, 0)
WHERE total_points = 0 AND points IS NOT NULL AND points > 0;

-- Update trigger function to initialize both points and total_points
CREATE OR REPLACE FUNCTION public.handle_new_user_points()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points (user_id, points, total_points)
  VALUES (new.id, 0, 0)
  ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all direct write policies for ordinary users on user_points.
-- Note: UPDATE policies were already dropped in 20260619000000_emergency_security_hardening.sql.
DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can insert own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can delete their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can delete own points" ON public.user_points;

-- Recreate the insert policy so that initializeUserPoints() can continue to insert a 0-point record,
-- but users are absolutely blocked from choosing a non-zero point value.
CREATE POLICY "Users can insert their own points" ON public.user_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (total_points IS NULL OR total_points = 0) AND
    (points IS NULL OR points = 0)
  );

-- Secure select policies: Users can view their own points, and admins can view all.
DROP POLICY IF EXISTS "Users can view own points" ON public.user_points;
CREATE POLICY "Users can view own points" ON public.user_points
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all points" ON public.user_points;
CREATE POLICY "Admins can view all points" ON public.user_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin policies: only admins can manage points directly.
DROP POLICY IF EXISTS "Admins can modify points" ON public.user_points;
CREATE POLICY "Admins can modify points" ON public.user_points
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
