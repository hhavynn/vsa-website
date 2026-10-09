#!/usr/bin/env bash
# Offline only: deterministic concurrency tests for migration
# 20261010000000_serialize_member_points_recalculation.sql on a disposable local
# cluster with no TCP listener. Never touches a hosted Supabase project.
# Synthetic people only.
#
#   baseline        production trigger bodies (fixture) + the recovery migration.
#                   Every race scenario must REPRODUCE a wrong end state here.
#   fixed           baseline + this migration. Every scenario must pass, every round.
#   mutant_nolock   fixed, with the members pre-lock removed from the recalculation.
#   mutant_noevent  fixed, without the event FOR SHARE trigger.
#                   Each mutant must fail the scenarios its protection covers.
#
# Ordering uses no sleeps. A session runs its writes inside a transaction, then
# holds that transaction open at a gate (it polls public.test_gate for its own
# name). The next session starts only once the previous one is at its gate,
# blocked on a lock, or finished. Gates are then released in start order.
#
# ROUNDS (default 3) repeats every scenario on the fixed database.
set -euo pipefail

# macOS postmaster aborts ("became multithreaded during startup") without a
# valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if ! command -v rtk >/dev/null 2>&1; then
  rtk() { "$@"; }
fi

rounds="${ROUNDS:-3}"
script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
for binary in initdb pg_ctl psql; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    printf 'Missing local PostgreSQL binary: %s\n' "$binary" >&2
    exit 1
  fi
done

runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-points.XXXXXX")"
cluster_dir="$runtime_dir/data"
out_dir="$runtime_dir/out"
mkdir -p "$out_dir"
cluster_started=false
cleanup() {
  if [ "$cluster_started" = true ]; then
    rtk pg_ctl -D "$cluster_dir" -m immediate -w stop >/dev/null
  fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT

rtk initdb -D "$cluster_dir" -U points_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$cluster_dir" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55442 -c deadlock_timeout=200ms" -w start >/dev/null
cluster_started=true

psql_args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55442 -U points_operator)
q() { rtk psql "${psql_args[@]}" -d "$1" -qtA -c "set client_min_messages = warning" -c "$2"; }

recovery_migration="$repo_dir/supabase/migrations/20261009000026_historical_attendance_recovery.sql"
migration="$repo_dir/supabase/migrations/20261010000000_serialize_member_points_recalculation.sql"

rtk psql "${psql_args[@]}" -d postgres -q <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
SQL

admin1='00000000-0000-0000-0000-0000000000f1'
admin2='00000000-0000-0000-0000-0000000000f2'

