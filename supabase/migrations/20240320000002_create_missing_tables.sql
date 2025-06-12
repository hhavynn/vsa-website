-- Create events table if it doesn't exist
create table if not exists public.events (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    date timestamp with time zone not null,
    location text,
    points integer not null default 0,
    check_in_form_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_points table if it doesn't exist
create table if not exists public.user_points (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    points integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id)
);

-- Create user_profiles table if it doesn't exist
create table if not exists public.user_profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    email text not null,
    is_admin boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.events enable row level security;
alter table public.user_points enable row level security;
alter table public.user_profiles enable row level security;

-- Drop existing policy if it exists
drop policy if exists "Events are viewable by everyone" on public.events;

-- Create policies for events
create policy "Events are viewable by everyone"
    on public.events for select
    using (true);

create policy "Events are insertable by admins"
    on public.events for insert
    with check (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    );

create policy "Events are updatable by admins"
    on public.events for update
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    );

-- Create policies for user_points
create policy "Users can view their own points"
    on public.user_points for select
    using (auth.uid() = user_id);

create policy "Admins can view all points"
    on public.user_points for select
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    );

-- Drop existing policy if it exists
drop policy if exists "Users can view their own profile" on public.user_profiles;

-- Create policies for user_profiles
create policy "Users can view their own profile"
    on public.user_profiles for select
    using (auth.uid() = id);

-- Drop existing update policy if it exists
drop policy if exists "Users can update their own profile" on public.user_profiles;

-- Create update policy for user_profiles
create policy "Users can update their own profile"
    on public.user_profiles for update
    using (auth.uid() = id);

-- Insert existing users into user_profiles if not exists
insert into public.user_profiles (id, email, is_admin)
select id, email, false
from auth.users
where id not in (select id from public.user_profiles);

-- Create initial user_points entries for existing users if not exists
insert into public.user_points (user_id, points)
select id, 0
from auth.users
where id not in (select user_id from public.user_points); 