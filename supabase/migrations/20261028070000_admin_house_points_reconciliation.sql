-- Admin-only, read-only House points reconciliation (#622).
--
-- The same measurement as scripts/sql/house-points-reconciliation.sql, for
-- the Admin -> Houses -> Points check tab: how one academic year's ledger
-- credits reach the House views, by outcome, plus per-House view totals. It
-- measures and never writes (STABLE, SECURITY INVOKER: it reads only what the
-- calling admin's RLS allows, and refuses non-admins). The session time zone
-- is pinned to UTC because production evaluates the House views in UTC.
-- Counts and House names only; no member names, emails or notes.
--
-- Additive: one function. EXECUTE revoked from PUBLIC and anon, granted to
-- authenticated (the admin check is inside). Apply before the frontend tab
-- can show results; until then the tab says the check is unavailable.

create or replace function public.admin_house_points_reconciliation(p_year integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_summary jsonb;
  v_houses jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can run the House points check.' using errcode = '42501';
  end if;

  select to_jsonb(s) into v_summary from (
with params as (select p_year as year),
credits as (
  select a.id as credit_id, a.member_id, a.event_id, a.points_earned,
         e.date as event_at, e.academic_term_id, t.academic_year_start
  from public.member_event_attendance a
  join public.events e on e.id = a.event_id
  left join public.academic_terms t on t.id = e.academic_term_id
),
year_credits as (
  select c.* from credits c, params p
  where c.academic_year_start = p.year and c.points_earned > 0 and c.event_at is not null
),
memberships as (
  select hm.* from public.house_memberships hm, params p where hm.academic_year_start = p.year
),
-- Same attribution as the views, including their 2025-26 rule that only
-- events from the 2025 Reveal (2025-11-08) on count for Houses.
attributed as (
  select yc.credit_id, yc.member_id, hm.house_profile_id, hp.is_active
  from year_credits yc
  join memberships hm on hm.member_id = yc.member_id
   and yc.event_at::date >= hm.effective_start_date
   and (hm.effective_end_date is null or yc.event_at::date < hm.effective_end_date)
  join public.house_page_assets hp on hp.id = hm.house_profile_id
  where yc.academic_year_start <> 2025 or yc.event_at::date >= date '2025-11-08'
),
view_members as (
  select house_profile_id, sum(total_points) as points
  from public.house_member_yearly_points, params p
  where academic_year_start = p.year group by house_profile_id
),
view_houses as (
  select house_profile_id, total_points as points
  from public.house_yearly_points, params p
  where academic_year_start = p.year
)
select   (select year from params) as academic_year_start,
  (select count(*) from year_credits) as year_credits,
  (select count(distinct credit_id) from attributed where is_active) as credits_earning_house_points,
  (select count(*) from year_credits yc where not exists (select 1 from memberships hm where hm.member_id = yc.member_id))
    as credits_member_has_no_house_this_year,
  (select count(*) from year_credits yc where exists (select 1 from memberships hm where hm.member_id = yc.member_id)
     and not exists (select 1 from attributed at where at.credit_id = yc.credit_id))
    as credits_outside_membership_interval,
  (select count(*) from year_credits yc where exists (
     select 1 from memberships hm where hm.member_id = yc.member_id and yc.event_at::date < hm.effective_start_date)
     and not exists (select 1 from attributed at where at.credit_id = yc.credit_id))
    as credits_before_house_start,
  (select count(*) from credits c, params p where c.academic_term_id is null and c.event_at is not null
     and extract(year from c.event_at at time zone 'America/Los_Angeles') between p.year and p.year + 1)
    as credits_event_without_term_near_year,
  (select count(distinct credit_id) from attributed where not is_active) as credits_on_inactive_house_profile,
  (select count(*) from (select credit_id from attributed group by credit_id having count(*) > 1) d)
    as credits_attributed_to_two_houses,
  (select count(*) from memberships a join memberships b on a.member_id = b.member_id and a.id < b.id
     and a.effective_start_date < coalesce(b.effective_end_date, 'infinity'::date)
     and b.effective_start_date < coalesce(a.effective_end_date, 'infinity'::date))
    as overlapping_memberships,
  (select count(*) from (select member_id from memberships group by member_id having count(*) > 1) t)
    as members_transferred_this_year,
  (select count(*) from memberships hm where hm.effective_start_date > current_date) as future_dated_memberships,
  (select count(*) from year_credits yc join memberships hm on hm.member_id = yc.member_id
     where (yc.event_at::date >= hm.effective_start_date) <> ((yc.event_at at time zone 'America/Los_Angeles')::date >= hm.effective_start_date)
        or (hm.effective_end_date is not null and
            (yc.event_at::date < hm.effective_end_date) <> ((yc.event_at at time zone 'America/Los_Angeles')::date < hm.effective_end_date)))
    as pacific_vs_utc_boundary_credits,
  (select count(*) from view_houses vh full join view_members vm using (house_profile_id)
     where coalesce(vh.points, 0) <> coalesce(vm.points, 0))
    as house_member_vs_house_total_mismatch,
  (select count(*) from (
     select at.house_profile_id, count(*) as recomputed from attributed at where at.is_active group by at.house_profile_id
   ) r full join view_houses vh using (house_profile_id)
   where coalesce(r.recomputed, 0) <> coalesce(vh.points, 0))
    as recomputed_vs_view_mismatch
  ) s;

  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) into v_houses from (
with params as (select p_year as year)
select hp.id as house_profile_id, hp.display_name, hy.total_points as view_house_points,
  (select coalesce(sum(total_points), 0) from public.house_member_yearly_points m
    where m.house_profile_id = hp.id and m.academic_year_start = p.year) as view_member_points_sum,
  (select count(*) from public.house_memberships hm where hm.house_profile_id = hp.id and hm.academic_year_start = p.year) as membership_rows
from public.house_page_assets hp
cross join params p
left join public.house_yearly_points hy on hy.house_profile_id = hp.id and hy.academic_year_start = p.year
where hp.academic_year_start = p.year

  ) h;

  return jsonb_build_object('summary', v_summary, 'houses', v_houses, 'checked_at', now());
end;
$$;

revoke execute on function public.admin_house_points_reconciliation(integer) from public, anon;
grant execute on function public.admin_house_points_reconciliation(integer) to authenticated;
