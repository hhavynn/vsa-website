"""Regression checks against an explicitly supplied disposable local PostgreSQL DB."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse

url = os.environ.get("AI_QUOTA_TEST_DATABASE_URL", "")
parsed = urlparse(url)
if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not parsed.path.startswith("/ai_quota_test"):
    raise SystemExit("Set AI_QUOTA_TEST_DATABASE_URL to a disposable local ai_quota_test database; no .env is read")


def sql(statement, service=False):
    if service:
        statement = "set request.jwt.claim.role = 'service_role'; set role service_role; " + statement
    result = subprocess.run(["psql", url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-Atc", statement], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def hashed(value):
    return hashlib.sha256(value.encode()).hexdigest()


def reserve(session, ip=None):
    ip_arg = "null" if ip is None else "'" + hashed(ip) + "'"
    return json.loads(sql("select public.reserve_ai_quota('" + hashed(session) + "', " + ip_arg + ")", True))


def reset():
    sql("truncate public.ai_chat_usage_logs, public.ai_chat_quota_reservations")


sql("""
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as
  $$ select current_setting('request.jwt.claim.role', true) $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
create table public.ai_chat_usage_logs (
 id uuid primary key default gen_random_uuid(), session_id_hash text not null,
 ip_hash text, message_count integer not null default 1, blocked_reason text,
 matched_knowledge_ids uuid[] not null default '{}', created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'
);
-- Model Supabase defaults to prove explicit revocations, not absent grants.
alter default privileges in schema public grant all on tables to anon, authenticated;
""")
migration = Path(__file__).resolve().parents[2] / "migrations" / "20261001000300_atomic_ai_quota.sql"
sql(migration.read_text())

for role in ["anon", "authenticated"]:
    assert sql("select has_function_privilege('" + role + "','public.reserve_ai_quota(text,text)','EXECUTE')") == "f"
    assert sql("select has_function_privilege('" + role + "','public.complete_ai_quota(uuid,text,integer,uuid[],text,text)','EXECUTE')") == "f"
    assert sql("select has_table_privilege('" + role + "','public.ai_chat_quota_reservations','SELECT,INSERT,UPDATE,DELETE')") == "f"
try:
    sql("select public.reserve_ai_quota('" + hashed("guard") + "',null)")
    raise AssertionError("Function owner without service JWT bypassed internal guard")
except RuntimeError as error:
    assert "Service role required" in str(error)
try:
    sql("begin isolation level repeatable read; select public.reserve_ai_quota('" + hashed("snapshot") + "',null)", True)
    raise AssertionError("Unsupported isolation admitted work")
except RuntimeError as error:
    assert "read committed isolation" in str(error)
print("PASS ACLs, internal service-role guard, unsupported isolation fails closed")

with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    admissions = list(pool.map(lambda _: reserve("same-session", "same-ip"), range(16)))
assert sum(a["reservation_id"] is not None for a in admissions) == 2, admissions
print("PASS 16 concurrent session admissions allow exactly 2")

reservation = next(a["reservation_id"] for a in admissions if a["reservation_id"])
completion = "select public.complete_ai_quota('" + reservation + "','answered',20,'{}'::uuid[],null,null)"
sql(completion, True)
sql(completion, True)
assert sql("select count(*) from public.ai_chat_usage_logs") == "1"
assert sql("select count(*) from public.ai_chat_quota_reservations") == "2"
# Move both admissions back past burst window; count completion once plus hold once.
sql("update public.ai_chat_quota_reservations set created_at=now()-interval '6 minutes'; update public.ai_chat_usage_logs set created_at=now()-interval '6 minutes'")
assert reserve("same-session", "same-ip")["reservation_id"] is not None
assert reserve("same-session", "same-ip")["reservation_id"] is not None
sql("update public.ai_chat_quota_reservations set created_at=now()-interval '6 minutes'; update public.ai_chat_usage_logs set created_at=now()-interval '6 minutes'")
assert reserve("same-session", "same-ip")["reservation_id"] is not None
assert reserve("same-session", "same-ip")["blocked_reason"] == "session_daily_limit"
print("PASS idempotent completion/no double count, abandoned calls consumed, 5/day")

reset()
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    admissions = list(pool.map(lambda n: reserve("ip-session-" + str(n), "shared-ip"), range(16)))
assert sum(a["reservation_id"] is not None for a in admissions) == 10
print("PASS 16 concurrent distinct sessions on same IP allow exactly 10/hour")
reset()
ip = hashed("daily-ip")
sql("insert into public.ai_chat_usage_logs(session_id_hash,ip_hash,created_at) select md5(n::text)||md5(n::text),'" + ip + "',now()-interval '2 hours' from generate_series(1,50) n")
assert reserve("fresh", "daily-ip")["blocked_reason"] == "ip_daily_limit"
print("PASS legacy logs still enforce IP 50/day")

reset()
sql("insert into public.ai_chat_quota_reservations(session_id_hash) select md5(n::text)||md5(n::text) from generate_series(1,199) n")
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    admissions = list(pool.map(lambda n: reserve("global-session-" + str(n)), range(8)))
assert sum(a["reservation_id"] is not None for a in admissions) == 1
assert sum(a["blocked_reason"] == "global_hourly_limit" for a in admissions) == 7
print("PASS global concurrent cap at 200/hour with no IP")
reset()
sql("insert into public.ai_chat_quota_reservations(session_id_hash,created_at) select md5(n::text)||md5(n::text),now()-interval '2 hours' from generate_series(1,2000) n")
assert reserve("global-daily")["blocked_reason"] == "global_daily_limit"
sql("update public.ai_chat_quota_reservations set created_at=now()-interval '25 hours'")
assert reserve("global-daily")["reservation_id"] is not None
print("PASS shared 2000/day and rolling-window expiry")
