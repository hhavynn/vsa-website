-- Create a table for user profiles
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  first_name text,
  last_name text,
  is_admin boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own profile" on public.user_profiles;
drop policy if exists "Users can view all profiles" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Service role can manage all profiles" on public.user_profiles;

-- Create policies
create policy "Users can view their own profile"
    on public.user_profiles for select
    using (auth.uid() = id);

create policy "Users can view all profiles"
    on public.user_profiles for select
    using (true);

create policy "Users can update their own profile"
    on public.user_profiles for update
    using (auth.uid() = id);

create policy "Users can insert their own profile"
    on public.user_profiles for insert
    with check (auth.uid() = id);

create policy "Service role can manage all profiles"
    on public.user_profiles
    using (auth.role() = 'service_role');

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Create a trigger to automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  profile_exists boolean;
begin
  -- Check if profile already exists
  select exists(
    select 1 from public.user_profiles where id = new.id
  ) into profile_exists;

  if not profile_exists then
    insert into public.user_profiles (
      id, 
      email, 
      first_name, 
      last_name, 
      is_admin
    )
    values (
      new.id, 
      new.email, 
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      false
    );
  end if;

  return new;
exception
  when others then
    -- Log the error but don't prevent the user creation
    raise warning 'Error creating user profile: %', SQLERRM;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 