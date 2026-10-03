do $$
declare tbl record; after_rows jsonb;
begin
  for tbl in select * from retirement_test.before_data loop
    perform retirement_test.assert(to_regclass(tbl.relation_name) is not null,
      'Retained relation missing: ' || tbl.relation_name);
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %s t',
      tbl.relation_name) into after_rows;
    perform retirement_test.assert(after_rows = tbl.rows,
      'Migration changed retained rows: ' || tbl.relation_name);
  end loop;

  perform retirement_test.assert(not exists (
    select b.* from retirement_test.before_columns b
    except select a.attrelid, a.attnum, a.attname, a.atttypid, a.attnotnull, a.attisdropped
      from pg_attribute a
  ), 'Migration changed retained column structure');
  perform retirement_test.assert(not exists (
    select 1 from retirement_test.before_constraints b
    left join pg_constraint c on c.oid = b.oid
    where c.oid is null or pg_get_constraintdef(c.oid) <> b.definition
  ), 'Migration changed a constraint or identity foreign key');
  perform retirement_test.assert(not exists (
    select 1 from retirement_test.before_functions b
    left join pg_proc p on p.oid = b.oid
    where p.oid is null or pg_get_functiondef(p.oid) <> b.definition
  ), 'Migration removed or rewrote a retained function');
  perform retirement_test.assert(not exists (
    select 1 from retirement_test.before_triggers b
    left join pg_trigger t on t.oid = b.oid
    where t.oid is null or pg_get_triggerdef(t.oid) <> b.definition
  ), 'Migration removed or changed an active profile/roster/event-points trigger');
  perform retirement_test.assert(not exists (
    select 1 from retirement_test.before_functions b join pg_proc p on p.oid = b.oid
    where p.proname not in (
      'check_in_to_event', 'generate_check_in_code', 'set_event_check_in_code',
      'create_event_check_in_secret', 'handle_new_user_points', 'get_user_points',
      'update_user_points', 'handle_check_in'
    ) and p.proacl is distinct from b.proacl
  ), 'Migration changed an unrelated function privilege');
end;
$$;
\echo 'PASS: all retained fixture rows, columns, identity FKs, function bodies, and active triggers unchanged after two applies.'

do $$
declare archive record; client text; column_row record; fn record;
begin
  for archive in select c.oid, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'event_attendance', 'user_points', 'event_check_in_secrets',
      'check_in_codes', 'check_in_code_usage', 'check_ins'
    )
  loop
    foreach client in array array['anon', 'authenticated'] loop
      perform retirement_test.assert(not has_table_privilege(client, archive.oid,
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
        client || ' retained a table privilege on ' || archive.relname);
      for column_row in select a.attnum, a.attname from pg_attribute a
        where a.attrelid = archive.oid and a.attnum > 0 and not a.attisdropped
      loop
        perform retirement_test.assert(not has_column_privilege(client, archive.oid, column_row.attnum,
          'SELECT, INSERT, UPDATE, REFERENCES'),
          client || ' retained a column privilege on ' || archive.relname || '.' || column_row.attname);
      end loop;
    end loop;
    perform retirement_test.assert(has_table_privilege('service_role', archive.oid,
      'SELECT') and has_table_privilege('service_role', archive.oid, 'UPDATE'),
      'service_role lost controlled archive access on ' || archive.relname);
  end loop;

  perform retirement_test.assert(not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) acl
    where n.nspname = 'public' and c.relname in (
      'event_attendance', 'user_points', 'event_check_in_secrets',
      'check_in_codes', 'check_in_code_usage', 'check_ins'
    ) and acl.grantee = 0
  ), 'PUBLIC retained a table ACL');
  perform retirement_test.assert(not exists (
    select 1 from pg_attribute a join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) acl
    where n.nspname = 'public' and c.relname in (
      'event_attendance', 'user_points', 'event_check_in_secrets',
      'check_in_codes', 'check_in_code_usage', 'check_ins'
    ) and acl.grantee = 0
  ), 'PUBLIC retained a column ACL');

  for fn in select p.oid, p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'check_in_to_event', 'generate_check_in_code', 'set_event_check_in_code',
      'create_event_check_in_secret', 'handle_new_user_points', 'get_user_points',
      'update_user_points', 'handle_check_in'
    )
  loop
    foreach client in array array['anon', 'authenticated', 'service_role'] loop
      perform retirement_test.assert(not has_function_privilege(client, fn.oid, 'EXECUTE'),
        client || ' retained execution on ' || fn.signature);
    end loop;
  end loop;
  perform retirement_test.assert(not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal and p.proname in (
      'create_event_check_in_secret', 'set_event_check_in_code', 'handle_new_user_points'
    )
  ), 'A renamed automatic code/bootstrap trigger survived');
