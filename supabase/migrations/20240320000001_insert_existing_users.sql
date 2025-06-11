-- Insert existing users into user_profiles
insert into public.user_profiles (id, email, is_admin)
select id, email, false
from auth.users
where id not in (select id from public.user_profiles);

-- Make your user an admin (replace 'your-email@example.com' with your actual email)
update public.user_profiles
set is_admin = true
where email = 'your-email@example.com'; 