-- Public, Reveal-gated, score-free House membership projection (#621, #635).
--
-- WHY
--   house_memberships is admin-only (RLS), so the only public signal of a
--   member's House was the scored views (house_member_yearly_points). A member
--   revealed into a House with no qualifying attendance yet had no public
--   House at all, and the public points lookup fell back to members.house: a
--   display cache that still holds 221 members' 2025-26 Mario Houses with no
--   2025-26 membership rows (production, checked read-only 2026-10-28). The
--   House score embargo (#692) also rules out scored views as the identity
--   source.
--
-- WHAT
--   public.public_house_memberships: member_id, academic year, effective
--   interval and the House's public identity (id, key, display name, accent).
--   No points, attendance, notes, source, batch or creator columns.
--
-- REVEAL BOUNDARY
--   A membership row is public only when its House profile is active AND:
--     - written by an assignment batch (source 'house_assignment_batch'):
--       that exact batch has been published (published_at set). One year can
--       hold several windows' batches (Fall, Winter, Spring), and Reveal
--       writes rows before it marks the batch published, so a partly written
--       or failed Reveal stays private, whatever else is published, and
--       even after the year becomes historical.
--     - any other source (Admin -> Houses by hand, legacy backfill): some
--       batch for that year has been published, or the year is earlier than
--       the active term's year (rollover makes past years history).
--   published_at, not status, so archiving a revealed batch does not hide it.
--
-- SECURITY
--   Owner-rights view over admin-only tables, filtered as above. It joins
--   tables and uses subqueries, so it is not auto-updatable; all privileges
--   are still revoked first and only SELECT is granted to anon and
--   authenticated (revoke-then-grant, see vsa-supabase-security-reference).
--   Nothing is written; no table, policy or existing grant changes.
--
-- DEPLOY
--   Additive. Apply before the frontend that reads it; until then the points
--   lookup shows no House (never the stale cache). Verify:
--   bash scripts/test-public-house-memberships.sh

create or replace view public.public_house_memberships
with (security_barrier = true) as
select
  hm.member_id,
  hm.academic_year_start,
  hm.academic_year_end,
  hm.effective_start_date,
  hm.effective_end_date,
  hp.id as house_profile_id,
  hp.house_key,
  hp.display_name,
  hp.accent_color
from public.house_memberships hm
join public.house_page_assets hp on hp.id = hm.house_profile_id
where hp.is_active = true
  and (
    case
      when hm.source = 'house_assignment_batch' then exists (
        select 1 from public.house_assignment_batches b
        where b.id = hm.source_import_id
          and b.published_at is not null
      )
      else (
        exists (
          select 1 from public.house_assignment_batches b
          where b.academic_year_start = hm.academic_year_start
            and b.published_at is not null
        )
        or hm.academic_year_start < (
          select max(t.academic_year_start) from public.academic_terms t where t.is_active
        )
      )
    end
  );

revoke all on public.public_house_memberships from public, anon, authenticated;
grant select on public.public_house_memberships to anon, authenticated;

comment on view public.public_house_memberships is
  'Public, score-free House membership identity. Rows appear only after the year''s House Reveal (a published assignment batch) or once the year is historical. No points or attendance.';
