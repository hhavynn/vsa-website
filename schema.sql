-- Reload schema cache to ensure API sees changes
NOTIFY pgrst, 'reload_schema';

-- Drop tables to ensure clean state
drop table if exists public.check_in_code_usage cascade;
drop table if exists public.check_in_codes cascade;
drop table if exists public.event_attendance cascade;
drop table if exists public.events cascade;

-- Create events table (matching src/types/database.ts and src/data/repos/events.ts)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  date timestamptz not null, -- Code expects 'date', not start_time/end_time
  location text,
  points int default 0,
  event_type text check (event_type in ('gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other')),
  check_in_form_url text,
  image_url text,
  check_in_code text,
  is_code_expired boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create event_attendance table
create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  points_earned int default 0,
  check_in_type text check (check_in_type in ('code', 'manual')),
  checked_in_by uuid references auth.users(id),
  checked_in_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, user_id)
);

-- Create check_in_codes table (Fixed USER-DEFINED error)
create table public.check_in_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  event_type text not null check (event_type in ('gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other')),
  points int not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Create check_in_code_usage table
create table public.check_in_code_usage (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references public.check_in_codes(id) not null,
  used_by uuid references auth.users(id) not null,
  used_at timestamptz default now()
);

-- Enable RLS
alter table public.events enable row level security;
alter table public.event_attendance enable row level security;
alter table public.check_in_codes enable row level security;
alter table public.check_in_code_usage enable row level security;

-- Policies for events
create policy "Events are viewable by everyone" on public.events for select using (true);
create policy "Events are insertable by authenticated users" on public.events for insert with check (auth.role() = 'authenticated');
create policy "Events are updatable by authenticated users" on public.events for update using (auth.role() = 'authenticated');
create policy "Events are deletable by authenticated users" on public.events for delete using (auth.role() = 'authenticated');

-- Policies for event_attendance
create policy "Users can view their own attendance" on public.event_attendance for select using (auth.uid() = user_id);
create policy "Users can insert their own attendance" on public.event_attendance for insert with check (auth.uid() = user_id);

-- Policies for check_in_codes
create policy "Check-in codes are viewable by authenticated users" on public.check_in_codes for select using (auth.role() = 'authenticated');
create policy "Check-in codes are insertable by authenticated users" on public.check_in_codes for insert with check (auth.role() = 'authenticated');

-- Policies for check_in_code_usage
create policy "Usage is viewable by authenticated users" on public.check_in_code_usage for select using (auth.role() = 'authenticated');
create policy "Usage is insertable by authenticated users" on public.check_in_code_usage for insert with check (auth.role() = 'authenticated');