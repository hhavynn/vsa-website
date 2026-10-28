-- Atomic House event saves (#631).
--
-- WHY
--   Admin -> Houses -> House Events saved an event in separate browser
--   requests: insert/update the event, then delete every host link and insert
--   the new set. A failure in between left an event with no Houses, or an
--   update that silently dropped its hosts. New events also defaulted to
--   published, and nothing on the server checked that a host House belongs to
--   the event's academic year.
--
-- WHAT
--   public.admin_save_house_event(p_event_id, p_event, p_host_ids,
--   p_request_id, p_expected_updated_at) creates or updates one event and its
--   host links in ONE transaction: everything changes or nothing does.
--     - Allowlisted fields only; academic_year_end is derived.
--     - Hosts: at least one, no repeats, each an existing House profile of the
--       event's academic year, and the primary host (house_profile_id) among
--       them.
--     - Create is idempotent by p_request_id (stored in client_request_id):
--       a retry after a lost response returns the same event.
--     - Update refuses when the event changed since the editor loaded it
--       (p_expected_updated_at), so two admins cannot overwrite each other.
--     - A field missing from p_event is left unchanged (an edit that did not
--       touch the image keeps it).
--   house_events.is_published now defaults to false: a new event is a draft
--   unless an admin publishes it. Existing rows are untouched.
--   A trigger on house_event_houses enforces the same-year rule for every
--   writer, not only this function.
--
-- SECURITY
--   SECURITY INVOKER: it runs as the calling admin, so the existing admin-only
--   write policies on house_events / house_event_houses still apply, and it
--   checks is_admin_user itself. EXECUTE is revoked from PUBLIC and anon.
--   Public reads are unchanged (published events only).
--
-- DEPLOY
--   Additive. Apply before the frontend that calls it; until then the editor
--   keeps its previous behavior. Verify: bash scripts/test-house-event-save.sh

alter table public.house_events alter column is_published set default false;

alter table public.house_events add column if not exists client_request_id uuid;
create unique index if not exists house_events_client_request_id_key
  on public.house_events (client_request_id) where client_request_id is not null;

create or replace function public.guard_house_event_host_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.house_events e
    join public.house_page_assets hp on hp.id = new.house_page_asset_id
    where e.id = new.house_event_id
      and hp.academic_year_start = e.academic_year_start
  ) then
    raise exception 'A host House must belong to the event''s academic year.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_house_event_host_year on public.house_event_houses;
create trigger guard_house_event_host_year
  before insert or update on public.house_event_houses
  for each row
  execute function public.guard_house_event_host_year();

revoke execute on function public.guard_house_event_host_year() from public, anon, authenticated;

