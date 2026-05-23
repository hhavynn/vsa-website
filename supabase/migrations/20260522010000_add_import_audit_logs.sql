-- Audit-only records for Admin Attendance Import.
-- This is additive and does not alter attendance, points, or rollback behavior.

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  source_url text,
  source_type text not null default 'unknown'
    check (source_type in ('csv_url', 'google_sheets_csv', 'manual', 'unknown')),
  total_rows integer not null default 0 check (total_rows >= 0),
  matched_rows integer not null default 0 check (matched_rows >= 0),
  created_members integer not null default 0 check (created_members >= 0),
  created_attendance_count integer not null default 0 check (created_attendance_count >= 0),
  skipped_duplicate_rows integer not null default 0 check (skipped_duplicate_rows >= 0),
  review_rows integer not null default 0 check (review_rows >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'completed'
    check (status in ('completed', 'failed'))
);

create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  source_row_index integer not null,
  raw_row jsonb not null default '{}'::jsonb,
  display_name text,
  csv_email text,
  csv_college text,
  csv_year text,
  matched_member_id uuid references public.members(id) on delete set null,
  created_member_id uuid references public.members(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  attendance_member_id uuid references public.members(id) on delete set null,
  points_earned integer,
  decision text not null
    check (decision in ('matched', 'created', 'skipped_duplicate', 'review', 'error')),
  status text not null default 'recorded'
    check (status in ('recorded', 'error')),
  score integer,
  match_details jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists import_jobs_created_at_idx
  on public.import_jobs (created_at desc);

create index if not exists import_jobs_event_id_idx
  on public.import_jobs (event_id);

create index if not exists import_job_rows_job_id_idx
  on public.import_job_rows (import_job_id, source_row_index);

alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;

drop policy if exists "Admins can manage import jobs" on public.import_jobs;
create policy "Admins can manage import jobs"
  on public.import_jobs for all
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

drop policy if exists "Admins can manage import job rows" on public.import_job_rows;
create policy "Admins can manage import job rows"
  on public.import_job_rows for all
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
