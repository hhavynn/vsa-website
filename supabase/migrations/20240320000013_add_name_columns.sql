-- Add name columns to user_profiles
alter table public.user_profiles
add column if not exists first_name text,
add column if not exists last_name text;

-- Update the trigger function to include name fields
create or replace function public.handle_new_user_profile()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, first_name, last_name, is_admin)
  values (new.id, new.email, '', '', false);
  return new;
end;
$$ language plpgsql security definer; 