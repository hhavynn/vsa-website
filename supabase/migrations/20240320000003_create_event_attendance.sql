-- Create event_attendance table
create table if not exists public.event_attendance (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.events(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    checked_in_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(event_id, user_id)
);

-- Enable Row Level Security
alter table public.event_attendance enable row level security;

-- Create policies for event_attendance
create policy "Event attendance is viewable by everyone"
    on public.event_attendance for select
    using (true);

create policy "Users can insert their own attendance"
    on public.event_attendance for insert
    with check (auth.uid() = user_id);

create policy "Admins can insert any attendance"
    on public.event_attendance for insert
    with check (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    );

create policy "Users can update their own attendance"
    on public.event_attendance for update
    using (auth.uid() = user_id);

create policy "Admins can update any attendance"
    on public.event_attendance for update
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    );