make_db() {
  local db="$1" with_fix="$2"
  q postgres "create database $db" >/dev/null
  local apply=(rtk psql "${psql_args[@]}" -d "$db" -q -c 'set client_min_messages = warning')
  "${apply[@]}" -f "$script_dir/sql/attendance-recovery.fixture.sql" -f "$recovery_migration"
  if [ "$with_fix" = true ]; then
    # Applied twice: the migration must be repeatable.
    "${apply[@]}" -f "$migration" -f "$migration"
  fi
  "${apply[@]}" -f - <<SQL
create table public.test_gate (name text primary key);
grant select on public.test_gate to anon, authenticated;
-- Test-only: slows each attendance row of a listed event (scenario 9).
create table public.test_slow_events (event_id uuid primary key);
grant select on public.test_slow_events to anon, authenticated;
create function public.test_slow_row() returns trigger language plpgsql as \$\$
begin
  if exists (select 1 from public.test_slow_events s where s.event_id = new.event_id) then
    perform pg_sleep(0.3);
  end if;
  return null;
end;
\$\$;
create trigger zz_test_slow_row after insert on public.member_event_attendance
  for each row execute function public.test_slow_row();
-- Production definition of smart_merge_members (pg_get_functiondef, read-only, 2026-10-08).
create function public.smart_merge_members(p_source_id uuid, p_target_id uuid)
returns void language plpgsql security definer set search_path to '' as \$function\$
declare
  v_source public.members%rowtype;
  v_target public.members%rowtype;
begin
  if not exists (select 1 from public.user_profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Permission denied: admin access required for smart_merge_members';
  end if;
  select * into v_source from public.members where id = p_source_id;
  if not found then raise exception 'Source member not found: %', p_source_id; end if;
  select * into v_target from public.members where id = p_target_id;
  if not found then raise exception 'Target member not found: %', p_target_id; end if;
  update public.members
  set college = coalesce(v_target.college, v_source.college),
      year = coalesce(v_target.year, v_source.year),
      email = coalesce(v_target.email, v_source.email),
      updated_at = now()
  where id = p_target_id;
  insert into public.member_event_attendance (member_id, event_id, points_earned, imported_at)
  select p_target_id, event_id, points_earned, imported_at
  from public.member_event_attendance where member_id = p_source_id
  on conflict (member_id, event_id) do nothing;
  delete from public.members where id = p_source_id;
end;
\$function\$;
insert into auth.users (id) values ('$admin1'), ('$admin2');
insert into public.user_profiles (id, is_admin) values ('$admin1', true), ('$admin2', true);
SQL
}

make_db baseline false
make_db fixed true
printf 'PASS: migration applies cleanly over the production fixture and is repeatable.\n'
make_db mutant_nolock true
q mutant_nolock "
create or replace function public.recalculate_members_points(p_member_ids uuid[])
returns void language plpgsql security definer set search_path = '' as \$f\$
begin
  update public.members m set
    points = coalesce((select sum(a.points_earned) from public.member_event_attendance a where a.member_id = m.id), 0),
    events_attended = (select count(*) from public.member_event_attendance a where a.member_id = m.id),
    updated_at = now()
  where m.id = any (p_member_ids);
end;
\$f\$;" >/dev/null
make_db mutant_noevent true
q mutant_noevent "drop trigger trg_attendance_points_from_event on public.member_event_attendance" >/dev/null
make_db rolled_back true
rtk psql "${psql_args[@]}" -d rolled_back -q -c 'set client_min_messages = warning' -f "$script_dir/sql/points-recalculation-rollback.sql"

# ── Sessions ──────────────────────────────────────────────────────────────────
as_admin() { printf "set local role authenticated; set local request.jwt.claim.sub = '%s'; " "$1"; }

# run_session DB NAME MODE BODY; MODE hold = writes then gate, start = gate then writes.
run_session() {
  local db="$1" name="$2" mode="$3" body="$4" sql
  local gate="do \$\$ begin loop exit when exists (select 1 from public.test_gate where name = '$name'); perform pg_sleep(0.005); end loop; end \$\$;"
  if [ "$mode" = hold ]; then
    sql="set application_name = '$name'; set statement_timeout = '30s'; begin; $body
set application_name = '$name-ready';
$gate
commit;"
  else
    sql="set application_name = '$name-ready'; set statement_timeout = '30s'; begin; $gate
set application_name = '$name';
$body
commit;"
  fi
  rtk psql "${psql_args[@]}" -d "$db" -qtA <<<"$sql" >"$out_dir/$name.out" 2>&1
}

session_state() {
  q postgres "select case
    when exists (select 1 from pg_stat_activity where application_name = '$1-ready') then 'ready'
    when exists (select 1 from pg_stat_activity where application_name = '$1' and wait_event_type = 'Lock') then 'blocked'
    else 'running' end"
}

wait_settled() {
  local name="$1" pid="$2" state i
  for i in $(seq 1 1200); do
    if ! kill -0 "$pid" 2>/dev/null; then echo exited; return; fi
    state="$(session_state "$name")"
    if [ "$state" != running ]; then echo "$state"; return; fi
    sleep 0.025
  done
  echo timeout
}

# race DB BODY...: sessions start in order, each after the previous one settles.
# Sets names[], states[] (ready|blocked|exited) and codes[] (psql exit codes).
race() {
  local db="$1" i=0 body name pid
  shift
  names=(); states=(); codes=(); local pids=()
  for body in "$@"; do
    name="${db}_${tag}_$i"
    run_session "$db" "$name" hold "$body" &
    pid=$!
    names+=("$name"); pids+=("$pid")
    states+=("$(wait_settled "$name" "$pid")")
    i=$((i + 1))
  done
  release_in_order "$db" "${pids[@]}"
}

# Releases gates in start order. Postgres does not promise that waiters on one
# row lock are woken in arrival order, so if the session being released is
# blocked behind a later session already at its gate, that one is released too.
release_in_order() {
  local db="$1" i k
  shift
  local pids=("$@") released=()
  for i in "${!names[@]}"; do
    if [ -z "${released[$i]:-}" ]; then
      q "$db" "insert into public.test_gate (name) values ('${names[$i]}')" >/dev/null
      released[$i]=1
    fi
    while kill -0 "${pids[$i]}" 2>/dev/null; do
      if [ "$(session_state "${names[$i]}")" = blocked ]; then
        for k in "${!names[@]}"; do
          if [ "$k" -gt "$i" ] && [ -z "${released[$k]:-}" ] && [ "$(session_state "${names[$k]}")" = ready ]; then
            q "$db" "insert into public.test_gate (name) values ('${names[$k]}')" >/dev/null
            released[$k]=1
          fi
        done
      fi
      sleep 0.025
    done
    if wait "${pids[$i]}"; then codes[$i]=0; else codes[$i]=$?; fi
  done
}

# simultaneous DB BODY...: every session waits at its gate, then all start at once.
simultaneous() {
  local db="$1" i=0 body name pid gates=""
  shift
  names=(); codes=(); local pids=()
  for body in "$@"; do
    name="${db}_${tag}_$i"
    run_session "$db" "$name" start "$body" &
    pid=$!
    names+=("$name"); pids+=("$pid")
    if [ "$(wait_settled "$name" "$pid")" != ready ]; then
      printf 'FAIL: session %s never reached its start gate\n' "$name" >&2
      exit 1
    fi
    gates="$gates${gates:+, }('$name')"
    i=$((i + 1))
  done
  q "$db" "insert into public.test_gate (name) values $gates" >/dev/null
  for i in "${!pids[@]}"; do
    if wait "${pids[$i]}"; then codes+=(0); else codes+=($?); fi
  done
}

session_output() { rtk cat "$out_dir/${names[$1]}.out"; }

# ── Assertions ────────────────────────────────────────────────────────────────
uid() { printf '%s%07d-%04d-4000-8000-%012d' "$1" "$round" "$scenario" "$2"; }

totals() {
  local db="$1" list="" id
  shift
  for id in "$@"; do list="$list${list:+, }'$id'::uuid"; done
  q "$db" "select string_agg(coalesce(m.points || '/' || m.events_attended, 'gone'), ',' order by u.o)
           from unnest(array[$list]) with ordinality as u(id, o) left join public.members m on m.id = u.id"
}

# Cached totals equal the ledger for every member of the current scenario, and
# every credit for its events carries the event's points.
ledger_consistent() {
  local scope
  scope="$(printf '%07d-%04d' "$round" "$scenario")"
  q "$1" "select
    (select count(*) from public.members m
      where substr(m.id::text, 2, 12) = '$scope'
        and (m.points <> coalesce((select sum(a.points_earned) from public.member_event_attendance a where a.member_id = m.id), 0)
          or m.events_attended <> (select count(*) from public.member_event_attendance a where a.member_id = m.id)))
    || '|' ||
    (select count(*) from public.member_event_attendance a join public.events e on e.id = a.event_id
      where substr(e.id::text, 2, 12) = '$scope' and a.points_earned is distinct from e.points)"
}

scenario_failures=0
check() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    printf '    ok    %s (got %s)\n' "$label" "$got"
  else
    printf '    WRONG %s (got %s, want %s)\n' "$label" "$got" "$want"
    scenario_failures=$((scenario_failures + 1))
  fi
}

