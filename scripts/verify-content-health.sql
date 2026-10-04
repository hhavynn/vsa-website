-- Verifies migration 20261004000000_content_health_state_and_ai_knowledge_entity_link.sql
-- against a LOCAL or STAGING database. Never run it against production.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-content-health.sql
--
-- One transaction, rolled back: no fixture row survives. Prints "PASS: ..." per
-- check and aborts on the first failure.
--
-- Checks: content_health_state is admin-only (anon and non-admin read and write
-- nothing); an admin can record an acknowledgement only as themselves and can
-- never write, forge, or delete a link-check or check-run row; shape and size
-- constraints; the two ai_knowledge_base entity-link columns accept only the
-- documented pairs; and a public snippet can never be saved against, reactivated
-- against, or served for an unpublished event.
--
-- Needs the real ai_knowledge_base (v2 columns), events, and match_ai_knowledge_base.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false),
  ('00000000-0000-0000-0000-0000000000c3', true);

create function pg_temp.try_as(p_sub text, p_role text, p_sql text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    perform set_config('role', 'postgres', true);
    return 'ok';
  exception when others then
    perform set_config('role', 'postgres', true);
    return sqlerrm;
  end;
end $$;

-- Row count of a SELECT as a role (RLS applies).
create function pg_temp.count_as(p_sub text, p_role text, p_table text)
returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  execute format('select count(*) from %s', p_table) into v;
  perform set_config('role', 'postgres', true);
  return v;
end $$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

-- Fixture rows written as the table owner (the scheduled job uses service_role,
-- which bypasses RLS the same way).
insert into public.content_health_state (id, kind, subject_key, check_status, http_status, failure_reason, checked_at, failing_since, consecutive_failures, detail)
values
  ('91000000-0000-0000-0000-000000000001', 'link_check', 'https://cdn.example.org/flyer.png', 'failed', 404, 'http_404', now(), now(), 1,
   '[{"table":"events","id":"e1","field":"image_url","label":"Fall GBM","path":"/admin/events","kind":"image"}]'),
  ('91000000-0000-0000-0000-000000000002', 'check_run', 'weekly', null, null, null, now(), null, 0, '{"checked":10,"failed":1,"skipped":2}');

-- content_health_state: reads ------------------------------------------------
select pg_temp.check_true('anon cannot read content health state',
  pg_temp.try_as('', 'anon', 'select * from public.content_health_state') like 'permission denied%');
select pg_temp.check_true('anon cannot write content health state',
  pg_temp.try_as('', 'anon', $q$insert into public.content_health_state (kind, subject_key, fingerprint, expires_at, acknowledged_at) values ('acknowledgement', 'k', 'f', now(), now())$q$) like 'permission denied%');
select pg_temp.check_true('a non-admin sees no rows',
  pg_temp.count_as('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'public.content_health_state') = 0);
select pg_temp.check_true('an admin sees the link check and the run row',
  pg_temp.count_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'public.content_health_state') = 2);

-- content_health_state: acknowledgements -------------------------------------
select pg_temp.check_true('an admin can acknowledge a finding',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.content_health_state (id, kind, subject_key, fingerprint, expires_at, acknowledged_at)
       values ('91000000-0000-0000-0000-000000000003', 'acknowledgement', 'link-failed:https://cdn.example.org/flyer.png', 'https://cdn.example.org/flyer.png|2026-10-03', now() + interval '60 days', now())$q$) = 'ok');
select pg_temp.check_true('the acknowledger defaults to the signed-in admin',
  (select acknowledged_by from public.content_health_state where id = '91000000-0000-0000-0000-000000000003') = '00000000-0000-0000-0000-0000000000a1');
select pg_temp.check_true('a non-admin cannot acknowledge',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.content_health_state (kind, subject_key, fingerprint, expires_at, acknowledged_at) values ('acknowledgement', 'k2', 'f', now() + interval '1 day', now())$q$) like '%row-level security%');
select pg_temp.check_true('an admin cannot acknowledge as someone else',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.content_health_state (kind, subject_key, fingerprint, expires_at, acknowledged_at, acknowledged_by)
       values ('acknowledgement', 'k3', 'f', now() + interval '1 day', now(), '00000000-0000-0000-0000-0000000000b2')$q$) like '%row-level security%');
