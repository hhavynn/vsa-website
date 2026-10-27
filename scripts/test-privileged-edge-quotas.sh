#!/usr/bin/env bash
# Runs only against an isolated synthetic cluster with no TCP listener.
set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
if ! command -v rtk >/dev/null 2>&1; then rtk() { "$@"; }; fi
root="$(cd "$(dirname "$0")/.." && pwd)"
runtime="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-edge-quota.XXXXXX")"
started=false
cleanup() {
  if [ "$started" = true ]; then rtk pg_ctl -D "$runtime/data" -m immediate -w stop >/dev/null; fi
  rtk rm -rf "$runtime"
}
trap cleanup EXIT
rtk initdb -D "$runtime/data" -U quota_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$runtime/data" -l "$runtime/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories='$runtime' -p 55446" -w start >/dev/null
started=true
args=(-X -v ON_ERROR_STOP=1 -h "$runtime" -p 55446 -U quota_operator -d postgres -q)
q() { rtk psql "${args[@]}" -Atc "$1"; }
rtk psql "${args[@]}" <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role', true) $$;
SQL
rtk psql "${args[@]}" -f "$root/supabase/migrations/20261027160000_privileged_edge_quotas.sql"
expect() { local actual; actual="$(q "$2")"; if [ "$actual" != "$3" ]; then echo "FAIL $1: got $actual expected $3"; exit 1; fi; echo "PASS $1"; }
hash="$(rtk printf 'a%.0s' {1..64})"
expect 'browser roles cannot execute admission' "select bool_or(has_function_privilege(r, 'public.reserve_privileged_edge_quota(text,text,integer,integer)', 'EXECUTE')) from unnest(array['anon','authenticated']) r" f
expect 'browser roles cannot read quota state' "select bool_or(has_table_privilege(r, 'public.privileged_edge_quotas', 'SELECT')) from unnest(array['anon','authenticated']) r" f
if q "select public.reserve_privileged_edge_quota('analytics','$hash',2,3)" >/dev/null 2>&1; then echo 'FAIL missing internal service role guard'; exit 1; fi
echo 'PASS internal service role guard'
service="set request.jwt.claim.role='service_role'; set role service_role;"
expect 'valid service caller admitted' "$service select public.reserve_privileged_edge_quota('analytics','$hash',2,3)" t
expect 'caller second admission' "$service select public.reserve_privileged_edge_quota('analytics','$hash',2,3)" t
expect 'caller ceiling enforced' "$service select public.reserve_privileged_edge_quota('analytics','$hash',2,3)" f
expect 'caller rejection does not consume global count' "select day_count from public.privileged_edge_quotas where scope='analytics' and caller_hash='global'" 2
hash2="$(rtk printf 'b%.0s' {1..64})"
expect 'another caller reaches global ceiling' "$service select public.reserve_privileged_edge_quota('analytics','$hash2',2,3)" t
expect 'global ceiling rejects caller below own ceiling' "$service select public.reserve_privileged_edge_quota('analytics','$hash2',2,3)" f
q "update public.privileged_edge_quotas set day_started = day_started - interval '1 day', minute_started = minute_started - interval '1 minute' where scope='analytics'" >/dev/null
expect 'expired windows reset on existing rows' "$service select public.reserve_privileged_edge_quota('analytics','$hash',2,3)" t
expect 'no growing daily history' "select count(*) from public.privileged_edge_quotas where scope='analytics'" 3
# Twenty separate sessions race for a global budget of three.
for number in $(rtk seq 1 20); do
  caller="$(rtk printf '%064x' "$number")"
  q "$service select public.reserve_privileged_edge_quota('image-migration','$caller',120,3)" >"$runtime/race.$number" &
done
wait
expect 'concurrent requests never exceed global ceiling' "select day_count from public.privileged_edge_quotas where scope='image-migration' and caller_hash='global'" 3
expect 'only admitted callers persisted under race' "select count(*) from public.privileged_edge_quotas where scope='image-migration' and caller_hash <> 'global'" 3
# Roll back test-only state, then race twenty requests for one caller budget.
q "truncate public.privileged_edge_quotas" >/dev/null
for number in $(rtk seq 1 20); do
  q "$service select public.reserve_privileged_edge_quota('analytics','$hash',2,500)" >"$runtime/caller.$number" &
done
wait
expect 'concurrent requests never exceed caller ceiling' "select minute_count from public.privileged_edge_quotas where scope='analytics' and caller_hash='$hash'" 2
expect 'global and caller counters stay consistent' "select day_count from public.privileged_edge_quotas where scope='analytics' and caller_hash='global'" 2
echo 'All privileged quota checks passed (synthetic local PostgreSQL only).'