setup() { q "$1" "$2" >/dev/null; }

# A control member credited on its own event; it must never change.
control_setup() {
  local db="$1"
  ctl="$(uid 1 99)"; ctl_event="$(uid 8 99)"
  setup "$db" "insert into public.events (id, name, points) values ('$ctl_event', 'S control', 3);
    insert into public.members (id, first_name, last_name) values ('$ctl', 'Control', 'Member');
    insert into public.member_event_attendance (member_id, event_id, points_earned) values ('$ctl', '$ctl_event', 3);"
  ctl_before="$(q "$db" "select points || '/' || events_attended || '@' || updated_at from public.members where id = '$ctl'")"
}
control_check() {
  check 'unrelated member untouched' \
    "$(q "$1" "select points || '/' || events_attended || '@' || updated_at from public.members where id = '$ctl'")" "$ctl_before"
}

ins() { printf "insert into public.member_event_attendance (member_id, event_id, points_earned) values %s on conflict (member_id, event_id) do nothing;" "$1"; }

# ── Scenarios ─────────────────────────────────────────────────────────────────
# Each takes a database and leaves scenario_failures > 0 when the end state is wrong.

s1() { # Two inserts for one member on different events.
  local db="$1" m1 e1 e2
  m1="$(uid 1 1)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S1 GBM', 10), ('$e2', 'S1 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');"
  race "$db" "$(ins "('$m1', '$e1', 10)")" "$(ins "('$m1', '$e2', 7)")"
  check 'two credits for one member, 10 + 7' "$(totals "$db" "$m1")" '17/2'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s2() { # Concurrent delete and insert for one member.
  local db="$1" m1 e1 e2
  m1="$(uid 1 1)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S2 GBM', 10), ('$e2', 'S2 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');
    $(ins "('$m1', '$e1', 10)")"
  race "$db" "delete from public.member_event_attendance where member_id = '$m1' and event_id = '$e1';" "$(ins "('$m1', '$e2', 7)")"
  check 'remove 10, add 7' "$(totals "$db" "$m1")" '7/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s3() { # A credit moves to another member while that member gains a credit.
  local db="$1" m1 x e1 e2
  m1="$(uid 1 1)"; x="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S3 GBM', 10), ('$e2', 'S3 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$x', 'Anh', 'Bui');
    $(ins "('$x', '$e1', 10)")"
  race "$db" "update public.member_event_attendance set member_id = '$m1' where member_id = '$x' and event_id = '$e1';" \
    "$(ins "('$m1', '$e2', 7)")"
  check 'new owner and previous owner' "$(totals "$db" "$m1" "$x")" '17/2,0/0'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s4() { # An event points edit races an insert for that event. $2: edit_first | insert_first
  local db="$1" order="$2" m1 m2 e1 edit add
  m1="$(uid 1 1)"; m2="$(uid 1 2)"; e1="$(uid 8 1)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S4 GBM', 10);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$m2', 'Anh', 'Bui');
    $(ins "('$m2', '$e1', 10)")"
  edit="update public.events set points = 15 where id = '$e1';"
  # The writer read 10 before the edit, as the importer and Admin Members do.
  add="$(ins "('$m1', '$e1', 10)")"
  if [ "$order" = edit_first ]; then race "$db" "$edit" "$add"; else race "$db" "$add" "$edit"; fi
  check "credits after the edit ($order)" "$(totals "$db" "$m1" "$m2")" '15/1,15/1'
  check 'stored credit values' "$(q "$db" "select string_agg(points_earned::text, ',' order by member_id) from public.member_event_attendance where event_id = '$e1'")" '15,15'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s5() { # Historical recovery and an import credit one member. $2: recovery_first | import_first
  local db="$1" order="$2" m1 m2 e1 e2 job row recover import
  m1="$(uid 1 1)"; m2="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"; job="$(uid 2 1)"; row="$(uid 3 1)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S5 GBM', 10), ('$e2', 'S5 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$m2', 'Anh', 'Bui');
    insert into public.import_jobs (id, event_id, status) values ('$job', '$e1', 'completed');
    insert into public.import_job_rows (id, import_job_id, source_row_index, event_id, display_name, decision)
      values ('$row', '$job', 0, '$e1', 'Ana Bui', 'review');"
  recover="$(as_admin "$admin1") select public.admin_recover_import_row(gen_random_uuid(), '$row', 'restore', null, '$m1');"
  import="$(as_admin "$admin2") $(ins "('$m1', '$e2', 7), ('$m2', '$e2', 7)")"
  if [ "$order" = recovery_first ]; then race "$db" "$recover" "$import"; else race "$db" "$import" "$recover"; fi
  local recovered=no i
  for i in "${!names[@]}"; do
    if session_output "$i" | grep -q '"outcome": "attendance_added"'; then recovered=yes; fi
  done
  check "recovery wrote its credit ($order)" "$recovered" yes
  check 'recovered + imported member, imported-only member' "$(totals "$db" "$m1" "$m2")" '17/2,7/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s6() { # Two members on the same event at once: neither waits for the other.
  local db="$1" m1 m2 e1
  m1="$(uid 1 1)"; m2="$(uid 1 2)"; e1="$(uid 8 1)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S6 GBM', 10);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$m2', 'Anh', 'Bui');"
  race "$db" "$(ins "('$m1', '$e1', 10)")" "$(ins "('$m2', '$e1', 10)")"
  check 'second writer did not wait on the first' "${states[1]}" ready
  check 'both members credited once' "$(totals "$db" "$m1" "$m2")" '10/1,10/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s7() { # The same credit written twice at once, then the import repeated.
  local db="$1" m1 e1
  m1="$(uid 1 1)"; e1="$(uid 8 1)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S7 GBM', 10);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');"
  race "$db" "$(ins "('$m1', '$e1', 10)")" "$(ins "('$m1', '$e1', 10)")"
  setup "$db" "$(ins "('$m1', '$e1', 10)")"
  check 'one credit, no double award' "$(totals "$db" "$m1")" '10/1'
  check 'one ledger row' "$(q "$db" "select count(*) from public.member_event_attendance where member_id = '$m1'")" 1
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s8() { # Two admins in Admin Members (RLS path): add, remove and add for one member.
  local db="$1" m1 e0 e1 e2
  m1="$(uid 1 1)"; e0="$(uid 8 3)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e0', 'S8 Retreat', 5), ('$e1', 'S8 GBM', 10), ('$e2', 'S8 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');
    $(ins "('$m1', '$e0', 5)")"
  race "$db" \
    "$(as_admin "$admin1") $(ins "('$m1', '$e1', 10)")" \
    "$(as_admin "$admin2") delete from public.member_event_attendance where member_id = '$m1' and event_id = '$e0';" \
    "$(as_admin "$admin1") $(ins "('$m1', '$e2', 7)")"
  check 'add 10, remove 5, add 7' "$(totals "$db" "$m1")" '17/2'
  check 'every admin write committed' "${codes[*]}" '0 0 0'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s9() { # Two bulk imports credit the same two members in opposite row order.
  local db="$1" m1 m2 e1 e2 deadlocks i
  m1="$(uid 1 1)"; m2="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S9 GBM', 10), ('$e2', 'S9 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$m2', 'Anh', 'Bui');
    insert into public.test_slow_events (event_id) values ('$e1'), ('$e2');"
  simultaneous "$db" "$(ins "('$m1', '$e1', 10), ('$m2', '$e1', 10)")" "$(ins "('$m2', '$e2', 7), ('$m1', '$e2', 7)")"
  deadlocks=0
  for i in "${!names[@]}"; do
    if session_output "$i" | grep -q 'deadlock detected'; then deadlocks=$((deadlocks + 1)); fi
  done
  check 'no deadlock' "$deadlocks" 0
  check 'both imports applied' "$(totals "$db" "$m1" "$m2")" '17/2,17/2'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s10() { # A member merge races a new credit for the merge target. $2: merge_first | insert_first
  local db="$1" order="$2" src tgt e1 e2 e3 merge add
  src="$(uid 1 1)"; tgt="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"; e3="$(uid 8 3)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S10 GBM', 10), ('$e2', 'S10 Social', 7), ('$e3', 'S10 Retreat', 5);
    insert into public.members (id, first_name, last_name) values ('$src', 'Ana', 'Bui'), ('$tgt', 'Anh', 'Bui');
    $(ins "('$src', '$e1', 10), ('$src', '$e2', 7), ('$tgt', '$e1', 10)")"
  merge="$(as_admin "$admin1") select public.smart_merge_members('$src', '$tgt');"
  add="$(as_admin "$admin2") $(ins "('$tgt', '$e3', 5)")"
  if [ "$order" = merge_first ]; then race "$db" "$merge" "$add"; else race "$db" "$add" "$merge"; fi
  check "merged member keeps every credit once ($order)" "$(totals "$db" "$src" "$tgt")" 'gone,22/3'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s11() { # An event is deleted (FK cascade) while its attendee gains another credit.
  local db="$1" m1 e1 e2
  m1="$(uid 1 1)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S11 Cancelled', 10), ('$e2', 'S11 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');
    $(ins "('$m1', '$e1', 10)")"
  race "$db" "delete from public.events where id = '$e1';" "$(ins "('$m1', '$e2', 7)")"
  check 'deleted event removed, new credit kept' "$(totals "$db" "$m1")" '7/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s12() { # A REPEATABLE READ caller races a writer for the same member.
  local db="$1" m1 e1 e2 aborted=no
  m1="$(uid 1 1)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S12 GBM', 10), ('$e2', 'S12 Social', 7);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui');"
  race "$db" "$(ins "('$m1', '$e1', 10)")" "set transaction isolation level repeatable read; $(ins "('$m1', '$e2', 7)")"
  if session_output 1 | grep -q 'could not serialize access'; then aborted=yes; fi
  check 'repeatable-read writer aborts with a serialization error' "$aborted" yes
  check 'only the committed credit counts' "$(totals "$db" "$m1")" '10/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

s13() { # An ON CONFLICT DO UPDATE upsert (one update, one insert) races an insert.
  local db="$1" m1 m2 e1 e2 e3
  m1="$(uid 1 1)"; m2="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"; e3="$(uid 8 3)"
  control_setup "$db"
  setup "$db" "insert into public.events (id, name, points) values ('$e1', 'S13 GBM', 10), ('$e2', 'S13 Social', 7), ('$e3', 'S13 Retreat', 5);
    insert into public.members (id, first_name, last_name) values ('$m1', 'Ana', 'Bui'), ('$m2', 'Anh', 'Bui');
    $(ins "('$m1', '$e1', 10)")"
  # m1's existing credit takes the DO UPDATE path; m2's is a plain insert.
  race "$db" "$(ins "('$m1', '$e3', 5)")" \
    "insert into public.member_event_attendance (member_id, event_id, points_earned) values ('$m1', '$e1', 10), ('$m2', '$e2', 7)
       on conflict (member_id, event_id) do update set imported_at = excluded.imported_at;"
  check 'updated member keeps both credits, inserted member credited' "$(totals "$db" "$m1" "$m2")" '15/2,7/1'
  check 'cache matches ledger' "$(ledger_consistent "$db")" '0|0'
  control_check "$db"
}

scenario_names=(
  '' 's1 two inserts, one member' 's2 insert + delete' 's3 ownership move + insert'
  's4 points edit, then insert' 's4 insert, then points edit'
  's5 recovery, then import' 's5 import, then recovery'
  's6 independent members' 's7 duplicate credits' 's8 two admins, Admin Members' 's9 opposite-order bulk imports'
  's10 merge, then insert for the target' 's10 insert for the target, then merge' 's11 event delete + insert'
  's12 repeatable-read caller' 's13 upsert DO UPDATE + insert'
)
run_scenario() { # DB NUMBER
  local db="$1" n="$2"
  scenario="$n"; tag="r${round}s$n"; scenario_failures=0
  printf '  [%s] %s\n' "$db" "${scenario_names[$n]}"
  case "$n" in
    1) s1 "$db" ;; 2) s2 "$db" ;; 3) s3 "$db" ;;
    4) s4 "$db" edit_first ;; 5) s4 "$db" insert_first ;;
    6) s5 "$db" recovery_first ;; 7) s5 "$db" import_first ;;
    8) s6 "$db" ;; 9) s7 "$db" ;; 10) s8 "$db" ;; 11) s9 "$db" ;;
    12) s10 "$db" merge_first ;; 13) s10 "$db" insert_first ;; 14) s11 "$db" ;;
    15) s12 "$db" ;; 16) s13 "$db" ;;
  esac
}

