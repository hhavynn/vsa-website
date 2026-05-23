-- Admin-only source-of-truth index for cabinet operations links.
-- No public read policy is created for this table.

create table if not exists public.resource_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  category text not null,
  role text,
  program text,
  workflow text,
  academic_year_start integer,
  academic_year_end integer,
  is_current boolean not null default true,
  is_archived boolean not null default false,
  visibility text not null default 'admin_only',
  owner_role text,
  last_verified_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_links_visibility_check check (visibility in ('admin_only')),
  constraint resource_links_academic_year_check check (
    academic_year_start is null
    or academic_year_end is null
    or academic_year_end >= academic_year_start
  )
);

create index if not exists resource_links_category_idx
  on public.resource_links (category);

create index if not exists resource_links_current_archive_idx
  on public.resource_links (is_current, is_archived);

create index if not exists resource_links_program_idx
  on public.resource_links (program)
  where program is not null;

alter table public.resource_links enable row level security;

create or replace function public.set_resource_link_audit_fields()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  else
    new.updated_by = auth.uid();
    new.updated_at = now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists set_resource_link_audit_fields on public.resource_links;
create trigger set_resource_link_audit_fields
  before insert or update on public.resource_links
  for each row
  execute function public.set_resource_link_audit_fields();

drop policy if exists "Admins can view resource links" on public.resource_links;
create policy "Admins can view resource links"
  on public.resource_links for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert resource links" on public.resource_links;
create policy "Admins can insert resource links"
  on public.resource_links for insert
  with check (
    visibility = 'admin_only'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update resource links" on public.resource_links;
create policy "Admins can update resource links"
  on public.resource_links for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    visibility = 'admin_only'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete resource links" on public.resource_links;
create policy "Admins can delete resource links"
  on public.resource_links for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
