-- PostgREST upsert (POST + on_conflict) requires INSERT permission in addition to UPDATE.
-- This was missing from the initial site_settings migration.

create policy "Admins can insert site settings"
  on site_settings for insert
  with check (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
