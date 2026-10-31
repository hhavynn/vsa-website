#!/usr/bin/env bash
# Offline proof for 20261027190000_ace_member_pickup_year.sql: creates a
# disposable PostgreSQL cluster with no TCP listener or app env, applies the
# real ACE migrations, then the pickup-year migration (twice), its assertions,
# and the rollback script. Never touches a hosted database.
set -euo pipefail

# macOS postmaster aborts ("became multithreaded during startup") without a
# valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
for binary in initdb pg_ctl psql; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    printf 'Missing local PostgreSQL binary: %s\n' "$binary" >&2
    exit 1
  fi
done

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/vsa-ace-pickup.XXXXXX")"
cluster_dir="$runtime_dir/data"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

initdb -D "$cluster_dir" -U pickup_operator -A trust --no-locale >/dev/null
pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55441" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55441 -U pickup_operator)
psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create database pickup_full;
create database pickup_rollback;
SQL

migration="$repo_dir/supabase/migrations/20261027190000_ace_member_pickup_year.sql"
rollback="$script_dir/sql/ace-pickup-year.rollback.sql"

for db in pickup_full pickup_rollback; do
  psql "${psql_args[@]}" -d "$db" -q -c 'set client_min_messages = warning' \
    -f "$script_dir/sql/ace-pickup-year.fixture.sql"
done

psql "${psql_args[@]}" -d pickup_full -q -c 'set client_min_messages = warning' \
  -f "$migration" -f "$migration"
printf 'PASS: migration applies cleanly and is repeatable.\n'
psql "${psql_args[@]}" -d pickup_full -q -f "$script_dir/sql/ace-pickup-year.assert.sql" 2>&1 \
  | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'

# #673 uses the same disposable full-snapshot database AFTER the #669 tests;
# it never alters rollback's separate database. Apply twice for idempotency.
psql "${psql_args[@]}" -d pickup_full -q -c 'set client_min_messages = warning' \
  -f "$repo_dir/supabase/migrations/20261002040000_admin_activity_log_and_review_marks.sql" \
  -f "$repo_dir/supabase/migrations/20261031090000_ace_pickup_year_correction.sql" \
  -f "$repo_dir/supabase/migrations/20261031090000_ace_pickup_year_correction.sql"
psql "${psql_args[@]}" -d pickup_full -q -f "$script_dir/sql/ace-year-correction.test.sql" 2>&1 \
  | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'
printf 'PASS: #673 CAS/audit fixture on disposable PostgreSQL.\n'
psql "${psql_args[@]}" -d pickup_rollback -q -c 'set client_min_messages = warning' -f "$migration"
psql "${psql_args[@]}" -d pickup_rollback -q <<'SQL'
update public.ace_family_members set pickup_academic_year_start = 2023, pickup_term = 'FA23'
where id = '30000000-0000-0000-0000-000000000003';
insert into public.ace_member_pickup_evidence (ace_member_id, source_kind, raw_value)
values ('30000000-0000-0000-0000-000000000003', 'import_json', 'FA23');
SQL
psql "${psql_args[@]}" -d pickup_rollback -q -c 'set client_min_messages = warning' -f "$rollback"
psql "${psql_args[@]}" -d pickup_rollback -q <<'SQL'
do $$ begin
  if (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
      where table_schema = 'public' and table_name = 'published_ace_family_members')
     <> array['id', 'family_id', 'name', 'role_label', 'photo_url', 'parent_member_id', 'display_order',
              'created_at', 'updated_at', 'member_id'] then
    raise exception 'FAIL: rollback did not restore the 10-column view';
  end if;
  if has_table_privilege('anon', 'public.published_ace_family_members', 'insert,update,delete,truncate')
     or not has_table_privilege('anon', 'public.published_ace_family_members', 'select') then
    raise exception 'FAIL: rollback left the view with the wrong grants';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'ace_family_members' and column_name like 'pickup_%')
     or to_regclass('public.ace_member_pickup_evidence') is not null
     or to_regprocedure('public.set_ace_member_pickup_year(uuid,integer,text,uuid)') is not null then
    raise exception 'FAIL: rollback left pickup objects behind';
  end if;
  if exists (select 1 from public.zz_pre_snapshot s left join public.ace_family_members m on m.id = s.id
             where m.id is null or (to_jsonb(m) - 'updated_at') <> (s.row_json - 'updated_at')) then
    raise exception 'FAIL: rollback changed a pre-existing node';
  end if;
  -- The approval set above legitimately moved that one node's updated_at.
  raise notice 'PASS: rollback restores the original view, grants and every node column but updated_at.';
end $$;
SQL
psql "${psql_args[@]}" -d pickup_rollback -q -c 'set client_min_messages = warning' -f "$migration"
printf 'PASS: migration re-applies after rollback.\n'

cleanup
trap - EXIT
printf 'PASS: offline PostgreSQL cluster stopped and removed on exit.\n'
