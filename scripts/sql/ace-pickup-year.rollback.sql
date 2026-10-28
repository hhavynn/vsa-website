-- Reverses 20261027190000_ace_member_pickup_year.sql.
--
-- Run only on an owner decision. It DROPS approved pickup years and all
-- pickup evidence, so export them first if any exist:
--
--   select id, pickup_academic_year_start, pickup_term
--   from public.ace_family_members where pickup_academic_year_start is not null;
--   select * from public.ace_member_pickup_evidence;
--
-- Every other ace_family_members column, row, link and photo is untouched.
-- Deploy the previous frontend first (or alongside): the current one tolerates
-- missing pickup columns, but an older one never reads them.

begin;

-- Removing view columns needs drop + create; the fresh view gets Supabase's
-- default ALL grants again, so re-apply revoke-then-grant.
drop view if exists public.published_ace_family_members;
create view public.published_ace_family_members as
select
  m.id,
  m.family_id,
  m.name,
  m.role_label,
  m.photo_url,
  m.parent_member_id,
  m.display_order,
  m.created_at,
  m.updated_at,
  m.member_id
from public.ace_family_members m
join public.ace_families f on f.id = m.family_id
where m.is_published = true and f.is_published = true;

revoke all on public.published_ace_family_members from anon, authenticated;
grant select on public.published_ace_family_members to anon, authenticated;

drop function if exists public.set_ace_member_pickup_year(uuid, integer, text, uuid);
drop table if exists public.ace_member_pickup_evidence;

alter table public.ace_family_members
  drop constraint if exists ace_family_members_pickup_term_valid,
  drop constraint if exists ace_family_members_pickup_year_range,
  drop column if exists pickup_term,
  drop column if exists pickup_academic_year_start;

commit;
