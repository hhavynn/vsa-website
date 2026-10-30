-- Interns shadow up to 3 cabinet positions; they do not get a specific mentor.
--
-- Replaces intern_cohort_drafts.mentor_cabinet_member_id (one person) with
-- shadow_positions (up to 3 position titles). Titles, not people, because one
-- position can be held by two people. Nothing public ever read the mentor.
--
-- Access boundary: unchanged. intern_cohort_drafts stays admin only for both
-- anon and authenticated (existing is_admin_user() RLS policies); this file
-- adds no grants and changes no policies. shadow_positions never reaches
-- cabinet_members: the publish mapping does not write it.
--
-- Forward-only and fail-closed: the table is locked first, then the migration
-- aborts before changing anything if any draft still holds a mentor, so it can
-- never destroy a value. No data is migrated.
--
-- Deployment: apply before deploying the frontend that writes shadow_positions.
-- Until that frontend is live, the old mentor picker fails to save; every other
-- cohort action keeps working.
--
-- No attendance, points, House, leaderboard, publish, or RLS behavior changes.
begin;

lock table public.intern_cohort_drafts in access exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.intern_cohort_drafts
    where mentor_cabinet_member_id is not null
  ) then
    raise exception 'intern_cohort_drafts.mentor_cabinet_member_id still holds values; refusing to drop it.';
  end if;
end;
$$;

alter table public.intern_cohort_drafts
  add column shadow_positions text[] not null default '{}',
  add constraint intern_cohort_drafts_shadow_positions_check
    check (cardinality(shadow_positions) <= 3);

alter table public.intern_cohort_drafts
  drop column mentor_cabinet_member_id;

comment on table public.intern_cohort_drafts is
  'Admin-only draft interns. internal_notes and shadow_positions never leave this table; published_cabinet_member_id links the public row.';
comment on column public.intern_cohort_drafts.shadow_positions is
  'Up to 3 cabinet position titles this intern shadows. Private and optional; never published to cabinet_members.';

commit;
