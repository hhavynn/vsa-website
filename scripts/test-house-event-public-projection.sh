#!/usr/bin/env bash
# Offline only: disposable synthetic PostgreSQL and no TCP network.
set -euo pipefail
export LC_ALL=C
script_dir="$(cd "$(dirname "$0")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf 'Missing PostgreSQL binary: %s\n' "$binary" >&2; exit 1; }
done
runtime_dir="$(mktemp -d /tmp/vsa-house-public-projection.XXXXXX)"
started=false
cleanup() {
  if [ "$started" = true ]; then pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null; fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT
initdb -D "$runtime_dir/data" -U house_projection_operator -A trust --no-locale >/dev/null
pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55450" -w start >/dev/null
started=true
psql -X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55450 -U house_projection_operator -d postgres -q \
  -f "$script_dir/sql/house-event-public-projection.test.sql" 2>&1 \
  | sed 's/^psql:[^ ]* NOTICE:  //' | grep -E 'PASS|FAIL|ERROR'
printf 'PASS: disposable House-event public projection fixture completed.\n'