create or replace function public.admin_save_house_event(
  p_event_id uuid,
  p_event jsonb,
  p_host_ids uuid[],
  p_request_id uuid,
  p_expected_updated_at timestamptz default null
)
returns public.house_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.house_events%rowtype;
  v_year integer;
  v_primary uuid;
  v_hosts uuid[];
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can save House events.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_event) is distinct from 'object' then
    raise exception 'Send the event fields as an object.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_event) k
    where k not in ('house_profile_id', 'academic_year_start', 'title', 'slug', 'description', 'event_date',
      'start_time', 'end_time', 'location', 'image_url', 'image_thumbnail_url', 'gallery_url', 'recap_url',
      'rsvp_url', 'google_calendar_enabled', 'is_published')
  ) then
    raise exception 'Unknown House event field.' using errcode = '22023';
  end if;

  if p_event_id is not null then
    select * into v_row from public.house_events where id = p_event_id for update;
    if not found then
      raise exception 'House event not found.' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is not null and v_row.updated_at <> p_expected_updated_at then
      raise exception 'Someone else changed this event after you opened it. Reload it and try again; nothing was changed.' using errcode = '40001';
    end if;
  elsif p_request_id is not null then
    select * into v_row from public.house_events where client_request_id = p_request_id;
    if found then
      return v_row;
    end if;
  else
    raise exception 'A new event needs a request id so a retry cannot create it twice.' using errcode = '22023';
  end if;

  v_year := coalesce((p_event->>'academic_year_start')::integer, v_row.academic_year_start);
  v_primary := coalesce(nullif(p_event->>'house_profile_id', '')::uuid, v_row.house_profile_id);
  v_hosts := array(select distinct unnest(coalesce(p_host_ids, '{}'::uuid[])));
  if v_year is null or v_primary is null then
    raise exception 'Choose the academic year and the primary host House.' using errcode = '22023';
  end if;
  if cardinality(v_hosts) = 0 then
    raise exception 'Choose at least one host House.' using errcode = '23514';
  end if;
  if cardinality(v_hosts) <> cardinality(coalesce(p_host_ids, '{}'::uuid[])) then
    raise exception 'The same House is listed twice as a host.' using errcode = '22023';
  end if;
  if not (v_primary = any(v_hosts)) then
    raise exception 'The primary host House must be one of the host Houses.' using errcode = '23514';
  end if;
  if (select count(*) from public.house_page_assets hp where hp.id = any(v_hosts) and hp.academic_year_start = v_year) <> cardinality(v_hosts) then
    raise exception 'Every host House must exist and belong to the %-% academic year.', v_year, v_year + 1 using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_event->>'title', v_row.title, '')), '') is null then
    raise exception 'Give the event a title.' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.house_events (
      house_profile_id, academic_year_start, academic_year_end, title, slug, description, event_date,
      start_time, end_time, location, image_url, image_thumbnail_url, gallery_url, recap_url, rsvp_url,
      google_calendar_enabled, is_published, client_request_id
    ) values (
      v_primary, v_year, v_year + 1, btrim(p_event->>'title'), p_event->>'slug', p_event->>'description',
      (p_event->>'event_date')::date, (p_event->>'start_time')::time, (p_event->>'end_time')::time,
      p_event->>'location', p_event->>'image_url', p_event->>'image_thumbnail_url', p_event->>'gallery_url',
      p_event->>'recap_url', p_event->>'rsvp_url',
      coalesce((p_event->>'google_calendar_enabled')::boolean, true),
      coalesce((p_event->>'is_published')::boolean, false),
      p_request_id
    ) returning * into v_row;
  else
    update public.house_events set
      house_profile_id = v_primary,
      academic_year_start = v_year,
      academic_year_end = v_year + 1,
      title = case when p_event ? 'title' then btrim(p_event->>'title') else title end,
      slug = case when p_event ? 'slug' then p_event->>'slug' else slug end,
      description = case when p_event ? 'description' then p_event->>'description' else description end,
      event_date = case when p_event ? 'event_date' then (p_event->>'event_date')::date else event_date end,
      start_time = case when p_event ? 'start_time' then (p_event->>'start_time')::time else start_time end,
      end_time = case when p_event ? 'end_time' then (p_event->>'end_time')::time else end_time end,
      location = case when p_event ? 'location' then p_event->>'location' else location end,
      image_url = case when p_event ? 'image_url' then p_event->>'image_url' else image_url end,
      image_thumbnail_url = case when p_event ? 'image_thumbnail_url' then p_event->>'image_thumbnail_url' else image_thumbnail_url end,
      gallery_url = case when p_event ? 'gallery_url' then p_event->>'gallery_url' else gallery_url end,
      recap_url = case when p_event ? 'recap_url' then p_event->>'recap_url' else recap_url end,
      rsvp_url = case when p_event ? 'rsvp_url' then p_event->>'rsvp_url' else rsvp_url end,
      google_calendar_enabled = case when p_event ? 'google_calendar_enabled' then (p_event->>'google_calendar_enabled')::boolean else google_calendar_enabled end,
      is_published = case when p_event ? 'is_published' then (p_event->>'is_published')::boolean else is_published end
    where id = p_event_id
    returning * into v_row;
    delete from public.house_event_houses
    where house_event_id = p_event_id and not (house_page_asset_id = any(v_hosts));
  end if;

  insert into public.house_event_houses (house_event_id, house_page_asset_id)
  select v_row.id, host from unnest(v_hosts) host
  on conflict do nothing;

  return v_row;
end;
$$;

revoke execute on function public.admin_save_house_event(uuid, jsonb, uuid[], uuid, timestamptz) from public, anon;
grant execute on function public.admin_save_house_event(uuid, jsonb, uuid[], uuid, timestamptz) to authenticated;
