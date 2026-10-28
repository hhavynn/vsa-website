#!/usr/bin/env bash
# Offline only: exact House migrations, synthetic records, no TCP listener.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi
script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done
runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-house-override.XXXXXX")"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT
rtk initdb -D "$runtime_dir/data" -U house_test_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55441" -w start >/dev/null
cluster_started=true
psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55441 -U house_test_operator -d postgres)
rtk psql "${psql_args[@]}" -q -f "$script_dir/sql/house-placement-override.test.sql"
# Both sessions try to consume the only remaining spot. The first holds the
# transaction open after its move; the second must wait, then reject capacity.
rtk psql "${psql_args[@]}" -q >"$runtime_dir/first.log" 2>&1 <<'SQL' &
begin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select count(*) from public.admin_apply_house_placement_override(
 '10000000-0000-0000-0000-000000000001',
 '[{"draft_id":"30000000-0000-0000-0000-000000000001","house_profile_id":"20000000-0000-0000-0000-000000000002"}]', 'concurrent');
select pg_sleep(1);
commit;
SQL
first_pid=$!
rtk psql "${psql_args[@]}" -q >"$runtime_dir/second.log" 2>&1 <<'SQL' &
begin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select count(*) from public.admin_apply_house_placement_override(
 '10000000-0000-0000-0000-000000000001',
 '[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000002"}]', 'concurrent');
select pg_sleep(1);
commit;
SQL
second_pid=$!
first_status=0; wait "$first_pid" || first_status=$?
second_status=0; wait "$second_pid" || second_status=$?
if ! { [ "$first_status" = 0 ] && [ "$second_status" != 0 ]; } && \
   ! { [ "$first_status" != 0 ] && [ "$second_status" = 0 ]; }; then
  rtk cat "$runtime_dir/first.log" "$runtime_dir/second.log"
  printf 'FAIL: exactly one concurrent move must succeed.\n' >&2
  exit 1
fi
if [ "$first_status" != 0 ]; then rejection_log="$runtime_dir/first.log"; else rejection_log="$runtime_dir/second.log"; fi
rtk grep -q 'its capacity is 1. Nothing was changed' "$rejection_log"
rtk psql "${psql_args[@]}" -q <<'SQL'
do $$ begin
 if (select count(*) from public.house_assignment_drafts where house_profile_id = '20000000-0000-0000-0000-000000000002') <> 1 then
   raise exception 'Concurrent moves exceeded capacity';
 end if;
 if (select count(*) from public.house_assignment_drafts where house_profile_id = '20000000-0000-0000-0000-000000000001') <> 1 then
   raise exception 'Rejected concurrent move changed its original placement';
 end if;
 raise notice 'PASS: concurrent moves serialize; exactly one succeeds and the rejected row stays put.';
end $$;
SQL
printf 'PASS: offline House override checks; cluster removed on exit.\n'
