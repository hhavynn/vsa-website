-- Allow anonymous event-interest responses to be cleared or switched.
-- Counts remain an identity-free public estimate: the caller's prior choice
-- is kept in localStorage and cannot be verified by the server.

begin;

create or replace function public.record_event_interest(p_event_id uuid, p_signal text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interested_delta integer := 0;
  v_going_delta integer := 0;
begin
  if p_signal is null or p_signal not in (
    'interested',
    'going',
    'clear_interested',
    'clear_going',
    'switch_to_interested',
    'switch_to_going'
  ) then
    raise exception 'Invalid event interest action.';
  end if;

  if not exists (
    select 1
    from public.events
    where id = p_event_id
      and is_published = true
  ) then
    raise exception 'Event not found or not published.';
  end if;

  case p_signal
    when 'interested' then v_interested_delta := 1;
    when 'going' then v_going_delta := 1;
    when 'clear_interested' then v_interested_delta := -1;
    when 'clear_going' then v_going_delta := -1;
    when 'switch_to_interested' then
      v_interested_delta := 1;
      v_going_delta := -1;
    when 'switch_to_going' then
      v_interested_delta := -1;
      v_going_delta := 1;
  end case;

  insert into public.event_interest_counts (
    event_id,
    interested_count,
    going_count,
    updated_at
  )
  values (
    p_event_id,
    greatest(0, v_interested_delta),
    greatest(0, v_going_delta),
    pg_catalog.now()
  )
  on conflict (event_id)
  do update set
    interested_count = greatest(0, public.event_interest_counts.interested_count + v_interested_delta),
    going_count = greatest(0, public.event_interest_counts.going_count + v_going_delta),
    updated_at = pg_catalog.now();
end;
$$;

revoke execute on function public.record_event_interest(uuid, text) from public, anon, authenticated;
grant execute on function public.record_event_interest(uuid, text) to anon, authenticated;

commit;