end;
$$;
\echo 'PASS: PUBLIC/anon/authenticated table and column ACLs closed; all legacy overloads denied to every API role; operator/service archive access retained.'

-- Permission errors must occur even for a logged-in admin. A SECURITY DEFINER
-- privacy routine must still read the archive under its retained admin guard.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare preview jsonb;
begin
  begin
    perform user_id from public.user_points;
    raise exception 'Admin direct archive SELECT unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_attendance (event_id, user_id, points_earned, check_in_type)
      values ('00000000-0000-0000-0000-000000000003', auth.uid(), 100, 'code');
    raise exception 'Admin direct archive INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_points set total_points = 100 where user_id = auth.uid();
    raise exception 'Admin direct archive UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.check_ins where user_id = auth.uid();
    raise exception 'Admin direct archive DELETE unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.check_in_to_event('SYNTHETIC-ARCHIVE');
    raise exception 'Retired check-in RPC unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.check_in_to_event('00000000-0000-0000-0000-000000000003'::uuid, 'SYNTHETIC-ARCHIVE');
    raise exception 'Retired overloaded check-in RPC unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  perform retirement_test.assert(public.is_admin_user(), 'Retained admin helper no longer works');
  preview := public.get_data_rights_dependency_preview('00000000-0000-0000-0000-000000000006');
  perform retirement_test.assert(preview #>> '{counts,auth_attendance_rows}' = '1',
    'Admin privacy preview lost legacy attendance');
  perform retirement_test.assert(preview #>> '{counts,user_points_rows}' = '1',
    'Admin privacy preview lost legacy points');
  perform retirement_test.assert(preview #>> '{counts,member_attendance_rows}' = '1'
    and preview #>> '{counts,house_membership_rows}' = '1'
    and preview #>> '{counts,import_raw_rows}' = '1', 'Roster/House/import privacy dependencies changed');
end;
$$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.get_data_rights_dependency_preview('00000000-0000-0000-0000-000000000006');
    raise exception 'Non-admin privacy preview unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
\echo 'PASS: real admin-only data-rights SQL reads retained archive; non-admin denied; direct client archive mutations and RPCs denied.'

-- Auth invitation still creates an ordinary profile for the admin to approve,
-- without creating user_points. New events still derive their point value but
-- create no secret. Existing import attendance still follows an event edit.
insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000007', 'invite@example.invalid',
  '{"first_name":"Fixture","last_name":"Invite"}'
);
insert into public.events (id, name, event_type) values (
  '00000000-0000-0000-0000-000000000008', 'Synthetic post-retirement event', 'wildn_culture'
);
do $$
begin
  perform retirement_test.assert(exists (
    select 1 from public.user_profiles where id = '00000000-0000-0000-0000-000000000007'
      and first_name = 'Fixture' and last_name = 'Invite' and is_admin = false
  ), 'Admin invite no longer creates the expected profile');
  perform retirement_test.assert(not exists (
    select 1 from public.user_points where user_id = '00000000-0000-0000-0000-000000000007'
  ), 'Admin invite still bootstraps retired user points');
  perform retirement_test.assert(exists (
    select 1 from public.events where id = '00000000-0000-0000-0000-000000000008' and points = 30
  ), 'Active event-type point assignment was lost');
  perform retirement_test.assert(not exists (
    select 1 from public.event_check_in_secrets where event_id = '00000000-0000-0000-0000-000000000008'
  ), 'New event still generates a code secret');
end;
$$;
update public.events set points = 25 where id = '00000000-0000-0000-0000-000000000003';
do $$
begin
  perform retirement_test.assert(exists (
    select 1 from public.member_event_attendance where points_earned = 25
      and member_id = '00000000-0000-0000-0000-000000000004'
  ), 'Active attendance did not synchronize from event points');
  perform retirement_test.assert(exists (
    select 1 from public.members where points = 25 and events_attended = 1
      and id = '00000000-0000-0000-0000-000000000004'
  ), 'Active member totals did not synchronize from attendance');
  perform retirement_test.assert(exists (
    select 1 from public.event_attendance where points_earned = 10
  ) and exists (
    select 1 from public.user_points where total_points = 10
  ), 'Active roster edit changed legacy account points/attendance');
end;
$$;
set role service_role;
do $$
begin
  perform retirement_test.assert((select count(*) from public.event_attendance) = 1,
    'service_role cannot read retained attendance');
  begin
    perform public.generate_check_in_code();
    raise exception 'service_role can execute retired code generator';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
\echo 'PASS: admin invite profile, active event points, member attendance sync, House/import links, and service archive reads preserved; no new bootstrap points or codes.'