failed=false
fail() { printf 'FAIL: %s\n' "$1" >&2; failed=true; }

# Baseline: the race scenarios must reproduce the bug against production's triggers.
round=1
printf '\nBaseline (production triggers): expect the races to leave wrong totals\n'
all_scenarios='1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16'
reproducing='1 2 3 4 5 6 10 11 12 14 16'
for n in $all_scenarios; do
  run_scenario baseline "$n"
  if [[ " $reproducing " == *" $n "* ]]; then
    if [ "$scenario_failures" -gt 0 ]; then
      printf 'REPRODUCED: %s\n' "${scenario_names[$n]}"
    else
      fail "baseline did not reproduce: ${scenario_names[$n]}"
    fi
  elif [ "$scenario_failures" -gt 0 ]; then
    fail "baseline scenario expected to pass: ${scenario_names[$n]}"
  fi
done

# Fixed: every scenario, every round.
for round in $(seq 1 "$rounds"); do
  printf '\nFixed, round %s of %s\n' "$round" "$rounds"
  for n in ${SCENARIOS:-$all_scenarios}; do
    run_scenario fixed "$n"
    if [ "$scenario_failures" -gt 0 ]; then
      fail "fixed round $round: ${scenario_names[$n]}"
      for i in "${!names[@]}"; do printf -- '--- %s (exit %s)\n' "${names[$i]}" "${codes[$i]}" >&2; session_output "$i" >&2; done
    fi
  done
