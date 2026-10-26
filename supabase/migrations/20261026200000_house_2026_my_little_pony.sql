-- 2026-2027 Houses: My Little Pony, with their House Parents.
--
-- Owner-confirmed (2026-10-26) Houses and House Parents for 2026-2027:
--   Twilight Sparkle  Timothy (Tim) Huynh, Kent Nguyen
--   Applejack         Ryan Francisco, Nathan Centeno
--   Pinkie Pie        Ingyin Moh, Martin Dang      (spelled "Pinkie", not "Pinky")
--   Rarity            Kirsten Ngo, Jonas Truong
--
-- WHAT
--   1. house_parents: admin-only link from a House profile's House Parent to
--      their canonical members.id. Public pages keep showing House Parents
--      through the existing house_page_assets fields (house_parent_heading /
--      house_parent_body / house_parent_image_url); this table adds identity
--      only and is not readable by anon.
--   2. Upserts the four 2026 house_page_assets rows (active, so the placement
--      tool and the public /house page use them) and fills empty House Parent
--      text. Existing non-empty values (images, copy, colors) are preserved.
--      A misspelled "Pinky Pie" 2026 row, if one exists, is renamed in place so
--      its id (and anything pointing at it) is kept.
--   3. Deactivates any other 2026 row (placeholders); nothing is deleted.
--   4. Links each House Parent to a member only when exactly one member's
--      normalized full name equals one of the listed names (Timothy Huynh is
--      also searched as "Tim Huynh"). Zero or several matches leave member_id
--      null with a review_note for an admin; no member is created. A link an
--      admin already set is never overwritten.
--
-- SCOPE
--   Touches academic_year_start = 2026 only. 2025-2026 Mario Houses and every
--   archived year are untouched. No house_memberships, members, attendance,
--   points or leaderboard rows are written. Idempotent: re-running converges
--   to the same state.
--
-- Deploy: apply after 20261026180000_house_assignment_timestamp_placement.sql,
-- then deploy the frontend. Applying this migration makes the four House
-- profiles (names, colors, House Parent names) visible on /house; House
-- assignments stay private until a placement draft is revealed.

-- ─── 1. House Parent identity links ─────────────────────────────────────────

create table if not exists public.house_parents (
  id uuid primary key default gen_random_uuid(),
  house_profile_id uuid not null references public.house_page_assets(id) on delete cascade,
  display_name text not null,
  -- Null means "needs review". Kept nullable with ON DELETE SET NULL so a
  -- member merge or anonymization never fails because of this link.
  member_id uuid references public.members(id) on delete set null,
  -- Why the link is missing (no member / several members), for the admin.
  review_note text,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_parents_unique_slot unique (house_profile_id, display_order)
);

create index if not exists house_parents_member_idx
  on public.house_parents (member_id)
  where member_id is not null;

drop trigger if exists update_house_parents_updated_at on public.house_parents;
create trigger update_house_parents_updated_at
  before update on public.house_parents
  for each row
  execute function public.update_updated_at_column();

alter table public.house_parents enable row level security;

revoke all on public.house_parents from anon, authenticated;
grant select, insert, update, delete on public.house_parents to authenticated;

drop policy if exists "Admins can view house parents" on public.house_parents;
create policy "Admins can view house parents"
  on public.house_parents for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert house parents" on public.house_parents;
create policy "Admins can insert house parents"
  on public.house_parents for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update house parents" on public.house_parents;
create policy "Admins can update house parents"
  on public.house_parents for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete house parents" on public.house_parents;
create policy "Admins can delete house parents"
  on public.house_parents for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

comment on table public.house_parents is
  'Admin-only: links a House profile''s House Parents to canonical members. Public display uses house_page_assets.house_parent_* fields.';

-- ─── 2-4. 2026-2027 Houses and House Parents ────────────────────────────────

do $$
declare
  spec record;
  parent record;
  profile_id uuid;
  candidate_count integer;
  candidate_id uuid;
