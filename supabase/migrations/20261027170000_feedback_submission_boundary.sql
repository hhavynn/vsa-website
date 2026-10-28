-- Additive phase of #572. Apply and deploy submit-feedback before the browser
-- switches; the separate cutover migration revokes legacy direct INSERT last.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.feedback_submission_limits (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  anonymous_hourly integer NOT NULL DEFAULT 20 CHECK (anonymous_hourly BETWEEN 1 AND 1000),
  user_hourly integer NOT NULL DEFAULT 5 CHECK (user_hourly BETWEEN 1 AND 100),
  global_daily integer NOT NULL DEFAULT 200 CHECK (global_daily BETWEEN 1 AND 10000)
);
INSERT INTO private.feedback_submission_limits (singleton) VALUES (true);
CREATE TABLE private.feedback_submission_budgets (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  submissions integer NOT NULL CHECK (submissions >= 0)
);
ALTER TABLE private.feedback_submission_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.feedback_submission_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.feedback_submission_limits, private.feedback_submission_budgets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.submit_feedback_guarded(
  p_type text, p_title text, p_description text,
  p_name text DEFAULT NULL, p_email text DEFAULT NULL, p_user_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  limits private.feedback_submission_limits%ROWTYPE;
  caller_bucket text;
  caller_limit integer;
  hour_start timestamptz := date_trunc('hour', now());
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('bug', 'feature', 'improvement', 'event', 'other')
    OR p_title IS NULL OR length(btrim(p_title)) < 1 OR length(p_title) > 100
    OR p_description IS NULL OR length(btrim(p_description)) < 1 OR length(p_description) > 1000
    OR length(p_name) > 100 OR length(p_email) > 254
    OR (NULLIF(btrim(p_email), '') IS NOT NULL AND btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
  END IF;

  -- One lock covers both budgets and the insert, including concurrent isolates.
  PERFORM pg_catalog.pg_advisory_xact_lock(872572001::bigint);
  SELECT * INTO STRICT limits FROM private.feedback_submission_limits WHERE singleton;
  caller_bucket := CASE WHEN p_user_id IS NULL THEN 'anonymous' ELSE 'user:' || p_user_id::text END;
  caller_limit := CASE WHEN p_user_id IS NULL THEN limits.anonymous_hourly ELSE limits.user_hourly END;
  IF EXISTS (SELECT 1 FROM private.feedback_submission_budgets
    WHERE bucket = 'global' AND window_start = day_start AND submissions >= limits.global_daily)
    OR EXISTS (SELECT 1 FROM private.feedback_submission_budgets
    WHERE bucket = caller_bucket AND window_start = hour_start AND submissions >= caller_limit) THEN
    RAISE EXCEPTION 'feedback_rate_limit' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO private.feedback_submission_budgets AS budget (bucket, window_start, submissions)
    VALUES ('global', day_start, 1), (caller_bucket, hour_start, 1)
    ON CONFLICT (bucket) DO UPDATE SET window_start = EXCLUDED.window_start,
      submissions = CASE WHEN budget.window_start = EXCLUDED.window_start THEN budget.submissions + 1 ELSE 1 END;
  INSERT INTO public.feedback (type, title, description, name, email, user_id)
    VALUES (p_type, btrim(p_title), btrim(p_description), NULLIF(btrim(p_name), ''), NULLIF(btrim(p_email), ''), p_user_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_feedback_guarded(text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback_guarded(text, text, text, text, text, uuid) TO service_role;
COMMIT;
