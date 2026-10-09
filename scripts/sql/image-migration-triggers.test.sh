#!/bin/bash
# Verifies supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql
# against a disposable LOCAL Postgres (superuser "postgres", trust auth), using the
# synthetic stub in image-migration-triggers.fixture.sql. Creates and drops its
# own database (vsa_image_trigger_test) and creates cluster-wide stub roles.
#
#   initdb -D /tmp/pg -A trust -U postgres
#   LC_ALL=C pg_ctl -D /tmp/pg -o "-p 54329 -c listen_addresses=127.0.0.1" start
#   PGPORT=54329 scripts/sql/image-migration-triggers.test.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql"
FIXTURE="$ROOT/scripts/sql/image-migration-triggers.fixture.sql"
HOST="${PGHOST:-127.0.0.1}"
case "$HOST" in 127.0.0.1|localhost|::1) ;; *) echo "Refusing non-local PGHOST=$HOST"; exit 2 ;; esac
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
P="psql -h $HOST -p ${PGPORT:-5432} -X -q -v ON_ERROR_STOP=1"
pass=0; fail=0
ok()   { echo "PASS  $1"; pass=$((pass+1)); }
bad()  { echo "FAIL  $1"; fail=$((fail+1)); }
q()    { $P -U postgres -d vsa_image_trigger_test -Atc "$1"; }
expect() { local got; got="$(q "$2")"; [ "$got" = "$3" ] && ok "$1" || bad "$1 (got '$got', want '$3')"; }

$P -U postgres -d postgres -c "drop database if exists vsa_image_trigger_test" -c "create database vsa_image_trigger_test" >/dev/null
# Roles are cluster-wide: create once, tolerate re-runs.
$P -U postgres -d vsa_image_trigger_test -f "$FIXTURE" >/dev/null || { echo "fixture setup failed"; exit 1; }

echo "== 1. Legacy webhooks present, Vault empty: migration must abort and change nothing"
if $P -U app_owner -d vsa_image_trigger_test --single-transaction -f "$MIG" >/dev/null 2>"$DIR/err1.txt"; then
  bad "migration applied without Vault secrets"
else
  grep -q "Create Vault secrets" "$DIR/err1.txt" && ok "aborts with the Vault-secrets message" || bad "unexpected error: $(cat "$DIR/err1.txt")"
fi
expect "legacy triggers still present after abort" \
  "select count(*) from pg_trigger where tgname in ('event-image-migration','house-event-image-migration')" "2"
expect "no private schema left behind" "select count(*) from pg_namespace where nspname='private'" "0"

echo "== 2. Configure Vault, apply as the non-superuser owner"
q "insert into vault.secrets(name, secret) values
   ('image_migration_functions_url','https://example.supabase.co/functions/v1/'),
   ('image_migration_webhook_secret','NEWSECRETabc123')" >/dev/null
if $P -U app_owner -d vsa_image_trigger_test --single-transaction -f "$MIG" >/dev/null 2>"$DIR/err2.txt"; then ok "migration applies"; else bad "migration failed: $(cat "$DIR/err2.txt")"; fi
expect "legacy Dashboard triggers dropped" \
  "select count(*) from pg_trigger where tgname in ('event-image-migration','house-event-image-migration')" "0"
expect "new triggers exist and are enabled" \
  "select string_agg(tgname || ':' || tgenabled::text, ',' order by tgname) from pg_trigger where tgname like 'request_%image_migration'" \
  "request_event_image_migration:O,request_house_event_image_migration:O"
expect "no trigger anywhere calls supabase_functions.http_request" \
  "select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where n.nspname='supabase_functions'" "0"
expect "no trigger definition contains the Vault secret value" \
  "select count(*) from pg_trigger t, vault.decrypted_secrets s where s.name='image_migration_webhook_secret' and position(s.decrypted_secret in pg_get_triggerdef(t.oid))>0" "0"
expect "no function definition contains the Vault secret value" \
  "select count(*) from pg_proc p, vault.decrypted_secrets s where s.name='image_migration_webhook_secret' and p.prokind='f' and position(s.decrypted_secret in p.prosrc)>0" "0"
expect "trigger defs carry no authorization/JWT/secret header" \
  "select bool_or(pg_get_triggerdef(oid) ~* 'authorization|x-image-migration-secret' or pg_get_triggerdef(oid) ~ 'eyJ') from pg_trigger where not tgisinternal" "f"
expect "function is SECURITY DEFINER with search_path=''" \
  "select prosecdef::text || ' ' || array_to_string(proconfig, ',') from pg_proc where proname='request_image_migration'" "true search_path=\"\""
expect "anon/authenticated/PUBLIC cannot EXECUTE the trigger function" \
  "select bool_or(has_function_privilege(r, 'private.request_image_migration()', 'EXECUTE')) from unnest(array['anon','authenticated']) r" "f"
expect "anon/authenticated have no USAGE on schema private" \
  "select bool_or(has_schema_privilege(r, 'private', 'USAGE')) from unnest(array['anon','authenticated']) r" "f"
expect "authenticated still cannot read vault.decrypted_secrets" \
  "select has_table_privilege('authenticated','vault.decrypted_secrets','SELECT')" "f"

