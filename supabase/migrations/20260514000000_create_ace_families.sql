-- ACE Families: data foundation for the ACE Big/Little family program.
-- Public users will read only published families/members through a view.
-- Admins (user_profiles.is_admin = true) manage all rows.
--
-- This migration is additive only — no destructive changes to existing tables.

create table if not exists public.ace_families (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  name text not null,
  slug text not null,
  cover_image_url text,
  theme_color text,
  description text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_families_year_span_check check (academic_year_end = academic_year_start + 1),
  constraint ace_families_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint ace_families_unique_slug_per_year unique (academic_year_start, slug)
);

create index if not exists ace_families_year_order_idx
  on public.ace_families (academic_year_start desc, display_order asc);

create table if not exists public.ace_family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.ace_families(id) on delete cascade,
  name text not null,
  role_label text,
  photo_url text,
  parent_member_id uuid references public.ace_family_members(id) on delete set null,
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_family_members_not_self_parent check (parent_member_id is null or parent_member_id <> id)
);

create index if not exists ace_family_members_family_idx
  on public.ace_family_members (family_id, parent_member_id nulls first, display_order asc);

create index if not exists ace_family_members_parent_idx
  on public.ace_family_members (parent_member_id);

-- updated_at trigger (function already exists from earlier migrations).
drop trigger if exists update_ace_families_updated_at on public.ace_families;
create trigger update_ace_families_updated_at
  before update on public.ace_families
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_ace_family_members_updated_at on public.ace_family_members;
create trigger update_ace_family_members_updated_at
  before update on public.ace_family_members
  for each row
  execute function public.update_updated_at_column();

-- Row Level Security
alter table public.ace_families enable row level security;
alter table public.ace_family_members enable row level security;

-- ace_families admin policies
drop policy if exists "Admins can view ace families" on public.ace_families;
create policy "Admins can view ace families"
  on public.ace_families for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert ace families" on public.ace_families;
create policy "Admins can insert ace families"
  on public.ace_families for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update ace families" on public.ace_families;
create policy "Admins can update ace families"
  on public.ace_families for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete ace families" on public.ace_families;
create policy "Admins can delete ace families"
  on public.ace_families for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ace_family_members admin policies
drop policy if exists "Admins can view ace family members" on public.ace_family_members;
create policy "Admins can view ace family members"
  on public.ace_family_members for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert ace family members" on public.ace_family_members;
create policy "Admins can insert ace family members"
  on public.ace_family_members for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update ace family members" on public.ace_family_members;
create policy "Admins can update ace family members"
  on public.ace_family_members for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete ace family members" on public.ace_family_members;
create policy "Admins can delete ace family members"
  on public.ace_family_members for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Public views: expose only published rows. Admin-only fields (internal notes
-- etc.) are deliberately not included here because we never added any to ACE.
create or replace view public.published_ace_families as
select
  id,
  academic_year_start,
  academic_year_end,
  name,
  slug,
  cover_image_url,
  theme_color,
  description,
  display_order,
  created_at,
  updated_at
from public.ace_families
where is_published = true;

grant select on public.published_ace_families to anon, authenticated;

-- A member is public only if it is published AND its family is published.
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
  m.updated_at
from public.ace_family_members m
join public.ace_families f on f.id = m.family_id
where m.is_published = true and f.is_published = true;

grant select on public.published_ace_family_members to anon, authenticated;

-- Storage bucket for ACE family images (covers + member photos).
insert into storage.buckets (id, name, public)
values ('ace_family_images', 'ace_family_images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read access to ace family images" on storage.objects;
create policy "Allow public read access to ace family images"
  on storage.objects for select
  using (bucket_id = 'ace_family_images');

drop policy if exists "Admins can upload ace family images" on storage.objects;
create policy "Admins can upload ace family images"
  on storage.objects for insert
  with check (
    bucket_id = 'ace_family_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update ace family images" on storage.objects;
create policy "Admins can update ace family images"
  on storage.objects for update
  using (
    bucket_id = 'ace_family_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'ace_family_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete ace family images" on storage.objects;
create policy "Admins can delete ace family images"
  on storage.objects for delete
  using (
    bucket_id = 'ace_family_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
