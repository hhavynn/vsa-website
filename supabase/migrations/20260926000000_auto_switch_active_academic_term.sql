-- Automatically advance the active academic term when a new term starts.
--
-- academic_terms.is_active was only ever flipped by hand in /admin/years, so
-- the site kept treating the previous quarter as current until an admin
-- remembered to switch it. This adds a daily job that activates the most
-- recent term whose starts_on has passed (America/Los_Angeles date).
--
-- Behavior:
--   - Forward-only: it acts only when a term that started AFTER the currently
--     active term has begun. Breaks between quarters keep the previous term
--     active, and a manual switch to a newer term is left alone.
--   - Terms without starts_on are ignored, and nothing changes when no newer
--     term exists yet (e.g. next year's terms not added), so it cannot leave
--     the site with no active term.
--
-- Access boundary: SECURITY INVOKER, executable only by the cron job's owner
-- (postgres). Execution is revoked from PUBLIC, anon, and authenticated, so it
-- is not reachable through the REST RPC endpoint.

begin;

create extension if not exists pg_cron;

create or replace function public.sync_active_academic_term(
  p_today date default (pg_catalog.now() at time zone 'America/Los_Angeles')::date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target_id uuid;
  v_target_starts date;
  v_active_starts date;
begin
  select t.id, t.starts_on
    into v_target_id, v_target_starts
  from public.academic_terms t
  where t.starts_on is not null
    and t.starts_on <= p_today
  order by t.starts_on desc
  limit 1;

  if v_target_id is null then
    return;
  end if;

  select t.starts_on
    into v_active_starts
  from public.academic_terms t
  where t.is_active
  limit 1;

  if v_active_starts is not null and v_active_starts >= v_target_starts then
    return;
  end if;

  -- Deactivate first: a unique partial index allows only one active term.
  update public.academic_terms
     set is_active = false, updated_at = pg_catalog.now()
   where is_active and id <> v_target_id;

  update public.academic_terms
     set is_active = true, updated_at = pg_catalog.now()
   where id = v_target_id;
end;
$$;

revoke execute on function public.sync_active_academic_term(date) from public, anon, authenticated;

-- 08:15 UTC is just after midnight in Los Angeles in both PDT and PST.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-active-academic-term';
select cron.schedule(
  'sync-active-academic-term',
  '15 8 * * *',
  $cron$select public.sync_active_academic_term();$cron$
);

commit;