select pg_temp.check_true('an admin can renew an acknowledgement',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.content_health_state set expires_at = now() + interval '90 days' where id = '91000000-0000-0000-0000-000000000003'$q$) = 'ok');
select pg_temp.check_true('a second admin can renew it (an upsert names kind and subject_key too)',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000c3', 'authenticated',
    $q$update public.content_health_state set kind = 'acknowledgement', subject_key = subject_key, fingerprint = fingerprint, acknowledged_at = now(), expires_at = now() + interval '30 days'
       where id = '91000000-0000-0000-0000-000000000003'$q$) = 'ok');
select pg_temp.check_true('who first acknowledged it cannot be rewritten',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000c3', 'authenticated',
    $q$update public.content_health_state set acknowledged_by = '00000000-0000-0000-0000-0000000000c3' where id = '91000000-0000-0000-0000-000000000003'$q$) like 'permission denied%');
select pg_temp.check_true('an admin can remove an acknowledgement',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.content_health_state where id = '91000000-0000-0000-0000-000000000003'$q$) = 'ok');
select pg_temp.check_true('the acknowledgement is gone',
  (select count(*) from public.content_health_state where id = '91000000-0000-0000-0000-000000000003') = 0);

-- content_health_state: an admin can never forge a result --------------------
select pg_temp.check_true('an admin cannot insert a link-check result',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.content_health_state (kind, subject_key, check_status, checked_at) values ('link_check', 'https://x.test', 'ok', now())$q$) like '%row-level security%');
select pg_temp.check_true('an admin cannot insert a check-run row',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.content_health_state (kind, subject_key, checked_at) values ('check_run', 'forged', now())$q$) like '%row-level security%');
-- RLS hides the row from UPDATE/DELETE rather than raising, so assert the row is untouched.
select pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
  $q$update public.content_health_state set check_status = 'ok' where id = '91000000-0000-0000-0000-000000000001'$q$);
select pg_temp.check_true('an admin cannot mark a failing link healthy',
  (select check_status from public.content_health_state where id = '91000000-0000-0000-0000-000000000001') = 'failed');
select pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
  $q$delete from public.content_health_state where id = '91000000-0000-0000-0000-000000000001'$q$);
select pg_temp.check_true('an admin cannot delete a link-check result',
  (select count(*) from public.content_health_state where id = '91000000-0000-0000-0000-000000000001') = 1);
select pg_temp.check_true('an admin can add another acknowledgement to try to turn into a link check',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.content_health_state (id, kind, subject_key, fingerprint, expires_at, acknowledged_at)
       values ('91000000-0000-0000-0000-000000000004', 'acknowledgement', 'k4', 'f', now() + interval '1 day', now())$q$) = 'ok');
select pg_temp.check_true('an admin cannot turn an acknowledgement into a link check',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.content_health_state set kind = 'link_check' where id = '91000000-0000-0000-0000-000000000004'$q$) like '%row-level security%');
select pg_temp.check_true('an admin cannot write link-check columns on any row',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.content_health_state set check_status = 'ok', checked_at = now() where id = '91000000-0000-0000-0000-000000000004'$q$) like 'permission denied%');

-- content_health_state: shape and size ---------------------------------------
select pg_temp.check_true('an unknown kind is rejected',
  pg_temp.try_as('', 'postgres', $q$insert into public.content_health_state (kind, subject_key) values ('anything', 'k')$q$) like '%content_health_state_kind_check%');
select pg_temp.check_true('a link check needs a status and a time',
  pg_temp.try_as('', 'postgres', $q$insert into public.content_health_state (kind, subject_key) values ('link_check', 'https://y.test')$q$) like '%content_health_state_link_check_shape%');
select pg_temp.check_true('an acknowledgement must expire',
  pg_temp.try_as('', 'postgres', $q$insert into public.content_health_state (kind, subject_key, fingerprint, acknowledged_at) values ('acknowledgement', 'k5', 'f', now())$q$) like '%content_health_state_ack_shape%');
