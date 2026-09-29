-- Link ACE family members and Cabinet members to members.id so a single
-- approved photo (public_member_avatars, keyed by members.id) appears
-- everywhere that person is shown publicly: leaderboard, ACE trees, fam-head
-- cards, and Cabinet.
--
-- Additive only: two nullable FK columns, one public view gains member_id,
-- and a conservative backfill that fills NULL links only. ace photo_url and
-- cabinet image_url/thumbnail_url are untouched and stay the fallback for
-- unlinked and historical people. No attendance, points, House membership,
-- check-in, import, or photo-approval behavior changes.
--
-- Privacy: members.id is already public through the leaderboard views and
-- public_member_avatars, and ACE/Cabinet names are already public, so the link
-- adds no new category of exposed data.

-- ─── Link columns ────────────────────────────────────────────────────────────

alter table public.ace_family_members
  add column if not exists member_id uuid references public.members(id) on delete set null;

create index if not exists ace_family_members_member_idx
  on public.ace_family_members (member_id)
  where member_id is not null;

comment on column public.ace_family_members.member_id is
  'Optional link to members.id. When set, the member''s approved public avatar takes priority over photo_url. Left NULL when the match is ambiguous.';

alter table public.cabinet_members
  add column if not exists member_id uuid references public.members(id) on delete set null;

create index if not exists cabinet_members_member_idx
  on public.cabinet_members (member_id)
  where member_id is not null;

comment on column public.cabinet_members.member_id is
  'Optional link to members.id. When set, the member''s approved public avatar takes priority over image_url/thumbnail_url. Left NULL when the match is ambiguous.';

-- ─── Public ACE tree view ────────────────────────────────────────────────────

-- Appends member_id; every existing column keeps its name, type, and order.
create or replace view public.published_ace_family_members as
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

-- Supabase default privileges left ALL on this view for anon and
-- authenticated. Adopt the revoke-then-grant pattern from
-- 20260701000000_add_member_photo_requests.sql: SELECT only.
revoke all on public.published_ace_family_members from anon, authenticated;
grant select on public.published_ace_family_members to anon, authenticated;

-- ─── Conservative backfill (2025–26 onward) ─────────────────────────────────

-- Current members: at least one attendance in academic year 2025–26 or later,
-- whose normalized full name belongs to exactly one members row. Any name
-- shared by two members rows is ambiguous and never linked.
create temporary table current_member_names as
with member_names as (
  select
    m.id,
    lower(regexp_replace(btrim(m.first_name || ' ' || m.last_name), '\s+', ' ', 'g')) as name_key,
    exists (
      select 1
      from public.member_yearly_points y
      where y.member_id = m.id
        and y.academic_year_start >= 2025
    ) as is_current
  from public.members m
)
select name_key, (array_agg(id))[1] as member_id
from member_names
group by name_key
having count(*) = 1 and bool_and(is_current);

-- ACE: the tree name must also be unique across every ACE tree, and the node
-- must look current-era: either its Big or one of its Littles is also a
-- current member, or it sits in its fam's latest three generations. This
-- keeps same-named alumni deep in old lines from borrowing a current
-- member's photo. Graveyard "(Dead)" fams are alumni lines and are skipped.
with recursive ace as (
  select
    a.id,
    a.family_id,
    a.parent_member_id,
    lower(regexp_replace(btrim(a.name), '\s+', ' ', 'g')) as name_key,
    lower(btrim(f.name)) like '(dead)%' as is_graveyard
  from public.ace_family_members a
  join public.ace_families f on f.id = a.family_id
),
unique_ace_names as (
  select name_key from ace group by name_key having count(*) = 1
),
depths as (
  select id, 0 as depth from ace where parent_member_id is null
  union all
  select child.id, depths.depth + 1
  from ace child
  join depths on child.parent_member_id = depths.id
  where depths.depth < 64
),
node_depth as (
  select id, max(depth) as depth from depths group by id
),
family_depth as (
  select ace.family_id, max(node_depth.depth) as max_depth
  from ace join node_depth using (id)
  group by ace.family_id
),
matches as (
  select ace.id, current_member_names.member_id
  from ace
  join unique_ace_names using (name_key)
  join current_member_names using (name_key)
  join node_depth using (id)
  join family_depth using (family_id)
  where not ace.is_graveyard
    and (
     node_depth.depth >= family_depth.max_depth - 2
     or exists (
       select 1 from ace big
       where big.id = ace.parent_member_id
         and big.name_key in (select name_key from current_member_names)
     )
     or exists (
       select 1 from ace little
       where little.parent_member_id = ace.id
         and little.name_key in (select name_key from current_member_names)
     )
    )
)
update public.ace_family_members target
set member_id = matches.member_id
from matches
where target.id = matches.id
  and target.member_id is null;

-- Cabinet: 2025–26 and later cabinet years only, and the name must be unique
-- within its cabinet year.
with cabinet as (
  select
    c.id,
    c.cabinet_year_id,
    lower(regexp_replace(btrim(c.name), '\s+', ' ', 'g')) as name_key
  from public.cabinet_members c
  join public.cabinet_years y on y.id = c.cabinet_year_id
  where y.start_year >= 2025
),
unique_cabinet_names as (
  select cabinet_year_id, name_key
  from cabinet
  group by cabinet_year_id, name_key
  having count(*) = 1
)
update public.cabinet_members target
set member_id = current_member_names.member_id
from cabinet
join unique_cabinet_names using (cabinet_year_id, name_key)
join current_member_names using (name_key)
where target.id = cabinet.id
  and target.member_id is null;

drop table current_member_names;
