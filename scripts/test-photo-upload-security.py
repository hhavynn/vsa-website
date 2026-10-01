"""Security regression checks: requires an explicit disposable LOCAL test database."""
import concurrent.futures
import hashlib
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse

url = os.environ.get("PHOTO_SECURITY_TEST_DATABASE_URL", "")
parsed = urlparse(url)
if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not parsed.path.startswith("/photo_security_test"):
    raise SystemExit("Set PHOTO_SECURITY_TEST_DATABASE_URL to a disposable local photo_security_test database; no .env is read")


def sql(statement, role=None, admin=False):
    if role:
        statement = "set request.jwt.claim.role = '" + role + "'; set request.jwt.claim.admin = '" + ("true" if admin else "false") + "'; set role " + role + "; " + statement
    result = subprocess.run(["psql", url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-Atc", statement], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def denied(statement, role, admin=False):
    try:
        sql(statement, role, admin)
    except RuntimeError as error:
        assert "permission denied" in str(error) or "row-level security" in str(error), str(error)
        return
    raise AssertionError("Unexpected authorization for " + role + ": " + statement)


sql("""
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as
 $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
create function auth.role() returns text language sql stable as
 $$select current_setting('request.jwt.claim.role',true)$$;
create function public.is_admin_user(p_uid uuid) returns boolean language sql stable security definer set search_path='' as
 $$select coalesce(current_setting('request.jwt.claim.admin',true),'false') = 'true'$$;
revoke all on function public.is_admin_user(uuid) from public,anon;
grant execute on function public.is_admin_user(uuid) to authenticated;
grant usage on schema auth,storage,public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
create table public.members(id uuid primary key,first_name text,last_name text,college text,year text,house text,points integer,events_attended integer,user_id uuid,email text);
create table public.member_event_attendance(id uuid primary key,imported_at timestamptz);
alter table public.members enable row level security;
alter table public.member_event_attendance enable row level security;
create policy broad_read on public.members for select using(true);
create policy broad_all on public.member_event_attendance for all using(true) with check(true);
create table storage.objects(bucket_id text,name text);
alter table storage.objects enable row level security;
grant all on storage.objects to anon,authenticated,service_role;
create function storage.foldername(text) returns text[] language sql as
 $$select string_to_array($1,'/')$$;
create policy "Anyone can upload pending photo requests" on storage.objects for insert to anon,authenticated with check(bucket_id='member-photo-requests');
create table public.member_photo_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid,matched_member_id uuid references public.members(id),
 submitted_name text not null,submitted_email text not null,note_to_admins text,consent_confirmed boolean not null,
 storage_path_pending text not null,status text not null default 'pending',created_at timestamptz default now()
);
alter table public.member_photo_requests enable row level security;
create policy "Anyone can submit photo requests" on public.member_photo_requests for insert to anon,authenticated with check(true);
insert into public.members select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'First','Last',null,null,null,1,1,null,'private@invalid' from generate_series(1,1100) n;
insert into public.member_event_attendance values (gen_random_uuid(),now());
""")
root = Path(__file__).resolve().parents[1] / "supabase" / "migrations"
# Run the real pre-existing pending-count trigger, including its admin bypass.
base = (root / "20260701000000_add_member_photo_requests.sql").read_text()
start = base.index("create or replace function public.guard_member_photo_request_rate_limit()")
end = base.index("alter table public.member_photo_requests enable row level security;", start)
sql(base[start:end])
admin = (root / "20260930053224_admin_publish_member_photo.sql").read_text()
start = admin.index("create or replace function public.guard_member_photo_request_rate_limit()")
end = admin.index("$$;", start) + 3
sql(admin[start:end])
for migration in ["20261001000100_restrict_raw_member_reads.sql", "20261001000200_authorize_member_photo_uploads.sql"]:
    sql((root / migration).read_text())

for role in ["anon", "authenticated"]:
    assert sql("select count(*) from public.public_members", role) == "1100"
    denied("select email from public.public_members", role)
    denied("update public.public_members set points=100", role)
    denied("delete from public.public_members", role)
    if role == "anon":
        denied("select count(*) from public.members", role)
        denied("select count(*) from public.member_event_attendance", role)
    else:
        assert sql("select count(*) from public.members", role) == "0"
        assert sql("select count(*) from public.member_event_attendance", role) == "0"
    denied("insert into storage.objects values ('member-photo-requests','pending/direct.webp')", role)
    denied("select * from public.member_photo_upload_reservations", role)
    denied("insert into public.member_photo_requests(submitted_name,submitted_email,consent_confirmed,storage_path_pending) values ('x','x@ucsd.edu',true,'pending/x.webp')", role)
    assert sql("select has_function_privilege('" + role + "','public.reserve_member_photo_upload(text,uuid,text,text,text,text,integer)','EXECUTE')") == "f"
assert sql("select count(*) from public.members", "authenticated", True) == "1100"
assert sql("select count(*) from public.member_event_attendance", "authenticated", True) == "1"
sql("insert into storage.objects values ('member-photo-requests','pending/admin.webp')", "authenticated", True)
print("PASS anon/auth projection-only reads, raw admin access, direct upload/insert denial, service-only ACL")
for claim in [None, "authenticated"]:
    try:
        statement = "select * from public.reserve_member_photo_upload(repeat('a',64),'00000000-0000-4000-8000-000000000001','Member','m@ucsd.edu',null,'image/webp',100)"
        if claim:
            statement = "set request.jwt.claim.role='authenticated'; " + statement
        sql(statement)
        raise AssertionError("Owner bypassed service-role guard")
    except RuntimeError as error:
        assert "authorization unavailable" in str(error), str(error)
try:
    sql("begin isolation level repeatable read; set request.jwt.claim.role='service_role'; select * from public.reserve_member_photo_upload(repeat('a',64),'00000000-0000-4000-8000-000000000001','Member','m@ucsd.edu',null,'image/webp',100)")
    raise AssertionError("Snapshot isolation allowed stale concurrent quota counts")
except RuntimeError as error:
    assert "requires read committed" in str(error), str(error)
print("PASS internal service-role and transaction-isolation guards")


def reserve(number, ip="same-ip", member=None, email=None):
    member = member or number
    email = email or (str(number) + "@ucsd.edu")
    hashed = hashlib.sha256(ip.encode()).hexdigest()
    statement = "select pending_path from public.reserve_member_photo_upload('" + hashed + "','00000000-0000-4000-8000-" + str(member).zfill(12) + "','Member','" + email + "',null,'image/webp',100)"
    try:
        return sql(statement, "service_role")
    except RuntimeError as error:
        assert "limit reached" in str(error) or "Too many pending" in str(error), str(error)
        return None


def reset():
    sql("truncate public.member_photo_upload_reservations,public.member_photo_requests")

with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    results = list(pool.map(reserve, range(1,17)))
assert sum(r is not None for r in results) == 5
assert sql("select count(*) from public.member_photo_requests") == "5"
print("PASS 16 concurrent same-IP requests admit exactly 5 and persist matched reservations")
reset()
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda n: reserve(n, str(n), member=1), range(1,9)))
assert sum(r is not None for r in results) == 3
print("PASS concurrent member pending quota admits exactly3")
reset()
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda n: reserve(n, str(n), email=(" SAME@UCSD.EDU " if n % 2 else "same@ucsd.edu")), range(1,9)))
assert sum(r is not None for r in results) == 5
print("PASS concurrent normalized email pending quota admits exactly5")
reset()
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    results = list(pool.map(lambda n: reserve(n, str(n)), range(1,117)))
assert sum(r is not None for r in results) == 100
print("PASS 116 rotating-IP/member/email requests admit exactly100 global rolling24h")
# Existing reservations count against the lifetime cap even outside daily windows.
sql("update public.member_photo_upload_reservations set created_at=now()-interval '2 days'")
sql("insert into public.member_photo_requests(id,matched_member_id,submitted_name,submitted_email,consent_confirmed,storage_path_pending,status) select gen_random_uuid(),('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Member',n::text || '@ucsd.edu',true,'pending/' || n::text || '.webp','rejected' from generate_series(117,1016) n")
sql("insert into public.member_photo_upload_reservations(request_id,ip_hash,created_at) select id,repeat('a',64),now()-interval '2 days' from public.member_photo_requests where status='rejected'")
assert reserve(1099, "new-ip") is None
assert sql("select count(*) from public.member_photo_upload_reservations") == "1000"
print("PASS lifetime cap remains effective beyond daily windows and failed/abandoned uploads")
