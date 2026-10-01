-- Atomic, idempotent publish for Cabinet roster cycles.
--
-- Publishing used to be a client loop: one request per public row, one per
-- draft stamp, and the cycle was marked published only at the very end. A
-- failure partway left a partial Cabinet public (the public Cabinet page lists
-- a year as soon as it has one row), and two admins could both read the same
-- snapshot and insert duplicates. This moves the whole step into one database
-- transaction behind a row lock on the cycle, like publish_ace_assignment_cycle.
--
-- Behavior (mirrors the former client logic and src/lib/cabinetRoster.ts):
--   * admin only (is_admin_user); anon cannot execute it
--   * locks the cycle row, so concurrent publishes serialize and the loser
--     sees "published" and returns already_published with nothing written
--   * published cycle -> no-op; anything but locked -> refuse
--   * hard blockers re-checked here (empty roster, empty position, one member
--     linked twice); a missing photo or unlinked member never blocks
--   * each draft adopts, in order: the row recorded on it, an unclaimed row in
--     the same cabinet year for the same member (or, if unlinked, the same
--     case/space-insensitive name), otherwise a new row; Interns are never
--     touched, existing rows not in the roster are left alone, nothing is
--     deleted
--   * an update only writes optional fields the draft actually has, so a blank
--     draft field never erases a bio or member link already on the public row;
--     image_url / thumbnail_url are never written
--   * never changes cabinet_years.is_active; activation stays its own action
--   * any error rolls back every write, including the draft stamps
--
-- Additive: one function. No table, policy, or existing function changes.

create or replace function public.publish_cabinet_roster_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cabinet_roster_cycles%rowtype;
  v_draft public.cabinet_roster_drafts%rowtype;
  v_total integer;
  v_count integer;
  v_target uuid;
  v_claimed uuid[] := array[]::uuid[];
  v_created integer := 0;
  v_updated integer := 0;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.cabinet_roster_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Cabinet roster not found';
  end if;

  select count(*) into v_total
  from public.cabinet_roster_drafts where cycle_id = p_cycle_id;

  if v_cycle.status = 'published' then
    return jsonb_build_object(
      'cycle_id', p_cycle_id, 'status', 'published',
      'created', 0, 'updated', 0, 'total', v_total, 'already_published', true
    );
  end if;

  if v_cycle.status <> 'locked' then
    raise exception 'Lock the Cabinet roster before publishing (it is %)', v_cycle.status;
  end if;

  if v_total = 0 then
    raise exception 'Nothing to publish: this roster has no positions';
  end if;

  select count(*) into v_count
  from public.cabinet_roster_drafts
  where cycle_id = p_cycle_id and (name is null or btrim(name) = '');
  if v_count > 0 then
    raise exception 'Publish blocked: % position(s) are still empty', v_count;
  end if;

  select count(*) into v_count from (
    select 1
    from public.cabinet_roster_drafts
    where cycle_id = p_cycle_id and member_id is not null
    group by member_id
    having count(*) > 1
  ) dup;
  if v_count > 0 then
    raise exception 'Publish blocked: % member(s) are linked to more than one position', v_count;
  end if;

  select coalesce(array_agg(published_cabinet_member_id), array[]::uuid[]) into v_claimed
  from public.cabinet_roster_drafts
  where cycle_id = p_cycle_id and published_cabinet_member_id is not null;

  for v_draft in
    select * from public.cabinet_roster_drafts
    where cycle_id = p_cycle_id
    order by display_order, created_at, id
  loop
    v_target := null;

    if v_draft.published_cabinet_member_id is not null then
      select cm.id into v_target
      from public.cabinet_members cm
      where cm.id = v_draft.published_cabinet_member_id
        and cm.cabinet_year_id = v_cycle.cabinet_year_id
        and cm.category <> 'Interns';
    end if;

    if v_target is null then
      select cm.id into v_target
      from public.cabinet_members cm
      where cm.cabinet_year_id = v_cycle.cabinet_year_id
        and cm.category <> 'Interns'
        and not (cm.id = any (v_claimed))
        and (
          (v_draft.member_id is not null and cm.member_id = v_draft.member_id)
          or (
            v_draft.member_id is null
            and cm.member_id is null
            and lower(regexp_replace(btrim(cm.name), '\s+', ' ', 'g'))
              = lower(regexp_replace(btrim(v_draft.name), '\s+', ' ', 'g'))
          )
        )
      order by cm.created_at, cm.id
      limit 1;
    end if;

    if v_target is not null then
      update public.cabinet_members
      set name = btrim(v_draft.name),
          role = btrim(v_draft.role),
          category = v_draft.category,
          display_order = v_draft.display_order,
          member_id = coalesce(v_draft.member_id, member_id),
          year = coalesce(v_draft.year, year),
          college = coalesce(v_draft.college, college),
          major = coalesce(v_draft.major, major),
          pronouns = coalesce(v_draft.pronouns, pronouns),
          favorite_snack = coalesce(v_draft.favorite_snack, favorite_snack),
          fun_fact = coalesce(v_draft.fun_fact, fun_fact)
      where id = v_target;
      v_updated := v_updated + 1;
    else
      insert into public.cabinet_members
        (name, role, category, display_order, member_id, year, college, major,
         pronouns, favorite_snack, fun_fact, cabinet_year_id)
      values
        (btrim(v_draft.name), btrim(v_draft.role), v_draft.category, v_draft.display_order,
         v_draft.member_id, v_draft.year, v_draft.college, v_draft.major,
         v_draft.pronouns, v_draft.favorite_snack, v_draft.fun_fact, v_cycle.cabinet_year_id)
      returning id into v_target;
      v_created := v_created + 1;
    end if;

    v_claimed := v_claimed || v_target;

    if v_draft.published_cabinet_member_id is distinct from v_target then
      update public.cabinet_roster_drafts
      set published_cabinet_member_id = v_target
      where id = v_draft.id;
    end if;
  end loop;

  update public.cabinet_roster_cycles set status = 'published' where id = p_cycle_id;

  return jsonb_build_object(
    'cycle_id', p_cycle_id, 'status', 'published',
    'created', v_created, 'updated', v_updated, 'total', v_total, 'already_published', false
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; anon inherits it from there, so
-- the revoke must name PUBLIC.
revoke execute on function public.publish_cabinet_roster_cycle(uuid) from public, anon;
grant execute on function public.publish_cabinet_roster_cycle(uuid) to authenticated;

comment on function public.publish_cabinet_roster_cycle(uuid) is
  'Admin-only. Atomically publishes a locked Cabinet roster into cabinet_members for its year, idempotently, without activating the year.';
