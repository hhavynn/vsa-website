-- ============================================================
-- Move check_in_code off public.events into an admin-only table
-- Follow-up to 20260619000000_emergency_security_hardening.sql,
-- section C: eliminates client (authenticated-role) readability
-- of check-in codes entirely, rather than relying on the
-- server-authoritative RPC as the only safeguard.
-- Forward-only. Do not edit; write a new migration to adjust.
-- ============================================================

-- ============================================================
-- A. CREATE event_check_in_secrets AND MIGRATE EXISTING CODES
-- ============================================================

CREATE TABLE public.event_check_in_secrets (
  event_id      uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  check_in_code text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.event_check_in_secrets (event_id, check_in_code)
SELECT id, check_in_code
FROM public.events
WHERE check_in_code IS NOT NULL;

ALTER TABLE public.event_check_in_secrets ENABLE ROW LEVEL SECURITY;

-- Admin-only on every side: only admins ever need to see or manage codes.
CREATE POLICY "Admins can select check-in secrets"
  ON public.event_check_in_secrets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can insert check-in secrets"
  ON public.event_check_in_secrets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update check-in secrets"
  ON public.event_check_in_secrets FOR UPDATE
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

CREATE POLICY "Admins can delete check-in secrets"
  ON public.event_check_in_secrets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Table grants are still gated by the policies above; anon gets nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_check_in_secrets TO authenticated;
REVOKE ALL ON public.event_check_in_secrets FROM anon;

-- ============================================================
-- B. REPLACE THE INSERT-TIME CODE GENERATOR
--    Old trigger wrote NEW.check_in_code before the events row
--    existed; the secret now lives in a child row, which requires
--    the parent row (and its FK target) to exist first, so this
--    must run AFTER INSERT instead of BEFORE INSERT.
-- ============================================================

DROP TRIGGER IF EXISTS generate_event_check_in_code ON public.events;
DROP FUNCTION IF EXISTS public.set_event_check_in_code();

CREATE OR REPLACE FUNCTION public.create_event_check_in_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ON CONFLICT DO NOTHING: a caller that supplies its own code via a
  -- follow-up write (the admin UI's create flow) overwrites this
  -- placeholder; this trigger only guarantees every event has *some*
  -- code if the caller never sets one explicitly.
  INSERT INTO public.event_check_in_secrets (event_id, check_in_code)
  VALUES (NEW.id, public.generate_check_in_code())
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_event_check_in_secret
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.create_event_check_in_secret();

-- ============================================================
-- C. UPDATE check_in_to_event TO READ FROM THE SECRETS TABLE
--    The client no longer knows which event a code belongs to
--    (it can't read event_check_in_secrets), so the RPC now takes
--    only the code and resolves the event itself.
-- ============================================================

DROP FUNCTION IF EXISTS public.check_in_to_event(uuid, text);

CREATE OR REPLACE FUNCTION public.check_in_to_event(
  p_code text
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

  -- Resolve the event from the privately-stored code. SECURITY DEFINER
  -- grants access to event_check_in_secrets despite its admin-only RLS.
  SELECT e.id, e.name, e.is_published, e.is_code_expired, e.points, e.date
  INTO v_event
  FROM public.event_check_in_secrets s
  JOIN public.events e ON e.id = s.event_id
  WHERE s.check_in_code = p_code;

  -- Generic message for every validation failure (no match, unpublished,
  -- expired, or outside the 24h check-in window) to prevent code-oracle
  -- attacks and event enumeration via distinct error text or timing.
  IF NOT FOUND
     OR NOT COALESCE(v_event.is_published, false)
     OR COALESCE(v_event.is_code_expired, false)
     OR v_event.date < (now() - interval '24 hours')
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
      (v_event.id, v_user_id, v_points, 'code');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in to this event');
  END;

  -- Update user_points atomically. ON CONFLICT handles the common case
  -- where the row already exists (created by the handle_new_user_points trigger).
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (v_user_id, v_points)
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.user_points.total_points + EXCLUDED.total_points,
        updated_at   = now();

  RETURN jsonb_build_object(
    'success', true,
    'points_earned', v_points,
    'event_name', v_event.name
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION public.check_in_to_event(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_in_to_event(text) FROM anon;

-- ============================================================
-- D. DROP check_in_code FROM events
--    The column-level REVOKE from 20260619000000 only blocked
--    anon; authenticated users could still read it. With the
--    secrets table and RPC above as the sole source of truth,
--    the column itself can be removed.
-- ============================================================

-- This legacy policy let any authenticated user INSERT their own
-- event_attendance row directly (bypassing check_in_to_event) as long
-- as events.check_in_code was non-null and not expired. It depends on
-- the column being dropped below and is superseded by the RPC, which
-- is now the only path that resolves a code to an event.
DROP POLICY IF EXISTS "Users can insert their own attendance with valid code" ON public.event_attendance;

ALTER TABLE public.events DROP COLUMN IF EXISTS check_in_code;