echo "== 3. Behaviour as an authenticated writer (admin through RLS)"
q "truncate net.calls" >/dev/null
W() { $P -U postgres -d vsa_image_trigger_test -Atc "set role authenticated; $1" >/dev/null 2>>"$DIR/warn.txt"; }
: > "$DIR/warn.txt"
STO='https://abc.supabase.co/storage/v1/object/public/event_images/a.jpg'
STO2='https://abc.supabase.co/storage/v1/object/public/event_images/b.jpg'
W "insert into public.events(id,name,image_url) values ('00000000-0000-0000-0000-000000000001','E1','$STO')"
expect "INSERT with Storage URL queues exactly one request" "select count(*) from net.calls" "1"
expect "request URL targets trigger-event-image-migration (trailing slash trimmed)" \
  "select url from net.calls order by id desc limit 1" "https://example.supabase.co/functions/v1/trigger-event-image-migration"
expect "headers are exactly Content-Type + x-image-migration-secret (no Authorization)" \
  "select string_agg(k, ',' order by k) from net.calls c, jsonb_object_keys(c.headers) k where c.id=(select max(id) from net.calls)" "Content-Type,x-image-migration-secret"
expect "secret header equals the Vault value" \
  "select (headers->>'x-image-migration-secret') = (select decrypted_secret from vault.decrypted_secrets where name='image_migration_webhook_secret') from net.calls order by id desc limit 1" "t"
expect "INSERT payload matches the webhook shape the function reads" \
  "select body::text from net.calls order by id desc limit 1" \
  "{\"type\": \"INSERT\", \"table\": \"events\", \"record\": {\"id\": \"00000000-0000-0000-0000-000000000001\", \"image_url\": \"$STO\"}, \"schema\": \"public\", \"old_record\": null}"
W "update public.events set name='E1 renamed' where name='E1'"
expect "UPDATE of another column queues nothing" "select count(*) from net.calls" "1"
W "update public.events set image_url=image_url where name='E1 renamed'"
expect "UPDATE that rewrites the same image_url queues nothing" "select count(*) from net.calls" "1"
W "update public.events set image_url='$STO2' where name='E1 renamed'"
expect "UPDATE to a new Storage URL queues one request" "select count(*) from net.calls" "2"
expect "UPDATE payload carries old_record.image_url" \
  "select body->'old_record'->>'image_url' || '|' || (body->>'type') from net.calls order by id desc limit 1" "$STO|UPDATE"
W "update public.events set image_url='/images/events/e1.webp' where name='E1 renamed'"
expect "UPDATE to a repo-hosted /images path (phase-2 relink) queues nothing" "select count(*) from net.calls" "2"
W "insert into public.events(name,image_url) values ('E2',null)"
W "insert into public.events(name,image_url) values ('E3','')"
expect "INSERT without an image queues nothing" "select count(*) from net.calls" "2"
W "insert into public.house_events(title,image_url) values ('H1','$STO')"
expect "house_events INSERT targets trigger-house-event-image-migration" \
  "select url || '|' || (body->>'table') from net.calls order by id desc limit 1" \
  "https://example.supabase.co/functions/v1/trigger-house-event-image-migration|house_events"
$P -U postgres -d vsa_image_trigger_test -Atc "set role service_role; update public.events set image_url='$STO' where name='E2'" >/dev/null 2>&1
expect "service_role writes (migration workflow) also fire" "select count(*) from net.calls" "4"

echo "== 4. Never blocks a write"
q "update vault.secrets set secret='' where name='image_migration_webhook_secret'" >/dev/null
W "insert into public.events(name,image_url) values ('E4','$STO')"
expect "missing Vault secret: row still saved" "select count(*) from public.events where name='E4'" "1"
expect "missing Vault secret: nothing queued" "select count(*) from net.calls" "4"
grep -q "Vault secrets not configured" "$DIR/warn.txt" && ok "missing Vault secret raises a WARNING" || bad "no WARNING for missing secret"
q "update vault.secrets set secret='NEWSECRETabc123' where name='image_migration_webhook_secret'" >/dev/null
: > "$DIR/warn.txt"
$P -U postgres -d vsa_image_trigger_test -Atc "set stub.net_fail='on'; set role authenticated; insert into public.events(name,image_url) values ('E5','$STO')" >/dev/null 2>>"$DIR/warn.txt"
expect "pg_net failure: row still saved" "select count(*) from public.events where name='E5'" "1"
grep -q "failed (SQLSTATE P0001)" "$DIR/warn.txt" && ok "pg_net failure raises a SQLSTATE-only WARNING" || bad "unexpected warning: $(cat "$DIR/warn.txt")"
grep -q "stub pg_net failure\|NEWSECRET\|example.supabase.co" "$DIR/warn.txt" && bad "warning leaked request details" || ok "warning does not echo URL, secret or error text"
if $P -U postgres -d vsa_image_trigger_test -Atc "set role authenticated; select private.request_image_migration()" >/dev/null 2>&1; then bad "direct call allowed"; else ok "direct call refused"; fi

echo "== 5. Idempotent re-apply, and a fresh DB with no webhooks and no Vault secrets"
if $P -U app_owner -d vsa_image_trigger_test --single-transaction -f "$MIG" >/dev/null 2>&1; then ok "re-apply succeeds"; else bad "re-apply failed"; fi
expect "still exactly two image-migration triggers" "select count(*) from pg_trigger where tgname like 'request_%image_migration'" "2"
q "drop trigger request_event_image_migration on public.events; drop trigger request_house_event_image_migration on public.house_events; drop schema private cascade; truncate vault.secrets" >/dev/null
if $P -U app_owner -d vsa_image_trigger_test --single-transaction -f "$MIG" >/dev/null 2>&1; then ok "applies on a DB without Dashboard webhooks or Vault secrets (local/branches)"; else bad "fresh apply failed"; fi

$P -U postgres -d postgres -c "drop database vsa_image_trigger_test" >/dev/null
echo; echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
