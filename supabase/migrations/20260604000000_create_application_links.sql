-- Admin-managed application / interest-form links with open + close windows.
--
-- Privacy model (mirrors published_vcn_archives):
--   * The base table application_links has NO public read policy.
--   * Admins CRUD the base table directly through admin-only policies.
--   * The public reads through the public_application_links view, which masks
--     target_url unless the window is currently active and computes a status.
--
-- No real application URLs are seeded. Placeholder rows are disabled and use an
-- example-safe URL so the admin screen and public fallbacks have rows to render.

create table if not exists public.application_links (
  id uuid primary key default gen_random_uuid(),
  application_key text not null,
  title text not null,
  description text,
  button_label text not null,
  target_url text not null,
  open_at timestamptz not null,
  due_at timestamptz not null,
  is_enabled boolean not null default true,
  before_open_message text,
  after_close_message text,
  sort_order integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_links_key_check check (
    application_key in (
      'ace_application',
      'house_fall',
      'house_winter',
      'house_spring',
      'intern_application',
      'cabinet_application',
      'vcn_stage_ninja_interest',
      'vcn_props_team_interest',
      'wnc_team_form'
    )
  ),
  constraint application_links_window_check check (due_at > open_at)
);

create index if not exists application_links_key_idx
  on public.application_links (application_key);

create index if not exists application_links_window_idx
  on public.application_links (is_enabled, open_at, due_at);

alter table public.application_links enable row level security;

-- Audit fields trigger (mirrors resource_links).
create or replace function public.set_application_link_audit_fields()
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

drop trigger if exists set_application_link_audit_fields on public.application_links;
create trigger set_application_link_audit_fields
  before insert or update on public.application_links
  for each row
  execute function public.set_application_link_audit_fields();

-- Admin-only policies. No anon/public select on the base table.
drop policy if exists "Admins can view application links" on public.application_links;
create policy "Admins can view application links"
  on public.application_links for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert application links" on public.application_links;
create policy "Admins can insert application links"
  on public.application_links for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update application links" on public.application_links;
create policy "Admins can update application links"
  on public.application_links for update
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

drop policy if exists "Admins can delete application links" on public.application_links;
create policy "Admins can delete application links"
  on public.application_links for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Public-safe view. Masks target_url unless the window is currently active and
-- exposes a precomputed status. Runs with the view owner's privileges, so anon
-- never touches the base table directly (same approach as published_vcn_archives).
create or replace view public.public_application_links as
select
  id,
  application_key,
  title,
  description,
  button_label,
  case
    when is_enabled and now() >= open_at and now() <= due_at then target_url
    else null
  end as target_url,
  case
    when not is_enabled then 'disabled'
    when now() < open_at then 'not_open'
    when now() > due_at then 'closed'
    else 'open'
  end as status,
  open_at,
  due_at,
  is_enabled,
  before_open_message,
  after_close_message,
  sort_order,
  updated_at
from public.application_links;

grant select on public.public_application_links to anon, authenticated;

-- Disabled placeholder rows: example-safe URL, masked while disabled. Admins
-- replace target_url / dates / messages per cycle. No real links seeded. Only
-- seeded when the table is empty so re-runs never duplicate rows.
insert into public.application_links (
  application_key,
  title,
  button_label,
  target_url,
  open_at,
  due_at,
  is_enabled,
  before_open_message,
  after_close_message,
  sort_order
)
select * from (values
  ('ace_application', 'ACE Application', 'Apply for ACE',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'ACE applications will be released later.',
    'ACE applications have closed. Check back next year.', 10),
  ('house_fall', 'House Application — Fall', 'Apply for a House',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'House applications will be released closer to the next House cycle.',
    'House applications have closed. Check back next quarter.', 20),
  ('house_winter', 'House Application — Winter', 'Apply for a House',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'House applications will be released closer to the next House cycle.',
    'House applications have closed. Check back next quarter.', 21),
  ('house_spring', 'House Application — Spring', 'Apply for a House',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'House applications will be released closer to the next House cycle.',
    'House applications have closed. Check back next quarter.', 22),
  ('intern_application', 'Intern Application', 'Apply to be an Intern',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'Intern applications will be released later.',
    'Intern applications have closed. Check back next year.', 30),
  ('cabinet_application', 'Cabinet Application', 'Apply for Cabinet',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'Cabinet applications will be released later.',
    'Cabinet applications have closed. Check back next year.', 40),
  ('vcn_stage_ninja_interest', 'VCN Stage Ninja Interest', 'Stage Ninja Interest Form',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'Stage Ninja interest forms will be released closer to VCN.',
    'Stage Ninja interest forms have closed for this cycle.', 50),
  ('vcn_props_team_interest', 'VCN Props Team Interest', 'Props Team Interest Form',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'Props team interest forms will be released closer to VCN.',
    'Props team interest forms have closed for this cycle.', 51),
  ('wnc_team_form', 'WNC Team Form', 'WNC Team Form',
    'https://example.com/placeholder', now(), now() + interval '1 day', false,
    'WNC team forms will be released closer to Wild ''N Culture.',
    'WNC team forms have closed for this cycle.', 60)
) as seed
where not exists (select 1 from public.application_links);
