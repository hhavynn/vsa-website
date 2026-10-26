#!/usr/bin/env bash
# Offline only: verifies 20261025000000_member_identity_aliases.sql on a
# disposable local cluster with no TCP listener and no app env. Never touches a
# hosted Supabase project. Synthetic people only.
#
# Runs every check twice: against the production points trigger (row level,
# as of 2026-10-25) and with 20261010000000's statement triggers applied.
set -euo pipefail

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

runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-identity.XXXXXX")"
cluster_dir="$runtime_dir/data"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT

rtk initdb -D "$cluster_dir" -U identity_operator -A trust --no-locale -E UTF8 >/dev/null
rtk pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55442" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55442 -U identity_operator)
rtk psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
SQL

migration="${VSA_IDENTITY_MIGRATION:-$repo_dir/supabase/migrations/20261025000000_member_identity_aliases.sql}"
points_migration="$repo_dir/supabase/migrations/20261010000000_serialize_member_points_recalculation.sql"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}
pass() {
  printf 'PASS: %s\n' "$1"
}

run_suite() {
  local db="$1" with_statement_triggers="$2"
  rtk psql "${psql_args[@]}" -d postgres -q -c "create database $db"
  local q=(rtk psql "${psql_args[@]}" -d "$db" -q -c 'set client_min_messages = warning')
  "${q[@]}" -f "$script_dir/sql/attendance-recovery.fixture.sql"
  if [ "$with_statement_triggers" = true ]; then
    "${q[@]}" -f "$points_migration"
  fi
  "${q[@]}" -f "$script_dir/sql/member-identity.fixture.sql"
  "${q[@]}" -f "$migration" -f "$migration"
  pass "[$db] migration applies over existing data and is repeatable"

  local log="$runtime_dir/$db.assert.log"
  if ! rtk psql "${psql_args[@]}" -d "$db" -q -c 'set client_min_messages = notice' \
    -f "$script_dir/sql/member-identity.assert.sql" >"$log" 2>&1; then
    rtk cat "$log" >&2
    exit 1
  fi
  rtk sed -n "s/^.*NOTICE:  /[$db] /p" "$log"

  run_concurrency "$db"
}

as_admin() {
  local db="$1" sub="$2" sql="$3"
  rtk psql "${psql_args[@]}" -d "$db" -qtA -v ON_ERROR_STOP=0 2>&1 <<SQL
begin;
set local request.jwt.claim.sub = '$sub';
set local role authenticated;
$sql
commit;
SQL
}

run_concurrency() {
  local db="$1"
  rtk psql "${psql_args[@]}" -d "$db" -q <<'SQL'
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true), ('00000000-0000-0000-0000-0000000000a2', true);
insert into public.members (id, first_name, last_name, email, college) values
  ('12000000-0000-0000-0000-000000000001', 'Duy', 'Tran', 'duy@ucsd.edu', 'Muir'),
  ('12000000-0000-0000-0000-000000000002', 'Vy', 'Ngo', null, 'Warren'),
  ('12000000-0000-0000-0000-000000000003', 'Vi', 'Ngo', null, 'Sixth');
