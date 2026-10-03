-- Retire the member-account/code-check-in API without erasing its history.
-- Forward-only; manually apply after review. Legacy rows, columns, foreign
-- keys, and functions remain available to controlled database operations and
-- existing admin-only SECURITY DEFINER data-rights routines.
begin;

-- Trigger execution does not consult function EXECUTE grants. Detach the two
-- retired automatic write paths, including renamed triggers with the same
-- mapped function, while retaining admin profile and roster-points triggers.
do $$
declare
  retired_trigger record;
begin
  for retired_trigger in
    select n.nspname, c.relname, t.tgname
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace fn on fn.oid = p.pronamespace
    where not t.tgisinternal
      and (
        (n.nspname = 'public' and c.relname = 'events' and (
          t.tgname in ('generate_event_check_in_code', 'generate_event_check_in_secret')
          or (fn.nspname = 'public' and p.proname in (
            'set_event_check_in_code', 'create_event_check_in_secret', 'generate_check_in_code'
          ))
        ))
        or (n.nspname = 'auth' and c.relname = 'users' and (
          t.tgname = 'on_auth_user_created_points'
          or (fn.nspname = 'public' and p.proname = 'handle_new_user_points')
        ))
      )
  loop
    execute format('drop trigger %I on %I.%I',
      retired_trigger.tgname, retired_trigger.nspname, retired_trigger.relname);
  end loop;
end;
$$;

-- A table REVOKE leaves explicit column ACLs intact. Clear both surfaces so
-- even an authenticated admin cannot reach the private archive through REST.
-- Optional older check-in tables may be absent on reconciled installations.
do $$
declare
  archive_table record;
  archive_columns text;
begin
  for archive_table in
    select c.oid, n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in (
        'event_attendance', 'user_points', 'event_check_in_secrets',
        'check_in_codes', 'check_in_code_usage', 'check_ins'
      )
  loop
    execute format('revoke all privileges on table %I.%I from public, anon, authenticated',
      archive_table.nspname, archive_table.relname);

    select string_agg(format('%I', a.attname), ', ' order by a.attnum)
    into archive_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = archive_table.oid and a.attnum > 0 and not a.attisdropped;

    if archive_columns is not null then
      execute format('revoke all privileges (%s) on table %I.%I from public, anon, authenticated',
        archive_columns, archive_table.nspname, archive_table.relname);
    end if;
  end loop;
end;
$$;

-- Keep archived bodies rather than DROP/CASCADE unknown dependencies. Revoke
-- every overload, not just the current check_in_to_event(text) signature.
-- service_role retains table/operator access, but no retired callable API.
do $$
declare
  retired_function record;
begin
  for retired_function in
    select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in (
        'check_in_to_event', 'generate_check_in_code', 'set_event_check_in_code',
        'create_event_check_in_secret', 'handle_new_user_points', 'get_user_points',
        'update_user_points', 'handle_check_in'
      )
  loop
    execute format('revoke all privileges on function %I.%I(%s) from public, anon, authenticated, service_role',
      retired_function.nspname, retired_function.proname, retired_function.arguments);
  end loop;
end;
$$;

commit;
