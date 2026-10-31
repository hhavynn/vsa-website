#!/usr/bin/env bash
# Synthetic-only offline role projection test, never uses a network DB.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf "Missing PostgreSQL binary: %s\n" "$binary" >&2; exit 1; }
done
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/vsa-public-roles.XXXXXX")"
started=false
cleanup() {
  if [ "$started" = true ]; then pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null; fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT
initdb -D "$runtime_dir/data" -U role_test_operator -A trust --no-locale >/dev/null
pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55460" -w start >/dev/null
started=true
psql -X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55460 -U role_test_operator -d postgres -q \
  -f "$script_dir/sql/public-member-roles.test.sql"
printf "PASS: local public member-role fixture; cluster deleted.\n"