SQL
  local snapshot
  snapshot="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select now()")"
  local credit_duy='{"row_key": "r1", "member_id": "12000000-0000-0000-0000-000000000001", "expected": {"first_name": "Duy", "last_name": "Tran", "college": "Muir", "email": "duy@ucsd.edu"}}'
  req() {
    printf '{"request_id": "%s", "event_id": "%s", "expected_points": %s, "expected_term_id": "71000000-0000-0000-0000-000000000026", "snapshot_at": "%s", "credits": %s, "creates": %s}' \
      "$1" "$2" "$3" "$snapshot" "$4" "$5"
  }
  local e26=81000000-0000-0000-0000-000000000026 e27=81000000-0000-0000-0000-000000000027 e28=81000000-0000-0000-0000-000000000028
  local a1=00000000-0000-0000-0000-0000000000a1 a2=00000000-0000-0000-0000-0000000000a2

  # 1. Two imports credit one member on two events at once. Under the row-level
  #    production trigger, the second recalculation would miss the first row.
  as_admin "$db" "$a1" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000001 $e26 3 "[$credit_duy]" '[]')'::jsonb); select pg_sleep(1.2);" >"$runtime_dir/$db.c1.out" &
  local p1=$!
  sleep 0.3
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000002 $e27 7 "[$credit_duy]" '[]')'::jsonb);" >"$runtime_dir/$db.c2.out" &
  local p2=$!

  # 2. Two admins create the same new person for one event from the same sheet.
  local hoa='[{"row_key": "r1", "first_name": "Hoa", "last_name": "Pham", "email": "hoa@ucsd.edu"}]'
  as_admin "$db" "$a1" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000003 $e26 3 '[]' "$hoa")'::jsonb); select pg_sleep(1.2);" >"$runtime_dir/$db.c3.out" &
  local p3=$!

  # 3. Two imports on different events claim one new address for two people.
  #    (Each scenario uses its own events: imports for one event queue on the
  #    event lock, which would hide the per-member race in scenario 1.)
  local vy='[{"row_key": "r1", "member_id": "12000000-0000-0000-0000-000000000002", "expected": {"first_name": "Vy", "last_name": "Ngo", "college": "Warren", "email": null}, "aliases": [{"email": "v.ngo@ucsd.edu", "method": "admin_confirmed"}]}]'
  local vi='[{"row_key": "r1", "member_id": "12000000-0000-0000-0000-000000000003", "expected": {"first_name": "Vi", "last_name": "Ngo", "college": "Sixth", "email": null}, "aliases": [{"email": "v.ngo@ucsd.edu", "method": "admin_confirmed"}]}]'
  as_admin "$db" "$a1" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000005 $e28 4 "$vy" '[]')'::jsonb); select pg_sleep(1.2);" >"$runtime_dir/$db.c5.out" &
  local p5=$!
  wait "$p1"
  sleep 0.3
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000004 $e26 3 '[]' "$hoa")'::jsonb);" >"$runtime_dir/$db.c4.out" &
  local p4=$!
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000006 $e26 3 "$vi" '[]')'::jsonb);" >"$runtime_dir/$db.c6.out" &
  local p6=$!
  wait "$p2" "$p3" "$p4" "$p5" "$p6"

  local dump=()
  for f in c1 c2 c3 c4 c5 c6; do dump+=("$runtime_dir/$db.$f.out"); done
  check_out() {
    if ! rtk grep -q "$2" "$runtime_dir/$db.$1.out"; then
      for f in "${dump[@]}"; do printf -- '--- %s\n' "$f" >&2; rtk cat "$f" >&2; done
      fail "[$db] $3"
    fi
    pass "[$db] $3"
  }
  check_out c1 '"ok": true' 'first concurrent import applies'
  check_out c2 '"ok": true' 'second concurrent import for the same member applies after waiting'
  local duy
  duy="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select points || '/' || events_attended from public.members where id = '12000000-0000-0000-0000-000000000001'")"
  [ "$duy" = "10/2" ] || fail "[$db] concurrent imports for one member leave the right total (got $duy, want 10/2)"
  pass "[$db] concurrent imports for one member leave the right total (10/2)"
  check_out c3 '"ok": true' 'first concurrent create applies'
  check_out c4 'possible_duplicate_created' 'a concurrent create of the same person is sent back for review, not duplicated'
  local hoas
  hoas="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select count(*) from public.members where first_name = 'Hoa' and last_name = 'Pham'")"
  [ "$hoas" = "1" ] || fail "[$db] exactly one Hoa Pham exists (got $hoas)"
  pass "[$db] exactly one member exists for the concurrently created person"
  check_out c5 '"ok": true' 'first concurrent alias claim applies'
  check_out c6 'email_owned_by_other' 'a concurrent claim of the same address for another member is stale'
  local owner
  owner="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select member_id from public.member_identity_emails where email = 'v.ngo@ucsd.edu'")"
  [ "$owner" = "12000000-0000-0000-0000-000000000002" ] || fail "[$db] the address belongs to the first claimant (got $owner)"
  pass "[$db] the contested address belongs to exactly the first claimant"

  # 5. Two imports into different events create the same new person (no shared
  #    email or event lock): the name lock serializes them, so the second sees
  #    the first's member and is sent back for review.
  local kha1='[{"row_key": "r1", "first_name": "Kha", "last_name": "Dinh", "email": "kha.one@gmail.com", "known_same_name_ids": []}]'
  local kha2='[{"row_key": "r1", "first_name": "Kha", "last_name": "Dinh", "email": "kha.two@ucsd.edu", "known_same_name_ids": []}]'
  as_admin "$db" "$a1" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000009 $e27 7 '[]' "$kha1")'::jsonb); select pg_sleep(1.2);" >"$runtime_dir/$db.n1.out" &
  local pn1=$!
  sleep 0.3
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000010 $e28 4 '[]' "$kha2")'::jsonb);" >"$runtime_dir/$db.n2.out" &
  local pn2=$!
  wait "$pn1" "$pn2"
  dump+=("$runtime_dir/$db.n1.out" "$runtime_dir/$db.n2.out")
  check_out n1 '"ok": true' 'the first of two concurrent imports of one new person (different events) applies'
  check_out n2 'possible_duplicate_created' 'the second, on another event, is sent back for review instead of creating a duplicate'
  local khas
  khas="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select count(*) from public.members where first_name = 'Kha' and last_name = 'Dinh'")"
  [ "$khas" = "1" ] || fail "[$db] exactly one Kha Dinh exists (got $khas)"
  pass "[$db] exactly one member exists for a person imported into two events at once"

  # 4. A merge and an import touching the same member. Merge first: the import
  #    waits, then finds the source gone and writes nothing. Import first: the
  #    merge waits, then moves the new credit to the target. Either way no
  #    committed credit is deleted by the merge's cascade.
  rtk psql "${psql_args[@]}" -d "$db" -q -c "insert into public.members (id, first_name, last_name) values
    ('12000000-0000-0000-0000-000000000011', 'Quy', 'Ta'), ('12000000-0000-0000-0000-000000000012', 'Quy', 'Ta'),
    ('12000000-0000-0000-0000-000000000013', 'Tien', 'Lu'), ('12000000-0000-0000-0000-000000000014', 'Tien', 'Lu')"
  local quy='[{"row_key": "r1", "member_id": "12000000-0000-0000-0000-000000000011", "expected": {"first_name": "Quy", "last_name": "Ta", "college": null, "email": null}}]'
  local tien='[{"row_key": "r1", "member_id": "12000000-0000-0000-0000-000000000013", "expected": {"first_name": "Tien", "last_name": "Lu", "college": null, "email": null}}]'
  as_admin "$db" "$a1" "select public.smart_merge_members('12000000-0000-0000-0000-000000000011', '12000000-0000-0000-0000-000000000012'); select pg_sleep(1.2);" >"$runtime_dir/$db.m1.out" &
  local pm1=$!
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000008 $e28 4 "$tien" '[]')'::jsonb); select pg_sleep(1.2);" >"$runtime_dir/$db.m3.out" &
  local pm3=$!
  sleep 0.3
  as_admin "$db" "$a2" "select public.admin_apply_attendance_import('$(req 92000000-0000-0000-0000-000000000007 $e27 7 "$quy" '[]')'::jsonb);" >"$runtime_dir/$db.m2.out" &
  local pm2=$!
  as_admin "$db" "$a1" "select public.smart_merge_members('12000000-0000-0000-0000-000000000013', '12000000-0000-0000-0000-000000000014');" >"$runtime_dir/$db.m4.out" &
  local pm4=$!
  wait "$pm1" "$pm2" "$pm3" "$pm4"
  dump+=("$runtime_dir/$db.m1.out" "$runtime_dir/$db.m2.out" "$runtime_dir/$db.m3.out" "$runtime_dir/$db.m4.out")
  check_out m2 'member_missing' 'an import waiting on a merge finds the source gone and writes nothing'
  local quy_rows
  quy_rows="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select count(*) from public.member_event_attendance where member_id in ('12000000-0000-0000-0000-000000000011', '12000000-0000-0000-0000-000000000012')")"
  [ "$quy_rows" = "0" ] || fail "[$db] no credit was written for the merged-away member (got $quy_rows)"
  pass "[$db] no credit was written for the merged-away member"
  check_out m3 '"ok": true' 'an import that started before a merge applies'
  local tien_target
  tien_target="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "select (select points || '/' || events_attended from public.members where id = '12000000-0000-0000-0000-000000000014') || '|' || (select count(*) from public.members where id = '12000000-0000-0000-0000-000000000013')")"
  [ "$tien_target" = "4/1|0" ] || fail "[$db] a merge waiting on an import keeps that import's credit on the target (got $tien_target, want 4/1|0)"
  pass "[$db] a merge waiting on an import keeps that import's credit on the target (4/1)"

  local drift
  drift="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "
    select count(*) from (
      select m.id from public.members m left join public.member_event_attendance a on a.member_id = m.id
      group by m.id, m.points, m.events_attended
      having m.points <> coalesce(sum(a.points_earned), 0) or m.events_attended <> count(a.id)) d")"
  [ "$drift" = "0" ] || fail "[$db] cached totals drifted from the ledger ($drift members)"
  pass "[$db] every cached total equals the ledger after the concurrent runs"
}