begin
  -- Fix the common misspelling in place, keeping the row's id.
  update public.house_page_assets
  set house = 'Pinkie Pie', house_key = 'pinkie-pie', display_name = 'Pinkie Pie'
  where academic_year_start = 2026
    and (lower(house) = 'pinky pie' or house_key = 'pinky-pie')
    and not exists (
      select 1 from public.house_page_assets other
      where other.academic_year_start = 2026
        and (other.house = 'Pinkie Pie' or other.house_key = 'pinkie-pie')
    );

  for spec in
    select * from (values
      ('Twilight Sparkle', 'twilight-sparkle', 0, '#8b5cf6', 'Timothy (Tim) Huynh & Kent Nguyen'),
      ('Applejack',        'applejack',        1, '#f97316', 'Ryan Francisco & Nathan Centeno'),
      ('Pinkie Pie',       'pinkie-pie',       2, '#ec4899', 'Ingyin Moh & Martin Dang'),
      ('Rarity',           'rarity',           3, '#6366f1', 'Kirsten Ngo & Jonas Truong')
    ) as houses(house, house_key, display_order, accent_color, parents_body)
  loop
    -- A 2026 row that already uses this house_key under another name is
    -- renamed rather than colliding with the (year, house_key) unique index.
    update public.house_page_assets
    set house = spec.house
    where academic_year_start = 2026
      and house_key = spec.house_key
      and house <> spec.house
      and not exists (
        select 1 from public.house_page_assets other
        where other.academic_year_start = 2026 and other.house = spec.house
      );

    insert into public.house_page_assets (
      academic_year_start, academic_year_end, house, house_key, display_name,
      accent_color, display_order, is_active, house_parent_body
    )
    values (2026, 2027, spec.house, spec.house_key, spec.house, spec.accent_color, spec.display_order, true, spec.parents_body)
    on conflict (academic_year_start, house) do update
    set
      house_key = excluded.house_key,
      display_name = excluded.display_name,
      display_order = excluded.display_order,
      is_active = true,
      accent_color = coalesce(nullif(house_page_assets.accent_color, ''), excluded.accent_color),
      house_parent_body = coalesce(nullif(house_page_assets.house_parent_body, ''), excluded.house_parent_body);
  end loop;

  -- Placeholder or stray 2026 rows stop showing; they are kept, not deleted.
  update public.house_page_assets
  set is_active = false
  where academic_year_start = 2026
    and house not in ('Twilight Sparkle', 'Applejack', 'Pinkie Pie', 'Rarity')
    and is_active;

  for parent in
    select * from (values
      ('Twilight Sparkle', 0, 'Timothy (Tim) Huynh', array['timothy huynh', 'tim huynh']),
      ('Twilight Sparkle', 1, 'Kent Nguyen',         array['kent nguyen']),
      ('Applejack',        0, 'Ryan Francisco',      array['ryan francisco']),
      ('Applejack',        1, 'Nathan Centeno',      array['nathan centeno']),
      ('Pinkie Pie',       0, 'Ingyin Moh',          array['ingyin moh']),
      ('Pinkie Pie',       1, 'Martin Dang',         array['martin dang']),
      ('Rarity',           0, 'Kirsten Ngo',         array['kirsten ngo']),
      ('Rarity',           1, 'Jonas Truong',        array['jonas truong'])
    ) as parents(house, display_order, display_name, names)
  loop
    select id into profile_id
    from public.house_page_assets
    where academic_year_start = 2026 and house = parent.house;

    select count(*), min(m.id::text)::uuid
    into candidate_count, candidate_id
    from public.members m
    where lower(regexp_replace(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), '\s+', ' ', 'g')) = any(parent.names);

    insert into public.house_parents (house_profile_id, display_name, member_id, review_note, display_order)
    values (
      profile_id,
      parent.display_name,
      case when candidate_count = 1 then candidate_id end,
      case
        when candidate_count = 1 then null
        when candidate_count = 0 then 'No member record has this exact name. Link one by hand.'
        else candidate_count || ' member records share this name. Choose the right one.'
      end,
      parent.display_order
    )
    on conflict (house_profile_id, display_order) do update
    set
      display_name = excluded.display_name,
      member_id = coalesce(house_parents.member_id, excluded.member_id),
      review_note = case when coalesce(house_parents.member_id, excluded.member_id) is not null then null else excluded.review_note end;
  end loop;
end $$;
