-- Reconcile EXECUTE grants on public-schema functions (#381).
--
-- Do not edit; write a new migration to adjust.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
-- ---------------------------------------------------------------------------
--
-- The #226 anon-exposure audit found several RPCs anonymously executable that
-- earlier migrations had explicitly revoked. A pg_catalog inventory of the live
-- database on 2026-08-20 found 29 of 35 public functions anon-executable, and
-- one root cause behind nearly all of them:
--
--   PostgreSQL grants EXECUTE to PUBLIC on every newly created function, and
--   `anon` is a member of PUBLIC. `REVOKE EXECUTE ... FROM anon` therefore
--   removes a grant anon does not depend on and leaves the PUBLIC grant intact.
--   The revoke succeeds and changes nothing.
--
-- The live ACL for check_in_to_event showed this exactly:
--
--   =X/postgres | postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
--
-- The leading `=X/` is the PUBLIC grant. There is no `anon=X` entry at all --
-- 20260620000000 L185's REVOKE ... FROM anon did apply. It simply was not the
-- grant that governed access.
--
-- By contrast is_admin_user, whose migration wrote `revoke ... from public`,
-- carries no `=X/` and is correctly locked. Across the whole schema the split
-- is clean: the functions that are safe today are exactly those whose
-- migrations revoked from PUBLIC.
--
-- This migration completes the missing half of every such revoke, and removes
-- the direct anon grants that a few functions additionally carry.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- No function body is modified. Points calculation, attendance cascade, member
-- merge, and check-in logic are untouched. The only non-grant statements are
-- two ALTER FUNCTION ... SET search_path calls, which change the execution
-- environment and not the code; both bodies already schema-qualify every
-- reference, so behaviour is identical before and after.
--
-- Trigger functions: PostgreSQL checks EXECUTE on a trigger function when the
-- trigger is CREATED, not when it fires. Revoking EXECUTE from PUBLIC/anon
-- therefore cannot break an existing trigger. It is corrected here because the
-- grant is wrong by policy, not because it is currently reachable -- a direct
-- call to a trigger function fails on the missing trigger context regardless.

begin;

-- ===========================================================================
-- A. Callable RPCs -- revoke PUBLIC and anon, preserve real callers
-- ===========================================================================
--
-- Caller for each was verified in the repo before revoking. Where a function
-- has no caller at all it is left granted to `authenticated` rather than
-- dropped: removing a function is a separate decision that belongs with the
-- schema-drift half of #381, and this migration is scoped to access control.

-- Server-authoritative check-in. Requires a signed-in member by design; the
-- anon path was never intended. Caller: src/hooks/useEventAttendance.ts:23.
revoke execute on function public.check_in_to_event(text) from public, anon;
grant  execute on function public.check_in_to_event(text) to authenticated;

-- Check-in secret generation. No caller in src/. Anon must never reach this.
revoke execute on function public.generate_check_in_code() from public, anon;
grant  execute on function public.generate_check_in_code() to authenticated;

-- Event-type points lookup. Caller is admin-only:
-- src/components/features/admin/GenerateCheckInCode.tsx:32.
revoke execute on function public.get_event_points(event_type) from public, anon;
grant  execute on function public.get_event_points(event_type) to authenticated;

-- Arbitrary-UID points lookup. No caller in src/. Anon-executable arbitrary
-- lookups over user IDs are exactly the shape the public-exposure rules forbid.
revoke execute on function public.get_user_points(uuid) from public, anon;
grant  execute on function public.get_user_points(uuid) to authenticated;

-- Ask VSA knowledge search. Its only caller is the vsa-ai-assistant Edge
-- Function (supabase/functions/vsa-ai-assistant/index.ts:366), which builds its
-- client with SUPABASE_SERVICE_ROLE_KEY (L474) and so bypasses these grants
-- entirely. The browser never calls it, so anon does not need it.
revoke execute on function public.match_ai_knowledge_base(text, integer) from public, anon;
grant  execute on function public.match_ai_knowledge_base(text, integer) to authenticated;

-- Points recalculation. No caller in src/. Protected-domain mutation.
revoke execute on function public.recalculate_member_points(uuid) from public, anon;
grant  execute on function public.recalculate_member_points(uuid) to authenticated;

-- Member merge. Callers are admin-only: src/pages/Admin/Members.tsx:280 and
-- src/pages/Admin/MergeSuggestions.tsx:120. This one carried a DIRECT anon
-- grant rather than an inherited PUBLIC one -- it was granted deliberately at
-- some point, not left over from a default.
revoke execute on function public.smart_merge_members(uuid, uuid) from public, anon;
grant  execute on function public.smart_merge_members(uuid, uuid) to authenticated;

-- ===========================================================================
-- B. record_event_interest -- the one RPC anon legitimately needs
-- ===========================================================================
--
-- Called from the browser on the public Events route
-- (src/data/repos/events.ts:196), so the anon grant stays. It is safe to expose:
-- the body validates the signal against ('interested','going'), requires the
-- event to exist AND be published, and only increments counters -- it returns
-- void and reads back nothing.
--
-- It was, however, SECURITY DEFINER with no pinned search_path: a definer
-- function whose resolution order an unprivileged caller can influence is the
-- textbook privilege-escalation vector, and this one is deliberately reachable
-- by anonymous callers. Every other DEFINER function in this schema pins it.
--
-- Pinned via ALTER (not CREATE OR REPLACE) so the body is provably unchanged.
-- Safe at '' because the body already qualifies public.events and
-- public.event_interest_counts; now() resolves from pg_catalog, which is always
-- implicitly present.
alter function public.record_event_interest(uuid, text) set search_path = '';

-- ===========================================================================
-- C. Trigger functions -- revoke PUBLIC and anon
-- ===========================================================================
--
-- Policy hygiene, not an open door (see the trigger note in the header).

revoke execute on function public.ai_knowledge_base_set_search_vector() from public, anon;
revoke execute on function public.check_achievements() from public, anon;
revoke execute on function public.create_event_check_in_secret() from public, anon;
revoke execute on function public.ensure_single_current_vcn_archive() from public, anon;
revoke execute on function public.guard_avatar_url_review() from public, anon;
revoke execute on function public.guard_member_photo_request_rate_limit() from public, anon;
revoke execute on function public.guard_user_profile_protected_fields() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.handle_new_user_points() from public, anon;
revoke execute on function public.handle_updated_at() from public, anon;
revoke execute on function public.prevent_overlapping_house_memberships() from public, anon;
revoke execute on function public.record_data_rights_request_event() from public, anon;
revoke execute on function public.record_member_photo_request_submission() from public, anon;
revoke execute on function public.set_application_link_audit_fields() from public, anon;
revoke execute on function public.set_data_rights_request_audit_fields() from public, anon;
revoke execute on function public.set_member_photo_request_updated_at() from public, anon;
revoke execute on function public.set_resource_link_audit_fields() from public, anon;
revoke execute on function public.sync_attendance_points_on_event_update() from public, anon;
revoke execute on function public.sync_member_points() from public, anon;
revoke execute on function public.update_event_points() from public, anon;
revoke execute on function public.update_updated_at_column() from public, anon;

-- ===========================================================================
-- D. Pin the remaining unpinned SECURITY DEFINER function
-- ===========================================================================
--
-- Trigger function on the points cascade. Lower reachability than
-- record_event_interest, same class of defect. Body already qualifies
-- public.member_event_attendance and public.members throughout, so '' is safe
-- and the ALTER leaves the body byte-identical.
alter function public.sync_attendance_points_on_event_update() set search_path = '';

commit;

-- ---------------------------------------------------------------------------
-- VERIFY AFTER APPLYING
-- ---------------------------------------------------------------------------
--
-- Expect exactly one row, record_event_interest:
--
--   select p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind = 'f'
--     and has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- Expect zero rows (no unpinned SECURITY DEFINER functions remain):
--
--   select p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef
--     and not exists (
--       select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
--       where cfg like 'search_path=%'
--     );
--
-- Then confirm the public Events route can still register interest, and that
-- an authenticated member can still check in.