run_suite identity_row_trigger false
run_suite identity_statement_triggers true

# Rollback script restores the pre-migration objects and leaves data intact.
rtk psql "${psql_args[@]}" -d identity_row_trigger -q -c 'set client_min_messages = warning' \
  -f "$script_dir/sql/member-identity-aliases-rollback.sql"
remaining="$(rtk psql "${psql_args[@]}" -d identity_row_trigger -qtA -c "
  select coalesce(to_regclass('public.member_identity_emails')::text, '') || coalesce(to_regclass('public.member_year_observations')::text, '')
      || coalesce(to_regprocedure('public.admin_apply_attendance_import(jsonb)')::text, '')
      || (select count(*)::text from pg_trigger where tgname in ('trg_member_primary_email_alias', 'trg_member_purge_identity_on_anonymize'))")"
[ "$remaining" = "0" ] || fail "rollback leaves no identity objects (got '$remaining')"
merge_body="$(rtk psql "${psql_args[@]}" -d identity_row_trigger -qtA -c "select pg_get_functiondef('public.smart_merge_members(uuid, uuid)'::regprocedure)")"
case "$merge_body" in
  *member_identity_emails*) fail 'rollback restores the production smart_merge_members' ;;
esac
pass 'rollback removes the identity objects and restores the production merge'

printf 'All member identity checks passed.\n'
