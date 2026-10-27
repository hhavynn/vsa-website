-- Synthetic standalone prerequisites; never run against a linked project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001');
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE FUNCTION public.is_admin_user() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.sub', true) = '00000000-0000-4000-8000-000000000001' $$;
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users,
  type text NOT NULL, title text NOT NULL, description text NOT NULL,
  name text, email text, status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO anon, authenticated;
GRANT INSERT (title) ON public.feedback TO anon;
CREATE POLICY "Anyone can insert feedback" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback insert (self)" ON public.feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
\ir ../../supabase/migrations/20261027170000_feedback_submission_boundary.sql
\ir ../../supabase/migrations/20261027170001_feedback_direct_insert_cutover.sql

DO $$ BEGIN
  IF has_table_privilege('anon', 'public.feedback', 'INSERT')
    OR has_any_column_privilege('anon', 'public.feedback', 'INSERT')
    OR has_table_privilege('authenticated', 'public.feedback', 'INSERT')
    OR has_function_privilege('anon', 'public.submit_feedback_guarded(text,text,text,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.submit_feedback_guarded(text,text,text,text,text,uuid)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'private.feedback_submission_budgets', 'SELECT') THEN
    RAISE EXCEPTION 'Browser grants remain';
  END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.feedback(type,title,description) VALUES ('bug','spoof','spoof');
    RAISE EXCEPTION 'anonymous direct INSERT succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM public.feedback) <> 0 THEN RAISE EXCEPTION 'anon read feedback'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  BEGIN
    SELECT public.submit_feedback_guarded('bug','spoof','spoof',NULL,NULL,'00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'ordinary user called service-only RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- The internal service-role guard holds even for a role with owner EXECUTE.
SET request.jwt.claim.role = 'authenticated';
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_feedback_guarded('bug','spoof','spoof');
    RAISE EXCEPTION 'internal guard missing';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.role = 'service_role';
SET ROLE service_role;
SELECT public.submit_feedback_guarded('bug',' Anonymous ',' Details ');
SELECT public.submit_feedback_guarded('feature','Verified user','Details',NULL,NULL,'00000000-0000-4000-8000-000000000001');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.feedback WHERE user_id IS NULL AND title = 'Anonymous') <> 1
    OR (SELECT count(*) FROM public.feedback WHERE user_id = '00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Identity or normalization failed';
  END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN IF (SELECT count(*) FROM public.feedback) <> 0 THEN RAISE EXCEPTION 'anon read private feedback'; END IF; END $$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $$ BEGIN IF (SELECT count(*) FROM public.feedback) <> 0 THEN RAISE EXCEPTION 'ordinary user read private feedback'; END IF; END $$;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
UPDATE public.feedback SET status = 'resolved';
DO $$ BEGIN IF (SELECT count(*) FROM public.feedback WHERE status = 'resolved') <> 2 THEN RAISE EXCEPTION 'admin review broken'; END IF; END $$;
RESET ROLE;
UPDATE private.feedback_submission_limits SET anonymous_hourly = 1, user_hourly = 1;
DO $$
DECLARE before_rows bigint; before_budget bigint;
BEGIN
  SELECT count(*) INTO before_rows FROM public.feedback;
  SELECT sum(submissions) INTO before_budget FROM private.feedback_submission_budgets;
  BEGIN
    PERFORM public.submit_feedback_guarded('bug','Another','Details','Different name','different@example.invalid');
    RAISE EXCEPTION 'anonymous caller limit bypassed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'feedback_rate_limit' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.submit_feedback_guarded('bug','Another','Details',NULL,NULL,'00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'authenticated caller limit bypassed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'feedback_rate_limit' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.submit_feedback_guarded('bug',repeat('x',101),'Details');
    RAISE EXCEPTION 'invalid input accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT count(*) FROM public.feedback) <> before_rows
    OR (SELECT sum(submissions) FROM private.feedback_submission_budgets) <> before_budget THEN
    RAISE EXCEPTION 'rejection changed rows or counters';
  END IF;
END $$;
TRUNCATE public.feedback, private.feedback_submission_budgets;
UPDATE private.feedback_submission_limits SET anonymous_hourly = 100, global_daily = 100;
-- Failed INSERT rolls both budgets back, even after successful admission.
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_feedback_guarded('bug','Bad FK','Details',NULL,NULL,'00000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'invalid FK accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF EXISTS (SELECT FROM private.feedback_submission_budgets) THEN RAISE EXCEPTION 'failed insert consumed quota'; END IF;
END $$;
UPDATE private.feedback_submission_limits SET global_daily = 1;
\echo PASS: identity, validation, quotas, rollback, browser denial and administrator review
