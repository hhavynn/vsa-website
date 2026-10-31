#!/usr/bin/env bash
# Offline only: tests 20261029065750_house_applicant_member_merge.sql
# on a disposable local cluster with no TCP listener. Never touches hosted Supabase.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi

script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done

runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-applicant-merge.XXXXXX")"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT

rtk initdb -D "$runtime_dir/data" -U applicant_merge_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55444" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55444 -U applicant_merge_operator -d postgres)
rtk psql "${psql_args[@]}" -q -f "$script_dir/sql/house-applicant-merge.test.sql"

# A Reveal starts and holds its cycle lock while a merge begins. The merge must
# wait for that lock, then refuse, instead of reading the uncommitted state.
cycle_id='57000000-0000-0000-0000-000000000001'
batch_id='37000000-0000-0000-0000-000000000001'
source_id='17000000-0000-0000-0000-000000000001'
target_id='17000000-0000-0000-0000-000000000002'

rtk psql "${psql_args[@]}" -q >/dev/null <<SQL &
begin;
update public.house_payment_cycles set publishing_batch_id = '$batch_id' where id = '$cycle_id';
select pg_sleep(2);
commit;
SQL
reveal_pid=$!

until [ "$(rtk psql "${psql_args[@]}" -Atc "select count(*) from pg_stat_activity where wait_event = 'PgSleep'")" = "1" ]; do
  sleep 0.05
done

set +e
merge_output="$(rtk psql "${psql_args[@]}" -q 2>&1 <<SQL
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.smart_merge_members('$source_id', '$target_id');
SQL
)"
merge_status=$?
set -e
wait "$reveal_pid"

if [ "$merge_status" -eq 0 ] || ! printf '%s' "$merge_output" | grep -q 'A Reveal is in progress'; then
  printf 'FAIL: merge did not refuse a Reveal that started first\n%s\n' "$merge_output" >&2
  exit 1
fi

race_state="$(rtk psql "${psql_args[@]}" -Atc "select count(*) from public.house_applicants a join public.members m on m.id = a.member_id where a.member_id = '$source_id' and a.withdrawn_reason is null")"
if [ "$race_state" != "1" ]; then
  printf 'FAIL: refused merge changed the applicant or member\n' >&2
  exit 1
fi
printf 'PASS: merge waits for the Reveal cycle lock, then refuses (55006)\n'

printf 'PASS: offline house applicant merge tests complete.\n'