done
[ "$failed" = false ] && printf 'PASS: every scenario passes on the fixed schema in %s rounds.\n' "$rounds"

# Mutants: removing one protection must break the scenarios it covers.
round=1
printf '\nMutant: members pre-lock removed\n'
for n in 1 2 3 10 12 14 16; do
  run_scenario mutant_nolock "$n"
  if [ "$scenario_failures" -gt 0 ]; then printf 'KILLED: %s\n' "${scenario_names[$n]}"
  else fail "mutant_nolock survived: ${scenario_names[$n]}"; fi
done
printf '\nMutant: event FOR SHARE trigger removed\n'
for n in 4 5; do
  run_scenario mutant_noevent "$n"
  if [ "$scenario_failures" -gt 0 ]; then printf 'KILLED: %s\n' "${scenario_names[$n]}"
  else fail "mutant_noevent survived: ${scenario_names[$n]}"; fi
done

# Rollback: keeps the lock (no lost updates) but brings back the other three causes.
printf '\nRollback (scripts/sql/points-recalculation-rollback.sql)\n'
for n in 1 10; do
  run_scenario rolled_back "$n"
  if [ "$scenario_failures" -gt 0 ]; then fail "rollback lost an update: ${scenario_names[$n]}"; fi
done
for n in 3 4 11; do
  run_scenario rolled_back "$n"
  if [ "$scenario_failures" -gt 0 ]; then printf 'AS DOCUMENTED: rollback restores %s\n' "${scenario_names[$n]}"
  else fail "rollback unexpectedly passes: ${scenario_names[$n]}"; fi
