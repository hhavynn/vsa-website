-- Content Health (#287) and Ask VSA knowledge freshness (#239).
--
-- Additive and forward-only. Apply manually after staging verification
-- (see MIGRATION_CHECKLIST.md). No existing policy, grant, or view changes and no
-- row is backfilled or rewritten. The one existing object touched is
-- match_ai_knowledge_base (same signature, owner, and grants; it only gains the
-- "linked event must be published" condition, which no current row triggers
-- because no row has a link yet).
--
-- 1. ai_knowledge_base already records what freshness needs (last_verified_at,
--    freshness, academic_year, valid_until, source_type, category, source_url).
--    The only missing piece is "which public entity does this fact refer to", so
--    two nullable columns are added. The reviewer is NOT stored here: this table
--    is publicly readable (active public rows), so "who reviewed it" goes in the
--    admin-only admin_activity_log as an `ai.knowledge_reviewed` entry instead.
--    Exposure note: anon can read the new columns of active public rows. They hold
--    only a public identifier (an application key such as `house_fall`, or an event
--    id). A public snippet must never describe an unpublished event, so that rule is
--    enforced here in the database, not only in the admin UI: a trigger refuses to
--    save an active public snippet linked to an event that is not published, and
--    the retrieval function below skips such a snippet if its event is unpublished
--    or deleted AFTER it was linked. Nothing is deactivated or rewritten
--    automatically; the admin sees it flagged in Content Health.
--
-- 2. content_health_state is one small admin-only table that the Admin Overview
--    reads in a single request:
--      link_check       result of the weekly external/image link check (written
--                       only by the scheduled job with the service role; admins
--                       can read but never write or forge these)
--      check_run        one row recording when that job last ran, and its counts
--      acknowledgement  an admin accepting a known finding for now; bound to a
--                       `fingerprint` of the condition and expiring, so a changed
--                       or recurring problem is not hidden forever
--    Access boundary: admin only (public.is_admin_user). anon and authenticated
--    have no access except through the policies below.

-- ─── 1. ai_knowledge_base: link a snippet to a public entity ────────────────

alter table public.ai_knowledge_base
  add column if not exists linked_entity_type text,
  add column if not exists linked_entity_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_knowledge_base_linked_entity_check'
  ) then
    alter table public.ai_knowledge_base
      add constraint ai_knowledge_base_linked_entity_check
      check (
        (linked_entity_type is null and linked_entity_key is null)
        or (
          linked_entity_type is not null
          and linked_entity_type in ('application', 'event')
          and linked_entity_key is not null
          and char_length(linked_entity_key) between 1 and 80
        )
      );
  end if;
end $$;

-- A public snippet may only describe a PUBLISHED event. Enforced on every write
-- path (admin UI, REST, SQL editor) because the UI check alone can be bypassed by
-- reactivating an inactive snippet or writing the row directly. Invoker rights:
-- the caller must be able to see the event, which is stricter, never looser.
create or replace function public.guard_ai_knowledge_linked_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A type with no key is rejected by the CHECK constraint with a clearer message.
  if new.linked_entity_type = 'event' and new.linked_entity_key is not null
     and new.is_public is true and new.is_active is true then
    if not exists (
      select 1 from public.events e
      where e.id::text = new.linked_entity_key and e.is_published is true
    ) then
      raise exception 'An active public Ask VSA snippet can only link to a published event'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_ai_knowledge_linked_event() from public, anon, authenticated;

drop trigger if exists guard_ai_knowledge_linked_event on public.ai_knowledge_base;
create trigger guard_ai_knowledge_linked_event
  before insert or update of is_active, is_public, linked_entity_type, linked_entity_key
  on public.ai_knowledge_base
  for each row
  execute function public.guard_ai_knowledge_linked_event();

