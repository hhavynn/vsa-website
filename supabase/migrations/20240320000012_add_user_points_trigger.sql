-- Drop existing policy if it exists
drop policy if exists "Users can view their own profile" on public.user_profiles;

-- Function to create user_points row
create or replace function public.handle_new_user_points()
returns trigger as $$
begin
  insert into public.user_points (user_id, points)
  values (new.id, 0)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created_points on auth.users;

-- Create trigger for user_points
create trigger on_auth_user_created_points
  after insert on auth.users
  for each row execute procedure public.handle_new_user_points(); 