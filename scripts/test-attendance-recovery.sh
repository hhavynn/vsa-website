#!/usr/bin/env bash
# Offline only: verifies migration 20261009000026_historical_attendance_recovery.sql
# on a disposable local cluster with no TCP listener and no app env. Never
# touches a hosted Supabase project. Synthetic people only.
set -euo pipefail

# macOS postmaster aborts ("became multithreaded during startup") without a
# valid locale in the environment.
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

runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-recovery.XXXXXX")"
cluster_dir="$runtime_dir/data"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT

rtk initdb -D "$cluster_dir" -U recovery_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55441" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55441 -U recovery_operator)
rtk psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create database recovery;
create database recovery_draft;
SQL

migration="$repo_dir/supabase/migrations/20261009000026_historical_attendance_recovery.sql"
db=(rtk psql "${psql_args[@]}" -d recovery -q -c 'set client_min_messages = warning')
"${db[@]}" -f "$script_dir/sql/attendance-recovery.fixture.sql"
"${db[@]}" -f "$migration" -f "$migration"
printf 'PASS: migration applies cleanly and is repeatable.\n'

# The guard refuses to run over the earlier destructive draft's table.
rtk psql "${psql_args[@]}" -d recovery_draft -q -c 'set client_min_messages = warning' \
  -f "$script_dir/sql/attendance-recovery.fixture.sql" >/dev/null
rtk psql "${psql_args[@]}" -d recovery_draft -q -c 'create table public.import_recovery_actions (id uuid primary key, removed_attendance jsonb)'
if rtk psql "${psql_args[@]}" -d recovery_draft -q -c 'set client_min_messages = warning' -f "$migration" >"$runtime_dir/draft.log" 2>&1; then
  printf 'FAIL: migration applied over the earlier draft\n' >&2
  exit 1
fi
rtk grep -q 'earlier draft of import_recovery_actions is present' "$runtime_dir/draft.log"
printf 'PASS: migration refuses to apply over the earlier destructive draft.\n'

assert_log="$runtime_dir/assert.log"
if ! rtk psql "${psql_args[@]}" -d recovery -q -c 'set client_min_messages = notice' \
  -f "$script_dir/sql/attendance-recovery.assert.sql" >"$assert_log" 2>&1; then
  rtk cat "$assert_log" >&2
  exit 1
fi
rtk sed -n 's/^.*NOTICE:  //p' "$assert_log"

# ── Concurrency: two admins, separate sessions, committed data ─────────────────
rtk psql "${psql_args[@]}" -d recovery -q <<'SQL'
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true), ('00000000-0000-0000-0000-0000000000a2', true);
insert into public.events (id, name, points) values
  ('80000000-0000-0000-0000-0000000000c1', 'Concurrency GBM', 10),
  ('80000000-0000-0000-0000-0000000000c2', 'Concurrency Social', 7),
  ('80000000-0000-0000-0000-0000000000c3', 'Concurrency Retreat', 10);
insert into public.members (id, first_name, last_name) values
  ('10000000-0000-0000-0000-0000000000c1', 'Ana', 'Bui'),
  ('10000000-0000-0000-0000-0000000000c2', 'Anh', 'Bui'),
  ('10000000-0000-0000-0000-0000000000c3', 'Duc', 'Ha'),
  ('10000000-0000-0000-0000-0000000000c4', 'Lan', 'Vu');
insert into public.import_jobs (id, event_id, status) values
  ('20000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000c1', 'completed'),
  ('20000000-0000-0000-0000-0000000000c2', '80000000-0000-0000-0000-0000000000c2', 'completed'),
  ('20000000-0000-0000-0000-0000000000c3', '80000000-0000-0000-0000-0000000000c3', 'completed');
