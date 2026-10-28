-- Manual apply only after review. Admission state contains no request payloads,
-- raw IPs, credentials or member data. Counters are reused rather than appended.
-- SECURITY DEFINER is necessary to update counters without exposing their table
-- to browser roles; the function also verifies the service-role claim internally.
begin;
create table if not exists public.privileged_edge_quotas (
  scope text not null check (scope in ('image-migration', 'analytics')),
  caller_hash text not null check (caller_hash = 'global' or caller_hash ~ '^[a-f0-9]{64}$'),
  minute_started timestamptz not null,
  minute_count integer not null default 0 check (minute_count >= 0),
  day_started timestamptz not null,
  day_count integer not null default 0 check (day_count >= 0),
  primary key (scope, caller_hash)
);
alter table public.privileged_edge_quotas enable row level security;
revoke all on public.privileged_edge_quotas from public, anon, authenticated;
grant select, insert, update on public.privileged_edge_quotas to service_role;

create or replace function public.reserve_privileged_edge_quota(
  p_scope text, p_caller_hash text, p_caller_per_minute integer, p_global_per_day integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz;
  v_minute timestamptz;
  v_day timestamptz;
  v_global integer;
  v_caller integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('image-migration', 'analytics')
    or p_caller_hash is null or p_caller_hash !~ '^[a-f0-9]{64}$'
    or p_caller_per_minute is null or p_caller_per_minute not between 1 and 120
    or p_global_per_day is null or p_global_per_day not between 1 and 10000 then
    raise exception 'Invalid quota request' using errcode = '22023';
  end if;
  -- One scope lock covers global and caller accounting across all Edge isolates.
  -- Every denied request leaves both counters unchanged.
  perform pg_catalog.pg_advisory_xact_lock(732614, case p_scope when 'image-migration' then 1 else 2 end);
  v_now := pg_catalog.clock_timestamp();
  v_minute := pg_catalog.date_trunc('minute', v_now, 'UTC');
  v_day := pg_catalog.date_trunc('day', v_now, 'UTC');
  select case when day_started = v_day then day_count else 0 end into v_global
    from public.privileged_edge_quotas where scope = p_scope and caller_hash = 'global';
  select case when minute_started = v_minute then minute_count else 0 end into v_caller
    from public.privileged_edge_quotas where scope = p_scope and caller_hash = p_caller_hash;
  if coalesce(v_global, 0) >= p_global_per_day or coalesce(v_caller, 0) >= p_caller_per_minute then
    return false;
  end if;
  insert into public.privileged_edge_quotas as q (scope, caller_hash, minute_started, minute_count, day_started, day_count)
    values (p_scope, 'global', v_minute, 1, v_day, 1), (p_scope, p_caller_hash, v_minute, 1, v_day, 1)
    on conflict (scope, caller_hash) do update set
      minute_count = case when q.minute_started = v_minute then q.minute_count + 1 else 1 end,
      minute_started = v_minute,
      day_count = case when q.day_started = v_day then q.day_count + 1 else 1 end,
      day_started = v_day;
  return true;
end;
$$;
revoke all on function public.reserve_privileged_edge_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_privileged_edge_quota(text, text, integer, integer) to service_role;
commit;
