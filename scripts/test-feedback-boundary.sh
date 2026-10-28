#!/usr/bin/env bash
# Disposable local PostgreSQL only; no linked project, network listener or real data.
set -euo pipefail
if ! command -v rtk >/dev/null 2>&1; then rtk() { "$@"; }; fi
script_dir="$(cd "$(rtk dirname "${BASH_SOURCE[0]}")" && pwd)"
runtime_dir="$(rtk mktemp -d "${TMPDIR:-/tmp}/vsa-feedback.XXXXXX")"
started=false
cleanup() {
  if [ "$started" = true ]; then rtk pg_ctl -D "$runtime_dir/data" -m immediate -w stop >/dev/null; fi
  rtk rm -rf "$runtime_dir"
}
trap cleanup EXIT
rtk initdb -D "$runtime_dir/data" -U feedback_test_operator -A trust --no-locale >/dev/null
rtk pg_ctl -D "$runtime_dir/data" -l "$runtime_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$runtime_dir' -p 55443" -w start >/dev/null
started=true
args=(-X -v ON_ERROR_STOP=1 -h "$runtime_dir" -p 55443 -U feedback_test_operator -d postgres)
rtk psql "${args[@]}" -q -f "$script_dir/sql/feedback-boundary.test.sql"
pids=()
for i in {1..20}; do
  rtk psql "${args[@]}" -q -c "set role service_role; set request.jwt.claim.role = 'service_role'; select public.submit_feedback_guarded('bug','Concurrent','Synthetic feedback');" >"$runtime_dir/caller-$i.log" 2>&1 &
  pids+=("$!")
done
successes=0
for pid in "${pids[@]}"; do if wait "$pid"; then successes=$((successes + 1)); fi; done
if [ "$successes" != 1 ]; then printf 'FAIL: expected one admission, got %s\n' "$successes"; exit 1; fi
rtk psql "${args[@]}" -q <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM public.feedback) <> 1 OR
    (SELECT submissions FROM private.feedback_submission_budgets WHERE bucket = 'global') <> 1 THEN
    RAISE EXCEPTION 'concurrent global ceiling bypassed';
  END IF;
END $$;
SQL
printf 'PASS: 20 concurrent requests respect global ceiling; disposable cluster removed.\n'
