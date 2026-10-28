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
--   A membership row is public only when its House profile is active AND
--     (a) a House assignment batch for that academic year is published
--         (the Reveal happened), or
--     (b) the academic year is earlier than the active academic term's year
--         (historical years stay visible after rollover).
--   A locked-but-not-revealed batch writes no memberships, and any membership
--   an admin adds by hand for the upcoming year stays hidden until (a) or (b).
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

create or replace view public.public_house_memberships as
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
    exists (
      select 1 from public.house_assignment_batches b
      where b.academic_year_start = hm.academic_year_start
        and b.status = 'published'
    )
    or hm.academic_year_start < (
      select max(t.academic_year_start) from public.academic_terms t where t.is_active
    )
  );

revoke all on public.public_house_memberships from public, anon, authenticated;
grant select on public.public_house_memberships to anon, authenticated;

comment on view public.public_house_memberships is
  'Public, score-free House membership identity. Rows appear only after the year''s House Reveal (a published assignment batch) or once the year is historical. No points or attendance.';
