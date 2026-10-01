-- Reserve Ask VSA capacity before retrieval/provider work, including concurrent
-- and abandoned calls. Apply manually before deploying vsa-ai-assistant.
begin;

create table public.ai_chat_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  session_id_hash text not null check (session_id_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index ai_chat_quota_session_created_idx
  on public.ai_chat_quota_reservations (session_id_hash, created_at desc);
create index ai_chat_quota_ip_created_idx
  on public.ai_chat_quota_reservations (ip_hash, created_at desc) where ip_hash is not null;
create index ai_chat_quota_created_idx
  on public.ai_chat_quota_reservations (created_at desc);
alter table public.ai_chat_quota_reservations enable row level security;
revoke all on public.ai_chat_quota_reservations from public, anon, authenticated, service_role;
grant select, insert on public.ai_chat_quota_reservations to service_role;
comment on table public.ai_chat_quota_reservations is
  'Hash-only Ask VSA admission ledger; service-role only. Capacity stays consumed '
  'after crashes/timeouts. Completion logs reuse id/created_at; count each admission once.';

create function public.reserve_ai_quota(p_session_id_hash text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz;
  v_session_day bigint;
  v_session_burst bigint;
  v_ip_day bigint;
  v_ip_hour bigint;
  v_global_day bigint;
  v_global_hour bigint;
  v_reason text;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Quota admission requires read committed isolation' using errcode = '25000';
  end if;
  if p_session_id_hash is null or p_session_id_hash !~ '^[0-9a-f]{64}$'
     or (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid quota hashes' using errcode = '22023';
  end if;

  -- Always take locks in the same order; the global lock also protects the
  -- shared provider budget when callers rotate sessions or have no trusted IP.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vsa-ai:global', 0));
  if p_ip_hash is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vsa-ai:ip:' || p_ip_hash, 0));
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vsa-ai:session:' || p_session_id_hash, 0));
  v_now := clock_timestamp();

  with usage as (
    select l.session_id_hash, l.ip_hash, l.created_at
    from public.ai_chat_usage_logs l
    where l.created_at >= v_now - interval '24 hours'
      and (l.session_id_hash = p_session_id_hash or l.ip_hash = p_ip_hash)
    union all
    select r.session_id_hash, r.ip_hash, r.created_at
    from public.ai_chat_quota_reservations r
    where r.created_at >= v_now - interval '24 hours'
      and (r.session_id_hash = p_session_id_hash or r.ip_hash = p_ip_hash)
      and not exists (select 1 from public.ai_chat_usage_logs l where l.id = r.id)
  )
  select count(*) filter (where session_id_hash = p_session_id_hash),
         count(*) filter (where session_id_hash = p_session_id_hash and created_at >= v_now - interval '5 minutes'),
         count(*) filter (where ip_hash = p_ip_hash),
         count(*) filter (where ip_hash = p_ip_hash and created_at >= v_now - interval '1 hour')
    into v_session_day, v_session_burst, v_ip_day, v_ip_hour
  from usage;

  select count(*), count(*) filter (where created_at >= v_now - interval '1 hour')
    into v_global_day, v_global_hour
  from public.ai_chat_quota_reservations
  where created_at >= v_now - interval '24 hours';

  v_reason := case
    when v_session_day >= 5 then 'session_daily_limit'
    when v_session_burst >= 2 then 'session_5_minute_limit'
    when p_ip_hash is not null and v_ip_day >= 50 then 'ip_daily_limit'
    when p_ip_hash is not null and v_ip_hour >= 10 then 'ip_hourly_limit'
    when v_global_day >= 2000 then 'global_daily_limit'
    when v_global_hour >= 200 then 'global_hourly_limit'
    else null end;
  if v_reason is not null then
    return jsonb_build_object('reservation_id', null, 'blocked_reason', v_reason);
  end if;

  insert into public.ai_chat_quota_reservations (session_id_hash, ip_hash, created_at)
    values (p_session_id_hash, p_ip_hash, v_now) returning id into v_id;
  return jsonb_build_object('reservation_id', v_id, 'blocked_reason', null);
end;
$$;
revoke all on function public.reserve_ai_quota(text, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_quota(text, text) to service_role;

create function public.complete_ai_quota(
  p_reservation_id uuid,
  p_status text,
  p_message_length integer,
  p_matched_knowledge_ids uuid[],
  p_blocked_reason text,
  p_current_page text
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_reservation public.ai_chat_quota_reservations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('answered', 'fallback', 'error')
     or p_message_length is null or p_message_length not between 1 and 500
     or coalesce(cardinality(p_matched_knowledge_ids), 0) > 8
     or length(p_current_page) > 120 or length(p_blocked_reason) > 100 then
    raise exception 'Invalid quota completion' using errcode = '22023';
  end if;
  select * into v_reservation from public.ai_chat_quota_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception 'Unknown quota reservation' using errcode = '22023';
  end if;
  -- Keeping the admission timestamp prevents completion from extending quota
  -- windows; reusing the id makes retries and the count union idempotent.
  insert into public.ai_chat_usage_logs (
    id, session_id_hash, ip_hash, message_count, blocked_reason,
    matched_knowledge_ids, created_at, metadata
  ) values (
    v_reservation.id, v_reservation.session_id_hash, v_reservation.ip_hash, 1,
    p_blocked_reason, coalesce(p_matched_knowledge_ids, '{}'::uuid[]),
    v_reservation.created_at, jsonb_build_object(
      'status', p_status, 'message_length', p_message_length, 'current_page', p_current_page
    )
  ) on conflict (id) do nothing;
end;
$$;
revoke all on function public.complete_ai_quota(uuid, text, integer, uuid[], text, text)
  from public, anon, authenticated;
grant execute on function public.complete_ai_quota(uuid, text, integer, uuid[], text, text)
  to service_role;

commit;
