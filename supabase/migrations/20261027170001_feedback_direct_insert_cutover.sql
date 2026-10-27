-- #572 cutover: apply ONLY after submit-feedback and the compatible browser
-- are deployed and normal anonymous submission has been verified.
BEGIN;
REVOKE INSERT ON public.feedback FROM PUBLIC, anon, authenticated;
DO $$
DECLARE column_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO column_list
    FROM pg_catalog.pg_attribute WHERE attrelid = 'public.feedback'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s) ON public.feedback FROM PUBLIC, anon, authenticated', column_list);
END;
$$;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "feedback insert (self)" ON public.feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "feedback select (self)" ON public.feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.feedback;
-- Existing administrator SELECT/UPDATE policies and grants remain in force.
COMMIT;