select pg_temp.check_true('one row per (kind, key)',
  pg_temp.try_as('', 'postgres', $q$insert into public.content_health_state (kind, subject_key, check_status, checked_at) values ('link_check', 'https://cdn.example.org/flyer.png', 'ok', now())$q$) like '%content_health_state_unique%');
select pg_temp.check_true('an oversized detail blob is rejected',
  pg_temp.try_as('', 'postgres', $q$insert into public.content_health_state (kind, subject_key, check_status, checked_at, detail) values ('link_check', 'https://big.test', 'ok', now(), to_jsonb(repeat('x', 30000)))$q$) like '%content_health_state_detail_check%');

-- ai_knowledge_base: entity link ---------------------------------------------
select pg_temp.check_true('a snippet can link to an application window',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'application', linked_entity_key = 'house_fall'$q$) = 'ok');
select pg_temp.check_true('a type without a key is rejected',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'event', linked_entity_key = null$q$) like '%ai_knowledge_base_linked_entity_check%');
select pg_temp.check_true('a key without a type is rejected',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = null, linked_entity_key = 'house_fall'$q$) like '%ai_knowledge_base_linked_entity_check%');
select pg_temp.check_true('only application and event links are allowed',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'member', linked_entity_key = 'x'$q$) like '%ai_knowledge_base_linked_entity_check%');

-- ai_knowledge_base: a public snippet never describes an unpublished event ------
insert into public.events (id, name, date, is_published) values
  ('92000000-0000-0000-0000-000000000001', 'Verify published event', now() + interval '10 days', true),
  ('92000000-0000-0000-0000-000000000002', 'Verify draft event', now() + interval '10 days', false);
update public.ai_knowledge_base set linked_entity_type = null, linked_entity_key = null;

select pg_temp.check_true('an active public snippet can link to a published event',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'event', linked_entity_key = '92000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('an active public snippet cannot link to an unpublished event',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'event', linked_entity_key = '92000000-0000-0000-0000-000000000002'$q$) like '%can only link to a published event%');
select pg_temp.check_true('nor to an event that does not exist',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set linked_entity_type = 'event', linked_entity_key = '92000000-0000-0000-0000-0000000000ff'$q$) like '%can only link to a published event%');
select pg_temp.check_true('an inactive snippet may be saved against a draft event',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set is_active = false, linked_entity_type = 'event', linked_entity_key = '92000000-0000-0000-0000-000000000002'$q$) = 'ok');
select pg_temp.check_true('but it cannot then be reactivated while the event is a draft',
  pg_temp.try_as('', 'postgres', $q$update public.ai_knowledge_base set is_active = true$q$) like '%can only link to a published event%');

-- Retrieval skips a snippet whose linked event is not (or no longer) published.
update public.ai_knowledge_base set is_active = true, linked_entity_type = 'event', linked_entity_key = '92000000-0000-0000-0000-000000000001', title = 'verifyretrieval gala', content = 'verifyretrieval gala details', valid_until = null;
select pg_temp.check_true('retrieval serves a snippet linked to a published event',
  (select count(*) from public.match_ai_knowledge_base('verifyretrieval', 8)) = 1);
update public.events set is_published = false where id = '92000000-0000-0000-0000-000000000001';
select pg_temp.check_true('retrieval stops serving it once the event is unpublished (no automatic edit to the snippet)',
  (select count(*) from public.match_ai_knowledge_base('verifyretrieval', 8)) = 0
  and (select is_active from public.ai_knowledge_base where title = 'verifyretrieval gala') is true);
delete from public.events where id = '92000000-0000-0000-0000-000000000001';
select pg_temp.check_true('or deleted',
  (select count(*) from public.match_ai_knowledge_base('verifyretrieval', 8)) = 0);
update public.ai_knowledge_base set linked_entity_type = null, linked_entity_key = null where title = 'verifyretrieval gala';
select pg_temp.check_true('an unlinked snippet is unaffected',
  (select count(*) from public.match_ai_knowledge_base('verifyretrieval', 8)) = 1);

rollback;