insert into public.import_job_rows (id, import_job_id, source_row_index, event_id, display_name, decision) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 0, '80000000-0000-0000-0000-0000000000c1', 'Ana Bui', 'review'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c1', 1, '80000000-0000-0000-0000-0000000000c1', 'Quan Ho', 'review'),
  ('30000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c1', 2, '80000000-0000-0000-0000-0000000000c1', 'Quan Ho', 'review'),
  ('30000000-0000-0000-0000-0000000000c5', '20000000-0000-0000-0000-0000000000c1', 4, '80000000-0000-0000-0000-0000000000c1', 'Duc Ha', 'review'),
  ('30000000-0000-0000-0000-0000000000c6', '20000000-0000-0000-0000-0000000000c2', 0, '80000000-0000-0000-0000-0000000000c2', 'Duc Ha', 'review'),
  ('30000000-0000-0000-0000-0000000000c7', '20000000-0000-0000-0000-0000000000c3', 0, '80000000-0000-0000-0000-0000000000c3', 'Anh Bui', 'review'),
  ('30000000-0000-0000-0000-0000000000c8', '20000000-0000-0000-0000-0000000000c1', 5, '80000000-0000-0000-0000-0000000000c1', 'Lan Vu', 'review');
SQL

as_admin() {
  local sub="$1" sql="$2"
  rtk psql "${psql_args[@]}" -d recovery -qtA -v ON_ERROR_STOP=0 2>&1 <<SQL
begin;
set local request.jwt.claim.sub = '$sub';
set local role authenticated;
$sql
commit;
SQL
}

# A holds the finding (and sleeps inside its transaction); B targets the same
# finding with a different member; C replays A's request id. B and C must wait
# for A, then B is rejected as stale and C returns A's result.
as_admin 00000000-0000-0000-0000-0000000000a1 "select public.admin_recover_import_row('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c1', 'restore', null, '10000000-0000-0000-0000-0000000000c1'); select pg_sleep(1.5);" \
  >"$runtime_dir/a.out" &
pid_a=$!
sleep 0.4
as_admin 00000000-0000-0000-0000-0000000000a2 "select public.admin_recover_import_row('40000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-0000000000c1', 'restore', null, '10000000-0000-0000-0000-0000000000c2');" \
  >"$runtime_dir/b.out" &
pid_b=$!
as_admin 00000000-0000-0000-0000-0000000000a1 "select public.admin_recover_import_row('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c1', 'restore', null, '10000000-0000-0000-0000-0000000000c1');" \
  >"$runtime_dir/c.out" &
