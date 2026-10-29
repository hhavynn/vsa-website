-- #240: a count-only administrator report for Ask VSA usage.
-- No raw logs, identifiers, retrieved knowledge IDs, message text or IP hashes
-- reach an authenticated client. Apply manually after staging RLS/role QA.
--
-- Applied to production 2026-10-28 (schema_migrations version 20261029015612);
-- applied without this file's begin;/commit; lines, since apply_migration is transactional
begin;

create function public.admin_ai_usage_daily(p_days integer default 30)
returns table (
  day date,
  answered bigint,
  fallback bigint,
  rate_limited bigint,
  errors bigint,
  other bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'authenticated'
     or auth.uid() is null
     or not public.is_admin_user(auth.uid()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'Invalid report period' using errcode = '22023';
  end if;

  return query
    select
      (l.created_at at time zone 'America/Los_Angeles')::date as day,
      count(*) filter (where l.metadata->>'status' = 'answered') as answered,
      count(*) filter (where l.metadata->>'status' = 'fallback') as fallback,
      count(*) filter (where l.metadata->>'status' = 'rate_limited') as rate_limited,
      count(*) filter (where l.metadata->>'status' = 'error') as errors,
      count(*) filter (where coalesce(l.metadata->>'status', '') not in
        ('answered', 'fallback', 'rate_limited', 'error')) as other
    from public.ai_chat_usage_logs l
    -- Keep created_at bare so a timestamp index remains usable. Bound the
    -- local calendar range as timestamptz so midnight/DST is unambiguous.
    where l.created_at >= (
      ((pg_catalog.now() at time zone 'America/Los_Angeles')::date - (p_days - 1))
      ::timestamp at time zone 'America/Los_Angeles'
    )
      and l.created_at < (
        ((pg_catalog.now() at time zone 'America/Los_Angeles')::date + 1)
        ::timestamp at time zone 'America/Los_Angeles'
      )
    group by 1
    order by 1 desc;
end;
$$;

-- This DEFINER function bypasses RLS internally, so both an in-body admin
-- check and the PUBLIC revoke are required. No table grants are changed.
revoke all on function public.admin_ai_usage_daily(integer) from public, anon, authenticated;
grant execute on function public.admin_ai_usage_daily(integer) to authenticated;
comment on function public.admin_ai_usage_daily(integer) is
  'Admin-only daily counts for Ask VSA; no per-session, per-IP, messages or tokens.';

commit;
