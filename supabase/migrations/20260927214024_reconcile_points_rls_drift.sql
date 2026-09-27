-- Reconcile production RLS drift that reopened client-side points writes.
--
-- APPLIED to production 2026-09-27 (schema_migrations version 20260927214024);
-- the filename matches the recorded version.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- A live pg_policies inventory on 2026-09-27 found policies that exist in no
-- migration in this repository. They are named "<table> insert (self)" /
-- "<table> update (self)" / "<table> select (self)" and use the
-- `(select auth.uid())` form the Supabase performance advisor suggests, so they
-- were most likely created from the dashboard. The write policies among them
-- undo the server-authoritative points design from #145 / #157:
--
--   user_points     "user_points update (self)"   any signed-in user can set
--                                                 their own points to any value
--                   "user_points insert (self)"   ...or insert a row with any
--                                                 value
--   user_profiles   "user_profiles insert (self)" permissive, so it is OR'd with
--                                                 "Users can insert their own
--                                                 profile" and bypasses that
--                                                 policy's is_admin = false
--                                                 check. Not exploitable in
--                                                 practice (profiles are created
--                                                 by the on_auth_user_created
--                                                 trigger, so the insert hits
--                                                 the primary key), but it must
--                                                 not rely on that.
--                   "user_profiles update (self)" duplicate of "Users can update
--                                                 own safe profile fields";
--                                                 protected columns stay guarded
--                                                 by guard_profile_protected_fields
--   feedback        "feedback update (self)"      submitters could rewrite their
--                                                 own feedback's admin status
--   check_ins       "check_ins insert (self)"     unused table (0 rows, no app
--                                                 caller)
--
-- Separately, 20260620010000_harden_attendance_rls.sql was never applied to
-- production: the original "Users can insert their own attendance" policy is
-- still live (so users can write attendance rows with any points_earned,
-- bypassing check_in_to_event), and the admin write policy it created is
-- missing (so the admin manual check-in UI cannot insert for other members).
-- That migration is not re-run here because it also adds a total_points
-- column the app no longer reads (#421).
--
-- At inventory time event_attendance had 0 rows and no user_points value
-- looked tampered with.
--
-- ---------------------------------------------------------------------------
-- LEGITIMATE WRITE PATHS (unaffected)
-- ---------------------------------------------------------------------------
--
--   check_in_to_event(text)  SECURITY DEFINER; bypasses RLS
--   handle_new_user_points   SECURITY DEFINER trigger; creates the user_points row
--   handle_new_user          SECURITY DEFINER trigger; creates the profile row
--   admin manual check-in    event_attendance insert; restored below
--
-- No client path writes user_points directly, so no admin write policy is
-- added there.
--
-- SELECT policies, including the duplicate "(self)" ones, are left alone.

-- event_attendance -----------------------------------------------------------

drop policy if exists "Users can insert their own attendance" on public.event_attendance;

drop policy if exists "Admins can modify attendance" on public.event_attendance;
create policy "Admins can modify attendance" on public.event_attendance
  for all
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

-- user_points ----------------------------------------------------------------

drop policy if exists "user_points insert (self)" on public.user_points;
drop policy if exists "user_points update (self)" on public.user_points;

-- user_profiles --------------------------------------------------------------

drop policy if exists "user_profiles insert (self)" on public.user_profiles;
drop policy if exists "user_profiles update (self)" on public.user_profiles;

-- feedback -------------------------------------------------------------------

drop policy if exists "feedback update (self)" on public.feedback;

-- check_ins ------------------------------------------------------------------

drop policy if exists "check_ins insert (self)" on public.check_ins;