pid_c=$!
# Two different findings creating a member with the same new email at once.
as_admin 00000000-0000-0000-0000-0000000000a1 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c2', 'create_member', null, null, null, '{\"first_name\": \"Quan\", \"last_name\": \"Ho\", \"email\": \"quan.ho@ucsd.edu\"}'); select pg_sleep(1.5);" \
  >"$runtime_dir/d.out" &
pid_d=$!
sleep 0.4
as_admin 00000000-0000-0000-0000-0000000000a2 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c3', 'create_member', null, null, null, '{\"first_name\": \"Quan\", \"last_name\": \"Ho\", \"email\": \"quan.ho@ucsd.edu\"}');" \
  >"$runtime_dir/e.out" &
pid_e=$!
# Two recoveries credit the same member on different events at once. Without a
# per-member lock, the second trigger recalculates from a snapshot that misses
# the first row, leaving the cached total short.
as_admin 00000000-0000-0000-0000-0000000000a1 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c5', 'restore', null, '10000000-0000-0000-0000-0000000000c3'); select pg_sleep(1.5);" \
  >"$runtime_dir/f.out" &
pid_f=$!
# An admin edits an event's points while a recovery for that event runs. Without
# the event read lock, the recovery inserts the old value after the cascade ran.
rtk psql "${psql_args[@]}" -d recovery -qtA -v ON_ERROR_STOP=0 -c "begin; update public.events set points = 15 where id = '80000000-0000-0000-0000-0000000000c3'; select pg_sleep(1.5); commit;" \
  >"$runtime_dir/h.out" 2>&1 &
pid_h=$!
sleep 0.4
as_admin 00000000-0000-0000-0000-0000000000a2 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c6', 'restore', null, '10000000-0000-0000-0000-0000000000c3');" \
  >"$runtime_dir/g.out" &
pid_g=$!
as_admin 00000000-0000-0000-0000-0000000000a2 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c7', 'restore', null, '10000000-0000-0000-0000-0000000000c2');" \
  >"$runtime_dir/i.out" &
pid_i=$!
# Admin Members (or the importer) credits Lan Vu on another event and is still
# committing when a recovery credits Lan Vu. The recovery must wait for it, or its
# trigger recalculates from a snapshot without that row.
rtk psql "${psql_args[@]}" -d recovery -qtA -v ON_ERROR_STOP=0 -c "begin; insert into public.member_event_attendance (member_id, event_id, points_earned) values ('10000000-0000-0000-0000-0000000000c4', '80000000-0000-0000-0000-0000000000c2', 7); select pg_sleep(1.5); commit;" \
  >"$runtime_dir/j.out" 2>&1 &
pid_j=$!
sleep 0.4
as_admin 00000000-0000-0000-0000-0000000000a1 "select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-0000000000c8', 'restore', null, '10000000-0000-0000-0000-0000000000c4');" \
  >"$runtime_dir/k.out" &
pid_k=$!
wait "$pid_a" "$pid_b" "$pid_c" "$pid_d" "$pid_e" "$pid_f" "$pid_g" "$pid_h" "$pid_i" "$pid_j" "$pid_k"

check() {
  local label="$1" cond="$2"
  if [ "$cond" = true ]; then
    printf 'PASS: %s\n' "$label"
  else
    printf 'FAIL: %s\n' "$label" >&2
    for f in a b c d e f g h i j k; do printf -- '--- %s\n' "$f" >&2; rtk cat "$runtime_dir/$f.out" >&2; done
    exit 1
  fi
}

grep -q '"outcome": "attendance_added"' "$runtime_dir/a.out" && a_ok=true || a_ok=false
check 'first concurrent admin restores the finding' "$a_ok"
grep -q 'changed since you opened it' "$runtime_dir/b.out" && b_ok=true || b_ok=false
check 'a concurrent second admin is rejected as stale after waiting' "$b_ok"
grep -q '"replayed": true' "$runtime_dir/c.out" && c_ok=true || c_ok=false
check 'a concurrent retry of the same request replays without writing' "$c_ok"
grep -q '"created_member": true' "$runtime_dir/d.out" && d_ok=true || d_ok=false
check 'first concurrent create with a new email succeeds' "$d_ok"
grep -q 'already has this email' "$runtime_dir/e.out" && e_ok=true || e_ok=false
check 'a concurrent create with the same email is refused after waiting' "$e_ok"

totals="$(rtk psql "${psql_args[@]}" -d recovery -qtA -c "
select
  (select points || '/' || events_attended from public.members where id = '10000000-0000-0000-0000-0000000000c3') || '|' ||
  (select points_earned from public.member_event_attendance
    where member_id = '10000000-0000-0000-0000-0000000000c2' and event_id = '80000000-0000-0000-0000-0000000000c3') || '|' ||
  (select points from public.members where id = '10000000-0000-0000-0000-0000000000c2')")"
[ "${totals%%|*}" = "17/2" ] && f_ok=true || f_ok=false
check "concurrent recoveries for one member on two events leave the right total (got ${totals%%|*}, want 17/2)" "$f_ok"
[ "${totals#*|}" = "15|15" ] && h_ok=true || h_ok=false
check "a recovery racing an event points edit stores the new value (got ${totals#*|}, want 15|15)" "$h_ok"
lan="$(rtk psql "${psql_args[@]}" -d recovery -qtA -c "select points || '/' || events_attended from public.members where id = '10000000-0000-0000-0000-0000000000c4'")"
[ "$lan" = "17/2" ] && k_ok=true || k_ok=false
check "a recovery that waits on another writer for the same member leaves the right total (got $lan, want 17/2)" "$k_ok"

result="$(rtk psql "${psql_args[@]}" -d recovery -qtA -c "
select
  (select count(*) from public.member_event_attendance where event_id = '80000000-0000-0000-0000-0000000000c1') || '|' ||
  (select points from public.members where id = '10000000-0000-0000-0000-0000000000c1') || '|' ||
  (select points from public.members where id = '10000000-0000-0000-0000-0000000000c2') || '|' ||
  (select count(*) from public.import_recovery_actions where import_job_row_id = '30000000-0000-0000-0000-0000000000c1') || '|' ||
  (select count(*) from public.members where email = 'quan.ho@ucsd.edu')")"
[ "$result" = "4|10|15|1|1" ] && ledger_ok=true || ledger_ok=false
check "concurrent attempts leave one credit per person, one history entry, one member per email (got $result)" "$ledger_ok"

cleanup
trap - EXIT
printf 'PASS: offline PostgreSQL cluster stopped and removed on exit.\n'
