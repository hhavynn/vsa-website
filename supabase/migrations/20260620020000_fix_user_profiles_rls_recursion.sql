-- Prevent user_profiles policies from recursively querying user_profiles.
-- The helper is caller-bound so it cannot be used to enumerate other users'
-- admin status, and SECURITY DEFINER lets policy evaluation bypass table RLS.
CREATE OR REPLACE FUNCTION public.is_admin_user(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles AS profile
      WHERE profile.id = p_user_id
        AND profile.is_admin = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Preserve client-side profile creation while preventing a missing-profile
-- account from assigning itself the admin role during INSERT.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND is_admin = false
  );
