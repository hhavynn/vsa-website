#!/usr/bin/env bash
# Offline only: creates a disposable cluster with no TCP listener or app env.
set -euo pipefail

# macOS postmaster aborts ("became multithreaded during startup") without a
# valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi

script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
for binary in initdb pg_ctl psql; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    printf 'Missing local PostgreSQL binary: %s\n' "$binary" >&2
    exit 1
  fi
done

runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-retirement.XXXXXX")"
cluster_dir="$runtime_dir/data"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT

rtk initdb -D "$cluster_dir" -U retirement_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55439" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55439 -U retirement_operator)
rtk psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create database retirement_full;
create database retirement_optional_absent;
SQL

migration="$repo_dir/supabase/migrations/20261003000000_retire_member_account_check_in.sql"
inventory="$repo_dir/docs/member-account-retirement.sql"
run_inventory() {
  local phase="$1"
  local inventory_log="$runtime_dir/inventory-$phase.log"
  if ! rtk psql "${psql_args[@]}" -d retirement_full -q \
    -c 'set client_min_messages = notice' -f "$inventory" >"$inventory_log" 2>&1; then
    rtk cat "$inventory_log"
    exit 1
  fi
  if [ "${VSA_RETIREMENT_SHOW_INVENTORY:-0}" = 1 ]; then
    printf 'Catalog inventory %s retirement:\n' "$phase"
    rtk cat "$inventory_log"
  fi
}

rtk psql "${psql_args[@]}" -d retirement_full -q \
  -c 'set client_min_messages = warning' \
  -f "$script_dir/sql/retired-member-check-in.fixture.sql"
run_inventory before
rtk psql "${psql_args[@]}" -d retirement_full -q \
  -c 'set client_min_messages = warning' \
  -f "$migration" -f "$migration"
run_inventory after
printf 'PASS: companion read-only catalog inventory executed before and after retirement.\n'
rtk psql "${psql_args[@]}" -d retirement_full -q \
  -c 'set client_min_messages = warning' \
  -f "$script_dir/sql/retired-member-check-in.assert.sql"

rtk psql "${psql_args[@]}" -d retirement_optional_absent -q \
  -f "$migration" -f "$migration"
printf 'PASS: retirement migration is repeatable with all optional legacy objects absent.\n'
cleanup
trap - EXIT
printf 'PASS: offline PostgreSQL cluster stopped and removed on exit.\n'
