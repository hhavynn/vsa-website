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
# The admin function (20261028070000) returns the same counts, refuses
# non-admins and is not executable by anon.
rtk psql "${psql_args[@]}" -q <<'SQL'
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
grant select on all tables in schema public to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.is_admin_user(p_id uuid) returns boolean language sql stable as $$ select p_id = '00000000-0000-0000-0000-000000000001' $$;
SQL
rtk psql "${psql_args[@]}" -q -f "$script_dir/../supabase/migrations/20261028070000_admin_house_points_reconciliation.sql"
function_summary="$(rtk psql "${psql_args[@]}" -q -A -t -c "set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001'; select concat_ws('|', s->>'academic_year_start', s->>'year_credits', s->>'credits_earning_house_points', s->>'credits_member_has_no_house_this_year', s->>'credits_outside_membership_interval', s->>'credits_before_house_start', s->>'credits_event_without_term_near_year', s->>'credits_on_inactive_house_profile', s->>'pacific_vs_utc_boundary_credits', s->>'recomputed_vs_view_mismatch', (select count(*) from jsonb_array_elements(r->'houses'))) from (select public.admin_house_points_reconciliation(2026) r) x, lateral (select r->'summary' s) y;" | tail -1)"
[ "$function_summary" = "2026|6|3|1|1|1|1|1|1|0|3" ] || { printf 'FAIL: function summary %s\n' "$function_summary" >&2; exit 1; }
if rtk psql "${psql_args[@]}" -q -c "set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002'; select public.admin_house_points_reconciliation(2026);" >/dev/null 2>&1; then
  printf 'FAIL: a non-admin ran the check\n' >&2; exit 1
fi
if rtk psql "${psql_args[@]}" -q -c "set role anon; select public.admin_house_points_reconciliation(2026);" >/dev/null 2>&1; then
  printf 'FAIL: anon ran the check\n' >&2; exit 1
fi
printf 'PASS: the admin function returns the same counts in UTC, refuses non-admins and anon.\n'

# Read-only: a write inside the script's transaction is refused.
if rtk psql "${psql_args[@]}" -q -c "begin transaction read only; insert into public.members (id) values ('x'); rollback;" 2>/dev/null; then
  printf 'FAIL: read-only transaction accepted a write\n' >&2; exit 1
fi
printf 'PASS: each category has its expected count; views and recomputation agree; read only.\n'
