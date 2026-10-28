#!/usr/bin/env bash
# Offline only: exact House migrations, synthetic records, no TCP listener.
# Verifies 20261028000000_house_payment_eligibility.sql, including two
# concurrent payment requests that race on one cycle.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi
script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done
runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-house-payments.XXXXXX")"
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
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55443" -w start >/dev/null
cluster_started=true
psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55443 -U house_test_operator -d postgres)
rtk psql "${psql_args[@]}" -q -f "$script_dir/sql/house-payments.test.sql"

# Two admins preview the same version and submit different changes at once.
# The first holds its transaction open; the second must wait for the cycle
# lock, then refuse its stale preview instead of overwriting.
version="$(rtk psql "${psql_args[@]}" -tA -c "select status_version from public.house_payment_cycles")"
race() {
  rtk psql "${psql_args[@]}" -q <<SQL
begin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', '$1')) from public.house_applicants where source_row_number = $2),
 'single', 'race', gen_random_uuid(), $version);
select pg_sleep(1);
commit;
SQL
}
race pending 3 >"$runtime_dir/first.log" 2>&1 &
first_pid=$!
race pending 4 >"$runtime_dir/second.log" 2>&1 &
second_pid=$!
first_status=0; wait "$first_pid" || first_status=$?
second_status=0; wait "$second_pid" || second_status=$?
if ! { [ "$first_status" = 0 ] && [ "$second_status" != 0 ]; } && \
   ! { [ "$first_status" != 0 ] && [ "$second_status" = 0 ]; }; then
  rtk cat "$runtime_dir/first.log" "$runtime_dir/second.log"
  printf 'FAIL: exactly one concurrent request from the same preview must succeed.\n' >&2
  exit 1
fi
if [ "$first_status" != 0 ]; then rejection_log="$runtime_dir/first.log"; else rejection_log="$runtime_dir/second.log"; fi
rtk grep -q 'Payments changed since this preview' "$rejection_log"
printf 'PASS: concurrent requests from one preview serialize; the second is refused as stale.\n'
printf 'PASS: offline House payment checks; cluster removed on exit.\n'
