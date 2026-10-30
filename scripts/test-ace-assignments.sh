#!/usr/bin/env bash
# Offline proof for the ACE assignment workspace and its saved eligibility
# policy: creates a disposable PostgreSQL cluster with no TCP listener or app
# env, applies the real ACE migrations, applies the eligibility-policy
# migration twice (repeatable), then runs scripts/verify-ace-assignments.sql.
# Never touches a hosted database.
set -euo pipefail

# macOS postmaster aborts ("became multithreaded during startup") without a
# valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
for binary in initdb pg_ctl psql; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    printf 'Missing local PostgreSQL binary: %s\n' "$binary" >&2
    exit 1
  fi
done

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/vsa-ace-assignments.XXXXXX")"
cluster_dir="$runtime_dir/data"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

# The verifier switches back to the "postgres" role after each impersonation.
initdb -D "$cluster_dir" -U postgres -A trust --no-locale >/dev/null
pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55449" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55449 -U postgres)
psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create database ace_assignments;
SQL

migration="$repo_dir/supabase/migrations/20261030120000_ace_assignment_eligibility_policy.sql"
psql "${psql_args[@]}" -d ace_assignments -q -c 'set client_min_messages = warning' \
  -f "$script_dir/sql/ace-assignments.fixture.sql" -f "$migration" -f "$migration"
printf 'PASS: eligibility-policy migration applies cleanly and is repeatable.\n'

psql "${psql_args[@]}" -d ace_assignments -q -f "$script_dir/verify-ace-assignments.sql" 2>&1 \
  | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'

cleanup
trap - EXIT
printf 'PASS: offline PostgreSQL cluster stopped and removed on exit.\n'
