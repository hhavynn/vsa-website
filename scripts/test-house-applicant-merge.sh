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

printf 'PASS: offline house applicant merge tests complete.\n'