done
check_rollback_triggers="$(q rolled_back "select string_agg(tgname, ',' order by tgname) from pg_trigger
  where tgrelid = 'public.member_event_attendance'::regclass and not tgisinternal and tgname like 'trg_%'")"
if [ "$check_rollback_triggers" = trg_sync_member_points ]; then printf 'PASS: rollback leaves only the original row trigger.\n'
else fail "rollback triggers: $check_rollback_triggers"; fi

# ── Sequential regressions on the fixed schema ────────────────────────────────
printf '\nSequential regressions (fixed)\n'
round=9; scenario=90; scenario_failures=0
src="$(uid 1 1)"; tgt="$(uid 1 2)"; e1="$(uid 8 1)"; e2="$(uid 8 2)"; gone_event="$(uid 8 3)"
setup fixed "insert into public.events (id, name, points) values ('$e1', 'S90 GBM', 10), ('$e2', 'S90 Social', 7), ('$gone_event', 'S90 Cancelled', 4);
  insert into public.members (id, first_name, last_name) values ('$src', 'Ana', 'Bui'), ('$tgt', 'Anh', 'Bui');
  $(ins "('$src', '$e1', 10), ('$src', '$e2', 7), ('$tgt', '$e1', 10), ('$tgt', '$gone_event', 4)")"
