-- Revoke client EXECUTE on the House assignment and Intern cohort guard
-- trigger functions added in Phase 2 (20261001213414 / 20261001213433).
--
-- WHY: Postgres grants EXECUTE on new functions to PUBLIC, so these six trigger
-- functions were callable as RPCs by anon and authenticated. They are SECURITY
-- INVOKER with a pinned search_path, so a direct call fails without trigger
-- context and nothing was exposed; this restores the convention set by
-- 20260928005621 (trigger functions never need client EXECUTE) and already
-- followed by the ACE guards. PostgreSQL checks EXECUTE on a trigger function
-- only at CREATE TRIGGER time, so revoking changes nothing about how the
-- triggers fire.
--
-- Additive and idempotent: REVOKE on a privilege that is already absent is a
-- no-op. No table, policy, row, or function body changes.

revoke execute on function public.guard_house_assignment_batch_update() from public, anon, authenticated;
revoke execute on function public.guard_house_assignment_batch_delete() from public, anon, authenticated;
revoke execute on function public.guard_house_assignment_draft_mutation() from public, anon, authenticated;

revoke execute on function public.guard_intern_cohort_cycle_update() from public, anon, authenticated;
revoke execute on function public.guard_intern_cohort_cycle_delete() from public, anon, authenticated;
revoke execute on function public.guard_intern_cohort_draft_mutation() from public, anon, authenticated;
