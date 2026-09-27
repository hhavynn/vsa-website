-- Restrict events / members / attendance writes to admins.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- A live pg_policies inventory on 2026-09-27 found early-era policies that let
-- ANY authenticated user write protected tables. None of them exist in a
-- migration in this repository:
--
--   events                   "Events are insertable/updatable/deletable by
--                             authenticated users"
--   members                  "Auth insert/update/delete members"
--   member_event_attendance  "Auth manage member_attendance" (FOR ALL)
--   check_in_codes           "Check-in codes are insertable by authenticated users"
--   check_in_code_usage      "Usage is insertable by authenticated users"
--
-- Each checks only auth.role() = 'authenticated'. Email signup is enabled on
-- the project, so anyone who can confirm an email address could create an
-- account and then, through the REST API, delete events or rewrite members
-- and member_event_attendance -- the data behind the public leaderboard.
-- Permissive policies are OR'd, so the admin-only policies that sit beside
-- them on members and member_event_attendance did not help.
--
-- At inventory time the only non-admin accounts dated from June 2025.
--
-- ---------------------------------------------------------------------------
-- WHAT STAYS WORKING
-- ---------------------------------------------------------------------------
--
--   members                  existing "Admins can insert/update/delete members"
--   member_event_attendance  existing "Admins can manage member attendance"
--   events                   had NO admin write policies (admin editing relied
--                            on the broad ones), so admin insert/update/delete
--                            policies are added below
--   check_in_codes           admin GenerateCheckInCode insert; admin-only
--                            insert policy added below
--   check_in_code_usage      no app writer (0 rows); insert dropped
--
-- Public reads (published events, members, member attendance) and the
-- SECURITY DEFINER RPCs (check_in_to_event, record_event_interest) are
-- untouched. Service-role Edge Functions bypass RLS and are unaffected.

-- events ---------------------------------------------------------------------

drop policy if exists "Events are insertable by authenticated users" on public.events;
drop policy if exists "Events are updatable by authenticated users" on public.events;
drop policy if exists "Events are deletable by authenticated users" on public.events;

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events" on public.events
  for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events" on public.events
  for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events" on public.events
  for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- members --------------------------------------------------------------------

drop policy if exists "Auth insert members" on public.members;
drop policy if exists "Auth update members" on public.members;
drop policy if exists "Auth delete members" on public.members;

-- member_event_attendance ----------------------------------------------------

drop policy if exists "Auth manage member_attendance" on public.member_event_attendance;

-- check_in_codes / check_in_code_usage ---------------------------------------

drop policy if exists "Check-in codes are insertable by authenticated users" on public.check_in_codes;

drop policy if exists "Admins can insert check-in codes" on public.check_in_codes;
create policy "Admins can insert check-in codes" on public.check_in_codes
  for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Usage is insertable by authenticated users" on public.check_in_code_usage;