check 'bulk insert recalculates each member once' "$(totals fixed "$src" "$tgt")" '17/2,14/2'
setup fixed "delete from public.events where id = '$gone_event'"
check 'deleting an event (FK cascade) recalculates its attendees' "$(totals fixed "$tgt")" '10/1'
setup fixed "begin; $(as_admin "$admin1") select public.smart_merge_members('$src', '$tgt'); commit;"
check 'smart_merge_members moves credits without double counting' "$(totals fixed "$src" "$tgt")" 'gone,17/2'
# Documented rule change: a merged credit is stored at the event's current points.
stale_src="$(uid 1 3)"; stale_tgt="$(uid 1 4)"
setup fixed "insert into public.members (id, first_name, last_name) values ('$stale_src', 'Bao', 'Vo'), ('$stale_tgt', 'Bao', 'Vo');
  $(ins "('$stale_src', '$e2', 7)")
  update public.member_event_attendance set points_earned = 1 where member_id = '$stale_src';"
check 'a direct points_earned update is stored as written' "$(totals fixed "$stale_src")" '1/1'
setup fixed "begin; $(as_admin "$admin1") select public.smart_merge_members('$stale_src', '$stale_tgt'); commit;"
check 'merging a credit stored off its event value stores the event value' "$(totals fixed "$stale_tgt")" '7/1'
setup fixed "update public.events set points = 12 where id = '$e1'"
check 'an event points edit cascades to cached totals' "$(totals fixed "$tgt")" '19/2'
setup fixed "update public.member_event_attendance set points_earned = points_earned where member_id = '$tgt'"
check 'a no-op update leaves totals unchanged' "$(totals fixed "$tgt")" '19/2'
check 'anon has no write privilege on member_event_attendance' "$(q fixed "select count(*) from (values ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv)
  where has_table_privilege('anon', 'public.member_event_attendance', p.priv)")" 0
