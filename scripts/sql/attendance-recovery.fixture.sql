-- Synthetic records only, for scripts/test-attendance-recovery.sh. A targeted
-- schema slice, not a replay of the whole Supabase schema.
--
-- Points triggers: sync_member_points / recalculate_member_points exist only in
-- production (not in tracked migrations). Their bodies below were copied from
-- the production catalog (pg_get_functiondef, read-only, 2026-10-08) so the
-- tests exercise the real recalculation path. Re-copy them if production changes.
create extension if not exists pgcrypto;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.user_profiles (id uuid primary key references auth.users(id), is_admin boolean not null default false);

-- Production definition (pg_get_functiondef).
create function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path to '' as $function$
  select p_user_id is not null and p_user_id = auth.uid()
    and exists (select 1 from public.user_profiles as profile where profile.id = p_user_id and profile.is_admin = true);
$function$;

create table public.academic_terms (id uuid primary key default gen_random_uuid(), label text not null);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null default now(),
  points integer default 0,
  academic_term_id uuid references public.academic_terms(id)
);
create table public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  college text,
  year text,
  points integer not null default 0,
  events_attended integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  needs_review boolean default false,
  house text
);
create table public.member_event_attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  points_earned integer not null default 0,
  imported_at timestamptz not null default now(),
  unique (member_id, event_id)
);

-- Production definitions (pg_get_functiondef).
create function public.recalculate_member_points(p_member_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  UPDATE public.members SET
    points = COALESCE((SELECT SUM(a.points_earned) FROM public.member_event_attendance a WHERE a.member_id = p_member_id), 0),
    events_attended = (SELECT COUNT(*) FROM public.member_event_attendance a WHERE a.member_id = p_member_id),
    updated_at = now()
  WHERE id = p_member_id;
END;
$function$;

create function public.sync_member_points()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_member_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_member_id := OLD.member_id;
  ELSE
    v_member_id := NEW.member_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.members WHERE id = v_member_id) THEN
    PERFORM public.recalculate_member_points(v_member_id);
  END IF;
  RETURN NULL;
END;
$function$;

create trigger trg_sync_member_points after insert or delete or update on public.member_event_attendance
  for each row execute function public.sync_member_points();

-- Production definition (pg_get_functiondef), cascading event point edits.
create function public.sync_attendance_points_on_event_update()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.points is not distinct from old.points then
    return new;
  end if;
  update public.member_event_attendance set points_earned = new.points where event_id = new.id;
  update public.members m
  set points = (select coalesce(sum(a.points_earned), 0) from public.member_event_attendance a where a.member_id = m.id),
      events_attended = (select count(*)::int from public.member_event_attendance a where a.member_id = m.id),
      updated_at = now()
  where m.id in (select member_id from public.member_event_attendance where event_id = new.id);
  return new;
end;
$function$;
create trigger sync_attendance_points_on_event_update after update of points on public.events
  for each row execute function public.sync_attendance_points_on_event_update();

-- Supabase grants table privileges to API roles by default; RLS is the boundary.
grant all on all tables in schema public to anon, authenticated;

alter table public.members enable row level security;
alter table public.member_event_attendance enable row level security;
alter table public.events enable row level security;
create policy "Admins manage members" on public.members for all
  using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));
create policy "Admins manage attendance" on public.member_event_attendance for all
  using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));
create policy "Public read events" on public.events for select using (true);

\ir ../../supabase/migrations/20260522010000_add_import_audit_logs.sql
\ir ../../supabase/migrations/20261002040000_admin_activity_log_and_review_marks.sql
grant all on public.import_jobs, public.import_job_rows to anon, authenticated;

-- Supabase grants new tables and functions in public to the API roles by
-- default. Emulate that so the migration's revoke-then-grant is what is tested.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
