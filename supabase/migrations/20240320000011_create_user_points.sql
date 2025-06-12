-- Create user_points table
create table if not exists public.user_points (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  points integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.user_points enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own points" on public.user_points;
drop policy if exists "Users can view all points" on public.user_points;
drop policy if exists "Users can update their own points" on public.user_points;
drop policy if exists "Service role can manage all points" on public.user_points;

-- Create policies
create policy "Users can view their own points"
    on public.user_points for select
    using (auth.uid() = user_id);

create policy "Users can view all points"
    on public.user_points for select
    using (true);

create policy "Users can update their own points"
    on public.user_points for update
    using (auth.uid() = user_id);

create policy "Service role can manage all points"
    on public.user_points
    using (auth.role() = 'service_role');

-- Create index on user_id for faster lookups
create index if not exists user_points_user_id_idx on public.user_points(user_id); 