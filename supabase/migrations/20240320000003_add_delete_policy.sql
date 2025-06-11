-- Drop existing delete policy if it exists
drop policy if exists "Events are deletable by admins" on public.events;

-- Create policy for deleting events
create policy "Events are deletable by admins"
    on public.events for delete
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and is_admin = true
        )
    ); 