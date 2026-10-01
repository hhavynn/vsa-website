-- Access-only: public projections retain display data; raw identity/import data
-- is admin-only. No attendance, points, or membership rows are changed.
begin;

create view public.public_members with (security_barrier = true) as
select id, first_name, last_name, college, year, house, points, events_attended
from public.members;
revoke all on public.public_members from public, anon, authenticated;
grant select on public.public_members to anon, authenticated;

-- A restrictive policy also closes unknown permissive SELECT/FOR ALL drift.
create policy "Raw members require admin" on public.members
  as restrictive for select to anon, authenticated
  using (public.is_admin_user(auth.uid()));
create policy "Admins can read raw members" on public.members
  for select to authenticated using (public.is_admin_user(auth.uid()));
create policy "Raw member attendance requires admin" on public.member_event_attendance
  as restrictive for select to anon, authenticated
  using (public.is_admin_user(auth.uid()));
create policy "Admins can read raw member attendance" on public.member_event_attendance
  for select to authenticated using (public.is_admin_user(auth.uid()));

-- Anon no longer needs base-table grants, including old column-level grants.
revoke select on public.members from anon;
revoke select (id, first_name, last_name, college, year, house, points, events_attended)
  on public.members from anon;
revoke select on public.member_event_attendance from anon;

comment on view public.public_members is
  'Read-only public display projection. Omits Auth UUIDs, emails, review and import metadata.';
comment on table public.member_event_attendance is
  'Admin-only raw import ledger. Public attendance uses member_event_history with its published-event filter.';
commit;
