-- ============================================================
-- Emergency Security Hardening
-- Addresses: is_admin mutation, smart_merge auth, check_in_code
--            client exposure, user_points direct mutation,
--            and event_attendance over-exposure.
-- Forward-only. Do not edit; write a new migration to adjust.
-- ============================================================

-- ============================================================
-- A. PROTECT user_profiles FROM is_admin MUTATION AND
--    OVER-BROAD SELECT EXPOSURE
-- ============================================================

-- Drop the unsafe UPDATE policy that allows mutating any column,
-- including is_admin, via a plain client UPDATE.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.user_profiles;

-- Drop the over-broad SELECT that exposes all emails and is_admin
-- to every authenticated user (used for leaderboard, now replaced
-- by the members table which holds only display-safe fields).
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- Trigger to block mutation of protected fields on every UPDATE,
-- regardless of which policy grants row access.
-- SECURITY DEFINER + empty search_path prevents bypass via SET search_path.
CREATE OR REPLACE FUNCTION public.guard_user_profile_protected_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Raise if any protected column is being changed by the caller.
  -- Service-role mutations (migrations, backend jobs) bypass RLS entirely
  -- and therefore never reach this trigger through a policy-guarded path,
  -- but the trigger still fires.  Intentional: only use service_role for
  -- legitimate admin mutations of these fields.
  IF (
    NEW.is_admin    IS DISTINCT FROM OLD.is_admin    OR
    NEW.email       IS DISTINCT FROM OLD.email       OR
    NEW.id          IS DISTINCT FROM OLD.id          OR
    NEW.created_at  IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION
      'Permission denied: is_admin, email, id, and created_at cannot be modified via client update';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.user_profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_protected_fields();

-- Safe UPDATE: row-scoped to own row; trigger above blocks protected columns.
CREATE POLICY "Users can update own safe profile fields"
  ON public.user_profiles FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users see only their own profile to prevent email/is_admin leakage.
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles for the admin UI.
-- Inner query is anchored by auth.uid() = id, which is permitted by
-- the own-profile policy above, so no recursive RLS loop occurs.
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- ============================================================
-- B. LOCK DOWN smart_merge_members
--    Add explicit admin check + empty search_path
-- ============================================================

-- Revoke from PUBLIC (covers the anon role which inherits PUBLIC).
REVOKE EXECUTE ON FUNCTION public.smart_merge_members(uuid, uuid) FROM PUBLIC;

-- Redefine with admin guard and empty search_path to prevent
-- search_path-injection attacks against the SECURITY DEFINER escalation.
CREATE OR REPLACE FUNCTION public.smart_merge_members(
  p_source_id uuid,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source public.members%ROWTYPE;
  v_target public.members%ROWTYPE;
BEGIN
  -- Reject non-admin callers before any data access.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin access required for smart_merge_members';
  END IF;

  SELECT * INTO v_source FROM public.members WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source member not found: %', p_source_id;
  END IF;

  SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target member not found: %', p_target_id;
  END IF;

  -- Fill voids on target from source.
  UPDATE public.members
  SET
    college    = COALESCE(v_target.college, v_source.college),
    year       = COALESCE(v_target.year,    v_source.year),
    email      = COALESCE(v_target.email,   v_source.email),
    updated_at = now()
  WHERE id = p_target_id;

  -- Move attendance records; skip events already credited to target.
  INSERT INTO public.member_event_attendance
    (member_id, event_id, points_earned, imported_at)
  SELECT p_target_id, event_id, points_earned, imported_at
  FROM public.member_event_attendance
  WHERE member_id = p_source_id
  ON CONFLICT (member_id, event_id) DO NOTHING;

  -- Delete source; ON DELETE CASCADE cleans remaining attendance rows.
  DELETE FROM public.members WHERE id = p_source_id;
END;
$$;

-- Re-grant to authenticated; the function enforces admin internally.
GRANT EXECUTE ON FUNCTION public.smart_merge_members(uuid, uuid) TO authenticated;

-- ============================================================
-- C. PREVENT CLIENT READ OF check_in_code
--    Column-level privilege + secure server-side check-in RPC
-- ============================================================

-- Revoke column-level SELECT on check_in_code from the anon role.
-- Unauthenticated visitors have no legitimate reason to read check-in codes.
-- Authenticated users (including admins) retain access because the admin UI
-- needs to display and manage codes.  The primary security gain here is the
-- server-authoritative RPC below: even if an authenticated user reads the
-- code, the server determines points and prevents double check-in.
-- Follow-up: move check_in_code to a separate event_check_in_secrets table
-- with its own admin-only RLS to eliminate client readability entirely.
REVOKE SELECT (check_in_code) ON public.events FROM anon;

-- Secure check-in RPC.
-- Client submits only (event_id, code).  Server:
--   1. Identifies caller via auth.uid() — never trusts client-supplied user_id.
--   2. Reads check_in_code privately via SECURITY DEFINER.
--   3. Validates published status, expiry, and code match.
--   4. Inserts attendance with server-derived points (event.points).
--   5. Upserts user_points atomically.
-- Returns generic error strings for invalid/expired/duplicate codes.
CREATE OR REPLACE FUNCTION public.check_in_to_event(
  p_event_id uuid,
  p_code     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_event   record;
  v_points  integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Read protected event data; SECURITY DEFINER bypasses column-level revoke.
  SELECT id, is_published, is_code_expired, check_in_code, points
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  -- Use a generic message for all validation failures to prevent
  -- event enumeration, code oracle attacks, and timing leakage.
  IF NOT FOUND
     OR NOT COALESCE(v_event.is_published, false)
     OR COALESCE(v_event.is_code_expired, false)
     OR v_event.check_in_code IS NULL
     OR v_event.check_in_code <> p_code
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired check-in code');
  END IF;

  -- Points are derived from the event record, never from the client.
  v_points := COALESCE(v_event.points, 0);

  -- Insert attendance; unique constraint on (event_id, user_id) prevents
  -- duplicate check-ins and is handled atomically in the exception block.
  BEGIN
    INSERT INTO public.event_attendance
      (event_id, user_id, points_earned, check_in_type)
    VALUES
      (p_event_id, v_user_id, v_points, 'code');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in to this event');
  END;

  -- Update user_points atomically.  ON CONFLICT handles the common case
  -- where the row already exists (created by the handle_new_user_points trigger).
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (v_user_id, v_points)
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.user_points.total_points + EXCLUDED.total_points,
        updated_at   = now();

  RETURN jsonb_build_object('success', true, 'points_earned', v_points);
END;
$$;

-- Only authenticated users can check in; anon cannot.
GRANT  EXECUTE ON FUNCTION public.check_in_to_event(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_in_to_event(uuid, text) FROM anon;

-- ============================================================
-- D. LOCK DOWN user_points DIRECT MUTATION
-- ============================================================

-- Remove the policy that allowed authenticated users to directly UPDATE
-- their own points total.  All point mutations now go through
-- check_in_to_event (SECURITY DEFINER) or admin-guarded paths.
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update own points"       ON public.user_points;

-- The INSERT policy ("Users can insert their own points") is intentionally
-- kept so that pointsRepository.initializeUserPoints() continues to work
-- for accounts created before the handle_new_user_points trigger existed.
-- Follow-up: once all user rows exist, drop this INSERT policy too and
-- rely entirely on the SECURITY DEFINER trigger for initialization.

-- ============================================================
-- E. REDUCE event_attendance OVER-EXPOSURE
-- ============================================================

-- Drop the broad "viewable by everyone" policy that exposed all
-- user UUIDs and points_earned to unauthenticated callers.
DROP POLICY IF EXISTS "Event attendance is viewable by everyone" ON public.event_attendance;

-- Users can view only their own attendance records.
DROP POLICY IF EXISTS "Users can view own attendance"         ON public.event_attendance;
DROP POLICY IF EXISTS "Users can view their own attendance"   ON public.event_attendance;
CREATE POLICY "Users can view their own attendance"
  ON public.event_attendance FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all attendance for the admin/points management UI.
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.event_attendance;
CREATE POLICY "Admins can view all attendance"
  ON public.event_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
