#!/usr/bin/env bash
# Offline only: runs scripts/sql/house-points-reconciliation.sql against a
# synthetic fixture with production's House view definitions, on a disposable
# local cluster with no TCP listener, and checks every count.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi
script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done
runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-house-recon.XXXXXX")"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT
rtk initdb -D "$runtime_dir/data" -U recon_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55444" -w start >/dev/null
cluster_started=true
psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55444 -U recon_operator -d postgres)
rtk psql "${psql_args[@]}" -q -f "$script_dir/sql/house-points-reconciliation.fixture.sql"
output="$(rtk psql "${psql_args[@]}" -q -A -t -F '|' -v year=2026 -f "$script_dir/sql/house-points-reconciliation.sql")"
summary="$(printf '%s\n' "$output" | rtk grep '^summary|')"
# check|year|credits|earning|no_house|outside|before_start|no_term|inactive|two_houses|overlaps|transferred|future|tz_boundary|view_mismatch|recomputed_mismatch
expected_prefix='summary|2026|6|3|1|1|1|1|1|0|0|1|'
expected_suffix='|1|0|0'
case "$summary" in
  "$expected_prefix"*"$expected_suffix") ;;
  *) printf 'FAIL: unexpected summary\n  got:      %s\n  expected: %s<future>%s\n' "$summary" "$expected_prefix" "$expected_suffix" >&2; exit 1 ;;
esac
printf '%s\n' "$output" | rtk grep -q '^per_house|Twilight Sparkle|2|2|2$' || { printf 'FAIL: Twilight per-House row\n%s\n' "$output" >&2; exit 1; }
printf '%s\n' "$output" | rtk grep -q '^per_house|Applejack|1|1|1$' || { printf 'FAIL: Applejack per-House row\n%s\n' "$output" >&2; exit 1; }
# Read-only: a write inside the script's transaction is refused.
if rtk psql "${psql_args[@]}" -q -c "begin transaction read only; insert into public.members (id) values ('x'); rollback;" 2>/dev/null; then
  printf 'FAIL: read-only transaction accepted a write\n' >&2; exit 1
fi
printf 'PASS: each category has its expected count; views and recomputation agree; read only.\n'
