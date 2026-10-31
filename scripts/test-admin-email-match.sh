#!/usr/bin/env bash
# Offline disposable PostgreSQL fixture, no network listener or real student data.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || { printf "Missing PostgreSQL binary: %s\n" "$binary" >&2; exit 1; }
done
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/vsa-email-match.XXXXXX")"
started=false
cleanup() {
  if [ "$started" = true ]; then pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null; fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT
initdb -D "$runtime_dir/data" -U email_match_operator -A trust --no-locale >/dev/null
pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55462" -w start >/dev/null
started=true
psql -X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55462 -U email_match_operator -d postgres -q \
  -f "$script_dir/sql/admin-email-match.test.sql"
printf "PASS: disposable admin email alias/POST fixture.\n"