check 'anon/authenticated cannot execute the new functions' "$(q fixed "select count(*) from (values
    ('public.recalculate_members_points(uuid[])'), ('public.recalculate_member_points(uuid)'),
    ('public.sync_member_points_for_statement()'), ('public.attendance_points_from_event()')) f(sig),
    (values ('anon'), ('authenticated')) r(role)
  where has_function_privilege(r.role, f.sig, 'execute')")" 0
check 'the old row trigger is gone, the four new triggers exist' "$(q fixed "select string_agg(tgname, ',' order by tgname) from pg_trigger
  where tgrelid = 'public.member_event_attendance'::regclass and not tgisinternal and tgname like 'trg_%'")" \
  'trg_attendance_points_from_event,trg_sync_member_points_delete,trg_sync_member_points_insert,trg_sync_member_points_update'
check 'read-only integrity check reports no drift on the fixed database' \
  "$(rtk psql "${psql_args[@]}" -d fixed -qtA -F '|' -f "$script_dir/sql/points-integrity-check.sql" | rtk sed -n 's/^summary|//p')" \
  "0|0|0|$(q fixed "select count(*) || '|' || (select count(*) from public.member_event_attendance) from public.members")"
if [ "$scenario_failures" -gt 0 ]; then fail 'sequential regressions'; fi

# ── Performance (informational) ───────────────────────────────────────────────
printf '\nPerformance: 500-credit import and a points edit over 500 credits\n'
for db in baseline fixed; do
  q "$db" "
    insert into public.events (id, name, points) values ('99999999-0000-4000-8000-000000000001', 'S perf', 10);
    insert into public.members (id, first_name, last_name)
      select ('99999999-0001-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Perf', 'Member ' || g from generate_series(1, 500) g;" >/dev/null
  timing="$(rtk psql "${psql_args[@]}" -d "$db" -qtA -c "
    do \$\$
    declare t timestamptz;
    begin
      t := clock_timestamp();
      insert into public.member_event_attendance (member_id, event_id, points_earned)
        select ('99999999-0001-4000-8000-' || lpad(g::text, 12, '0'))::uuid, '99999999-0000-4000-8000-000000000001', 10
        from generate_series(1, 500) g;
      raise notice 'import %ms', round(extract(epoch from clock_timestamp() - t) * 1000);
      t := clock_timestamp();
      update public.events set points = 11 where id = '99999999-0000-4000-8000-000000000001';
      raise notice 'edit %ms', round(extract(epoch from clock_timestamp() - t) * 1000);
    end \$\$;" 2>&1 | rtk sed -n 's/^.*NOTICE:  //p' | tr '\n' ' ')"
  printf '  %-8s %s\n' "$db" "$timing"
done

printf '\nRegression: historical recovery suite with this migration applied\n'
if VSA_EXTRA_MIGRATIONS="$migration" bash "$script_dir/test-attendance-recovery.sh" >"$runtime_dir/recovery.log" 2>&1; then
  printf 'PASS: test-attendance-recovery.sh (%s checks) passes with this migration.\n' "$(rtk grep -c '^PASS' "$runtime_dir/recovery.log")"
else
  rtk cat "$runtime_dir/recovery.log" >&2
  fail 'test-attendance-recovery.sh with this migration'
fi

if [ "$failed" = true ]; then
  exit 1
fi
cleanup
trap - EXIT
printf '\nPASS: offline PostgreSQL cluster stopped and removed on exit.\n'
