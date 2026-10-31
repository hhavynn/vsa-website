-- Applied to production 2026-10-31 (schema_migrations version 20261031164611).
-- #802 / #641: the House badge RPC must use the SAME exact-batch Reveal
-- allowlist as public_house_memberships, not a year-wide published status.
--
-- WHY: partial rows of a subsequent locked Winter batch already exist before
-- it is published; if a Fall batch in the same year is published, the old
-- function could reveal Winter identities prematurely through guessed IDs.
--
-- The existing score-free owner-rights view is the sole data source. Its
-- published_at check is per source_import_id, survives batch archival, and
-- handles the active-term year for historical hand-added/legacy rows. No
-- points, attendance, member contact details, private notes or raw rosters.
--
-- FREEZE: approval required for merge and manual migration apply while House
-- Reveal is frozen. Staging anon negative cases must pass before production.
-- No trigger, table, view, policy, House membership or score mutation here.

do $$
begin
  if to_regclass('public.public_house_memberships') is null
     or to_regprocedure('public.public_member_house_badge(uuid,integer)') is null then
    raise exception 'Apply both the published House membership view and the existing badge RPC first.';
  end if;
end $$;

create or replace function public.public_member_house_badge(
  p_member_id uuid,
  p_year integer default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_year integer;
  v_result jsonb;
begin
  if p_member_id is null or
     (p_year is not null and (p_year < 2000 or p_year > 2100)) then
    return null;
  end if;

  select max(m.academic_year_start) into v_year
  from public.public_house_memberships m
  where m.member_id = p_member_id
    and (p_year is null or m.academic_year_start = p_year);
  if v_year is null then return null; end if;

  select jsonb_build_object(
    'house', m.house_key,
    'house_profile_id', m.house_profile_id,
    'display_name', m.display_name,
    'accent_color', m.accent_color,
    'academic_year_start', m.academic_year_start,
    'latest_activity_at', null
  ) into v_result
  from public.public_house_memberships m
  where m.member_id = p_member_id
    and m.academic_year_start = v_year
    and (
      (m.effective_start_date <= v_today
        and (m.effective_end_date is null or m.effective_end_date > v_today))
      or (v_today >= make_date(v_year + 1, 7, 1)
        and m.effective_start_date <= v_today)
      or (v_today < make_date(v_year + 1, 7, 1)
        and m.effective_start_date > v_today)
    )
  order by
    case
      when m.effective_start_date <= v_today
        and (m.effective_end_date is null or m.effective_end_date > v_today)
      then 0 else 1
    end,
    case when m.effective_start_date <= v_today
      then m.effective_start_date end desc nulls last,
    m.effective_start_date asc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.public_member_house_badge(uuid,integer) from public, anon, authenticated;
grant execute on function public.public_member_house_badge(uuid,integer) to anon, authenticated;

comment on function public.public_member_house_badge(uuid,integer) is
  'Score-free House badge, strictly gated by the same exact-batch Reveal rules as public_house_memberships (no partially written unrevealed batch rows).';