-- Retrieval: the v2 function from 20260704000000, unchanged except that a snippet
-- linked to an event is served only while that event is published. Same signature
-- and return type, so `create or replace` keeps its owner and grants.
create or replace function public.match_ai_knowledge_base(
  query_text text,
  match_limit integer default 8
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  source_type text,
  source_url text,
  confidence text,
  freshness text,
  academic_year text,
  rank real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.source_type,
    kb.source_url,
    kb.confidence,
    kb.freshness,
    kb.academic_year,
    ts_rank_cd(kb.search_vector, query.tsq) + (kb.priority::real * 0.02) as rank
  from public.ai_knowledge_base kb, query
  where kb.is_public = true
    and kb.is_active = true
    and (kb.valid_until is null or kb.valid_until > now())
    and (
      kb.linked_entity_type is distinct from 'event'
      or exists (
        select 1 from public.events e
        where e.id::text = kb.linked_entity_key and e.is_published is true
      )
    )
    and (
      query.tsq @@ kb.search_vector
      or kb.title ilike '%' || coalesce(query_text, '') || '%'
      or kb.category ilike '%' || coalesce(query_text, '') || '%'
      or exists (
        select 1
        from unnest(kb.aliases) alias
        where coalesce(query_text, '') ilike '%' || alias || '%'
      )
    )
  order by rank desc, kb.priority desc, kb.updated_at desc
  limit greatest(1, least(match_limit, 8));
$$;

-- ─── 2. content_health_state ─────────────────────────────────────────────────

create table if not exists public.content_health_state (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- link_check: the checked URL. acknowledgement: the finding key. check_run: 'weekly'.
  subject_key text not null,

  -- link_check / check_run
  check_status text,
  http_status integer,
  failure_reason text,
  checked_at timestamptz,
  failing_since timestamptz,
  consecutive_failures integer not null default 0,
  -- link_check: [{table,id,field,label,path,kind}] (public names only).
  -- check_run: {checked, failed, skipped}.
  detail jsonb,

  -- acknowledgement
  fingerprint text,
  acknowledged_by uuid default auth.uid() references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),

  constraint content_health_state_kind_check
    check (kind in ('link_check', 'acknowledgement', 'check_run')),
  constraint content_health_state_subject_check
    check (char_length(subject_key) between 1 and 2048),
  constraint content_health_state_unique unique (kind, subject_key),
  constraint content_health_state_check_status_check
    check (check_status is null or check_status in ('ok', 'failed', 'skipped')),
  constraint content_health_state_reason_check
    check (failure_reason is null or char_length(failure_reason) <= 60),
  constraint content_health_state_failures_check
    check (consecutive_failures between 0 and 10000),
  constraint content_health_state_detail_check
    check (detail is null or octet_length(detail::text) <= 20000),
  constraint content_health_state_link_check_shape
    check (kind <> 'link_check' or (check_status is not null and checked_at is not null)),
  constraint content_health_state_run_shape
    check (kind <> 'check_run' or checked_at is not null),
  constraint content_health_state_ack_shape
    check (
      kind <> 'acknowledgement'
      or (
        fingerprint is not null
        and char_length(fingerprint) <= 2200
        and expires_at is not null
        and acknowledged_at is not null
      )
    )
);

-- The Overview and Content Health read "everything that is not simply ok".
create index if not exists content_health_state_kind_status_idx
  on public.content_health_state (kind, check_status);

alter table public.content_health_state enable row level security;

revoke all on public.content_health_state from anon, authenticated;
grant select, insert, delete on public.content_health_state to authenticated;
-- Renewing an acknowledgement may change only these columns, so `acknowledged_by`
-- (who first accepted it) can never be rewritten from the client. kind and
-- subject_key are listed because an upsert names them; the policy below still
-- pins kind to 'acknowledgement'.
grant update (kind, subject_key, fingerprint, acknowledged_at, expires_at) on public.content_health_state to authenticated;
grant select, insert, update, delete on public.content_health_state to service_role;

drop policy if exists "Admins can read content health state" on public.content_health_state;
create policy "Admins can read content health state"
  on public.content_health_state
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- Admins write acknowledgements only, and only as themselves. Link-check and
-- check-run rows come from the scheduled job (service role bypasses RLS), so an
-- admin cannot mark a failing link as healthy.
drop policy if exists "Admins can add acknowledgements" on public.content_health_state;
create policy "Admins can add acknowledgements"
  on public.content_health_state
  for insert
  to authenticated
  with check (
    public.is_admin_user(auth.uid())
    and kind = 'acknowledgement'
    and (acknowledged_by is null or acknowledged_by = auth.uid())
  );

drop policy if exists "Admins can renew acknowledgements" on public.content_health_state;
create policy "Admins can renew acknowledgements"
  on public.content_health_state
  for update
  to authenticated
  using (public.is_admin_user(auth.uid()) and kind = 'acknowledgement')
  with check (public.is_admin_user(auth.uid()) and kind = 'acknowledgement');

drop policy if exists "Admins can remove acknowledgements" on public.content_health_state;
create policy "Admins can remove acknowledgements"
  on public.content_health_state
  for delete
  to authenticated
  using (public.is_admin_user(auth.uid()) and kind = 'acknowledgement');
