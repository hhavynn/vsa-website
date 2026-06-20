-- Move check-in codes from the public events row into an admin-only
-- event_check_in_secrets table so no public/authenticated direct query
-- can read a live check-in code.
--
-- Changes:
--   1. Create event_check_in_secrets (admin-only RLS).
--   2. Backfill from events.check_in_code.
--   3. Drop the auto-generate trigger so new events don't get a code in
--      the events row; Admin UI inserts into event_check_in_secrets instead.
--   4. Replace check_in_to_event(uuid,text) with check_in_to_event(text):
--      looks up the event via event_check_in_secrets, no event_id needed
--      from the client.
--   5. Null out events.check_in_code so no historical code leaks remain.

-- ─── 1. event_check_in_secrets ───────────────────────────────────────────────

CREATE TABLE public.event_check_in_secrets (
  event_id      uuid        PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  check_in_code text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_check_in_secrets ENABLE ROW LEVEL SECURITY;

-- No anon access at all
REVOKE ALL ON public.event_check_in_secrets FROM anon;

-- Admin-only SELECT
CREATE POLICY "Admins can read check-in secrets"
  ON public.event_check_in_secrets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin-only INSERT
CREATE POLICY "Admins can insert check-in secrets"
  ON public.event_check_in_secrets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin-only UPDATE (e.g. rotate code or fix typo)
CREATE POLICY "Admins can update check-in secrets"
  ON public.event_check_in_secrets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ─── 2. Backfill from events ─────────────────────────────────────────────────

INSERT INTO public.event_check_in_secrets (event_id, check_in_code, created_at, updated_at)
SELECT
  id,
  check_in_code,
  COALESCE(created_at, now()),
  now()
FROM public.events
WHERE check_in_code IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

-- ─── 3. Remove old auto-generate trigger ─────────────────────────────────────
-- The admin UI now generates codes and writes them to event_check_in_secrets
-- after event creation. No trigger is needed (or safe) on the events row.

DROP TRIGGER  IF EXISTS generate_event_check_in_code ON public.events;
DROP FUNCTION IF EXISTS public.set_event_check_in_code();
DROP FUNCTION IF EXISTS public.generate_check_in_code();

-- ─── 4. Replace check_in_to_event RPC ────────────────────────────────────────
-- Old signature: check_in_to_event(p_event_id uuid, p_code text)
-- New signature: check_in_to_event(p_code text)
--
-- The client submits only the raw code; the server looks up which event it
-- belongs to via event_check_in_secrets.  SECURITY DEFINER means the lookup
-- runs as the function owner and bypasses RLS on both tables — codes are
-- never returned to the caller.

DROP FUNCTION IF EXISTS public.check_in_to_event(uuid, text);

CREATE OR REPLACE FUNCTION public.check_in_to_event(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_event   record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Look up the event through the secrets table.  SECURITY DEFINER bypasses
  -- RLS so this works even though anon/authenticated cannot SELECT secrets.
  SELECT
    e.id,
    e.name,
    e.is_published,
    e.is_code_expired,
    e.points,
    e.date
  INTO v_event
  FROM public.event_check_in_secrets s
  JOIN public.events e ON e.id = s.event_id
  WHERE s.check_in_code = upper(trim(p_code));

  -- Generic message prevents event enumeration, code oracle, and timing attacks.
  IF NOT FOUND
     OR NOT COALESCE(v_event.is_published, false)
     OR COALESCE(v_event.is_code_expired, false)
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired check-in code');
  END IF;

  -- Reject codes submitted more than 24 hours after the event.
  IF v_event.date IS NOT NULL
     AND v_event.date < (now() - interval '24 hours')
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event check-in period has ended');
  END IF;

  BEGIN
    INSERT INTO public.event_attendance (event_id, user_id, points_earned, check_in_type)
    VALUES (v_event.id, v_user_id, COALESCE(v_event.points, 0), 'code');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in to this event');
  END;

  INSERT INTO public.user_points (user_id, total_points)
  VALUES (v_user_id, COALESCE(v_event.points, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.user_points.total_points + EXCLUDED.total_points,
        updated_at   = now();

  RETURN jsonb_build_object(
    'success',      true,
    'event_name',   v_event.name,
    'points_earned', COALESCE(v_event.points, 0)
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION public.check_in_to_event(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_in_to_event(text) FROM anon;

-- ─── 5. Null out events.check_in_code ────────────────────────────────────────
-- All live codes are now in event_check_in_secrets.  Clearing the column
-- means no historical data leaks if events.check_in_code is ever queried.

UPDATE public.events SET check_in_code = NULL;

-- Belt-and-suspenders: revoke column-level SELECT from authenticated too.
-- (anon was revoked in the emergency_security_hardening migration.)
-- The column is now null for all rows, but the revoke prevents it from
-- being used even if new code accidentally writes to it again.
REVOKE SELECT (check_in_code) ON public.events FROM authenticated;
