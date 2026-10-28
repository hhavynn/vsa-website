#!/usr/bin/env bash
# Offline only: disposable local cluster, no TCP listener, synthetic people.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/vsa-public-houses.XXXXXX")"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null; fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT
initdb -D "$runtime_dir/data" -U house_test_operator -A trust --no-locale >/dev/null
pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55445" -w start >/dev/null
cluster_started=true
psql -X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55445 -U house_test_operator -d postgres -q \
  -f "$script_dir/sql/public-house-memberships.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -E 'PASS|FAIL|ERROR'
printf 'PASS: offline public House membership checks; cluster removed on exit.\n'
