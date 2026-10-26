-- Member identity evidence: confirmed email aliases, academic-year observations,
-- and one atomic, revalidating write for attendance imports.
--
-- WHY
--   A member keeps one permanent identity (members.id) while their contact
--   details change. Students alternate between a personal address and their
--   @ucsd.edu address, and members.email holds only one. The importer therefore
--   met the second address as a stranger and either asked an admin or created a
--   duplicate member. Year was compared with no idea of when it was recorded.
--
-- WHAT (additive; nothing existing is dropped)
--   member_identity_emails     One row per confirmed address, unique across all
--                              members, so a confirmed address names exactly one
--                              member. members.email stays the preferred contact
--                              address; changing it never removes an alias.
--   member_year_observations   "Reported <year label> in academic year <Y>".
--                              Lets matching compare standing across years and
--                              keeps old imports from rewinding members.year.
--   attendance_import_requests Idempotency record per confirmed import.
--   admin_apply_attendance_import(jsonb)
--                              Revalidates the preview against current data and
--                              writes members, attendance, profile fills, aliases
--                              and observations in one transaction, or nothing.
--   smart_merge_members        Also moves aliases, observations, House history
--                              and identity links to the surviving member.
--   Two triggers on members    A primary email becomes an alias; anonymization
--                              removes a member's aliases and observations.
--
-- BACKFILL
--   members.email becomes an alias only when exactly one member holds that
--   address. Shared addresses (13 groups / 26 members in production, read-only
--   count 2026-10-25) are left out; Merge Suggestions lists them as "Same email
--   on file" for an admin to merge or tell apart. Historical import rows are NOT
--   turned into aliases: an audited row can carry a wrong match, and an alias is
--   trusted on every later import.
--   Each member with a year and at least one attended, termed event gets one
--   'profile_estimate' observation dated to their latest attended academic year
--   (members.year only ever advances on import, so it is roughly that year's
--   standing). Estimates are weaker evidence than import observations.
--
-- SECURITY
--   All three tables: RLS on, admin-only SELECT; no anon access at all. Clients
--   may insert/delete aliases as an admin (Members page). Observations and
--   requests are written only by the SECURITY DEFINER functions below, which
--   check is_admin_user(auth.uid()) first and pin search_path to ''.
--   public_members and other public projections are unchanged and never read
--   these tables.
--
-- LOCKS (admin_apply_attendance_import)
--   event advisory -> event FOR SHARE -> email advisories (sorted)
--   -> name advisories (sorted) -> per member, sorted: member advisory
--   -> member row FOR NO KEY UPDATE
--   -> member inserts -> attendance -> members (points triggers) -> aliases.
--   The member advisory key and the email advisory key are the ones Historical
--   Recovery takes, so the two writers queue instead of racing. Holding the
--   member row before inserting attendance keeps cached totals right under
--   both the production row trigger and 20261010000000's statement triggers.
--
-- DEPLOY: apply before the frontend that calls admin_apply_attendance_import.
-- The current frontend does not reference anything here. ROLLBACK:
-- scripts/sql/member-identity-aliases-rollback.sql.
-- TESTS: bash scripts/test-member-identity.sh (disposable local cluster).

begin;

set local lock_timeout = '5s';

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.member_identity_emails (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  email text not null,
  source text not null
    check (source in ('backfill', 'member_profile', 'attendance_import', 'admin', 'merge')),
  verification_method text not null
    check (verification_method in (
      'primary_email',             -- the member's own members.email
      'unique_name_college_year',  -- import: only member with this name, same college, compatible year
      'admin_confirmed',           -- import: an admin matched the row to this member
      'same_submission',           -- import: second address on a row/person already identified
      'admin_entered'              -- added by an admin on the Members page
    )),
  import_request_id uuid,
  moved_from_member_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  constraint member_identity_emails_email_normalized check (
    email = lower(btrim(email))
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and char_length(email) <= 254
  ),
  constraint member_identity_emails_email_key unique (email)
);

create index if not exists member_identity_emails_member_idx on public.member_identity_emails (member_id);

comment on table public.member_identity_emails is
  'Confirmed email addresses per member (admin-only, private). An address belongs to at most one member.';

create table if not exists public.member_year_observations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  academic_year_start integer not null check (academic_year_start between 2000 and 2100),
  year_label text not null check (char_length(year_label) between 1 and 40),
  source text not null check (source in ('profile_estimate', 'attendance_import')),
  import_request_id uuid,
  created_at timestamptz not null default now(),
  constraint member_year_observations_unique unique (member_id, academic_year_start, year_label, source)
);

create index if not exists member_year_observations_member_idx
  on public.member_year_observations (member_id, academic_year_start);

comment on table public.member_year_observations is
  'Academic standing a member reported (or was estimated at) in a given academic year. Private, admin-only.';

create table if not exists public.attendance_import_requests (
  request_id uuid primary key,
  event_id uuid not null,
  fingerprint text not null,
  result jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.attendance_import_requests is
  'One row per applied attendance import, so a retried request returns its first result instead of writing again.';

-- Speeds the ownership checks below; members.email has no unique index on purpose
-- (shared addresses exist and are resolved by admins).
create index if not exists members_email_normalized_idx
  on public.members (lower(btrim(email)))
  where email is not null;

-- ── Access ────────────────────────────────────────────────────────────────────

alter table public.member_identity_emails enable row level security;
alter table public.member_year_observations enable row level security;
alter table public.attendance_import_requests enable row level security;

revoke all on public.member_identity_emails from public, anon, authenticated;
revoke all on public.member_year_observations from public, anon, authenticated;
revoke all on public.attendance_import_requests from public, anon, authenticated;
grant select, insert, delete on public.member_identity_emails to authenticated;
grant select on public.member_year_observations to authenticated;
grant select on public.attendance_import_requests to authenticated;

drop policy if exists "Admins read member identity emails" on public.member_identity_emails;
create policy "Admins read member identity emails" on public.member_identity_emails
  for select to authenticated using (public.is_admin_user(auth.uid()));
drop policy if exists "Admins add member identity emails" on public.member_identity_emails;
create policy "Admins add member identity emails" on public.member_identity_emails
  for insert to authenticated
  with check (public.is_admin_user(auth.uid()) and source = 'admin' and verification_method = 'admin_entered');
drop policy if exists "Admins remove member identity emails" on public.member_identity_emails;
create policy "Admins remove member identity emails" on public.member_identity_emails
  for delete to authenticated using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins read member year observations" on public.member_year_observations;
create policy "Admins read member year observations" on public.member_year_observations
  for select to authenticated using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins read attendance import requests" on public.attendance_import_requests;
create policy "Admins read attendance import requests" on public.attendance_import_requests
  for select to authenticated using (public.is_admin_user(auth.uid()));

-- ── Backfill ──────────────────────────────────────────────────────────────────

insert into public.member_identity_emails (member_id, email, source, verification_method, confirmed_at)
select m.id, m.normalized, 'backfill', 'primary_email', m.created_at
from (
  select id, created_at, lower(btrim(email)) as normalized,
         count(*) over (partition by lower(btrim(email))) as holders
  from public.members
  where nullif(btrim(email), '') is not null
) m
where m.holders = 1
  and m.normalized ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and char_length(m.normalized) <= 254
on conflict (email) do nothing;

insert into public.member_year_observations (member_id, academic_year_start, year_label, source)
select m.id, latest.academic_year_start, btrim(m.year), 'profile_estimate'
from public.members m
join lateral (
  select max(t.academic_year_start) as academic_year_start
  from public.member_event_attendance a
  join public.events e on e.id = a.event_id
  join public.academic_terms t on t.id = e.academic_term_id
  where a.member_id = m.id
) latest on latest.academic_year_start is not null
where nullif(btrim(m.year), '') is not null
  and char_length(btrim(m.year)) <= 40
on conflict on constraint member_year_observations_unique do nothing;

-- ── members.email → alias ─────────────────────────────────────────────────────

create or replace function public.sync_member_primary_email_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
begin
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    return null;
  end if;
  if tg_op = 'UPDATE' and lower(btrim(coalesce(old.email, ''))) = v_email then
    return null;
  end if;
  -- Another member holding the same address leaves ownership undecided; an
  -- admin settles it in Merge Suggestions.
  if exists (
    select 1 from public.members m
    where m.id <> new.id and m.email is not null and lower(btrim(m.email)) = v_email
  ) then
    return null;
  end if;
  insert into public.member_identity_emails (member_id, email, source, verification_method, created_by)
  values (new.id, v_email, 'member_profile', 'primary_email', auth.uid())
  on conflict (email) do nothing;
  return null;
end;
$$;

revoke all on function public.sync_member_primary_email_alias() from public, anon, authenticated;

drop trigger if exists trg_member_primary_email_alias on public.members;
create trigger trg_member_primary_email_alias
  after insert or update of email on public.members
  for each row execute function public.sync_member_primary_email_alias();

-- ── Anonymization removes identity evidence ───────────────────────────────────
-- admin_complete_data_rights_request (20260620020000) anonymizes a member by
-- setting exactly this sentinel. Aliases and observations are personal data
-- about that person and must not outlive it.

create or replace function public.purge_member_identity_on_anonymize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_identity_emails where member_id = new.id;
  delete from public.member_year_observations where member_id = new.id;
  return null;
end;
$$;

revoke all on function public.purge_member_identity_on_anonymize() from public, anon, authenticated;

drop trigger if exists trg_member_purge_identity_on_anonymize on public.members;
create trigger trg_member_purge_identity_on_anonymize
  after update of first_name, last_name, college, year, user_id on public.members
  for each row
  when (new.first_name = 'Deleted' and new.last_name = 'Member'
        and new.college is null and new.year is null and new.user_id is null)
  execute function public.purge_member_identity_on_anonymize();

-- ── smart_merge_members ───────────────────────────────────────────────────────
-- Same contract as production. Locks: both member advisory keys (sorted), then
-- both member rows FOR UPDATE (sorted), then events / attendance through the
-- points triggers. An import or recovery crediting either member therefore
-- either finishes first (and its credit is moved) or waits and then finds the
-- source gone (stale), so a merge can never delete a credit committed under it.
-- Additions, all before the source is deleted:
--   * year: the side with the more recent observation wins when both have one;
--     otherwise the target keeps its own (as before).
--   * house: kept from the source when the target has none (dropped in 20260619).
--   * observations, aliases: moved to the target (aliases record where from).
--   * House history: the source's years the target has no membership for move.
--   * identity links (import audit rows, photo requests, ACE / Cabinet links,
--     workspace drafts) point at the target instead of being set to null.
--     Missing tables are skipped; a unique conflict leaves that table's rows to
--     the existing ON DELETE SET NULL.

create or replace function public.smart_merge_members(
  p_source_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.members%rowtype;
  v_target public.members%rowtype;
  v_source_seen integer;
  v_target_seen integer;
  v_link record;
begin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Permission denied: admin access required for smart_merge_members';
  end if;

  if p_source_id is null or p_target_id is null or p_source_id = p_target_id then
    raise exception 'Choose two different members to merge';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || least(p_source_id, p_target_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || greatest(p_source_id, p_target_id)::text, 0));
  perform 1 from public.members where id in (p_source_id, p_target_id) order by id for update;

  select * into v_source from public.members where id = p_source_id;
  if not found then
    raise exception 'Source member not found: %', p_source_id;
  end if;

  select * into v_target from public.members where id = p_target_id;
  if not found then
    raise exception 'Target member not found: %', p_target_id;
  end if;

  select max(academic_year_start) into v_source_seen from public.member_year_observations where member_id = p_source_id;
  select max(academic_year_start) into v_target_seen from public.member_year_observations where member_id = p_target_id;

  update public.members
  set
    college    = coalesce(v_target.college, v_source.college),
    year       = case
                   when v_target.year is not null and v_source.year is not null
                        and coalesce(v_source_seen, -1) > coalesce(v_target_seen, -1)
                     then v_source.year
                   else coalesce(v_target.year, v_source.year)
                 end,
    email      = coalesce(v_target.email, v_source.email),
    house      = coalesce(v_target.house, v_source.house),
    updated_at = now()
  where id = p_target_id;

  insert into public.member_event_attendance
    (member_id, event_id, points_earned, imported_at)
  select p_target_id, event_id, points_earned, imported_at
  from public.member_event_attendance
  where member_id = p_source_id
  on conflict (member_id, event_id) do nothing;

  delete from public.member_year_observations s
  where s.member_id = p_source_id
    and exists (
      select 1 from public.member_year_observations t
      where t.member_id = p_target_id
        and t.academic_year_start = s.academic_year_start
        and t.year_label = s.year_label
        and t.source = s.source
    );
  update public.member_year_observations set member_id = p_target_id where member_id = p_source_id;

  update public.member_identity_emails
  set member_id = p_target_id, moved_from_member_id = p_source_id
  where member_id = p_source_id;

  update public.house_memberships s
  set member_id = p_target_id
  where s.member_id = p_source_id
    and not exists (
      select 1 from public.house_memberships t
      where t.member_id = p_target_id and t.academic_year_start = s.academic_year_start
    );

  for v_link in
    select c.table_name, c.column_name
    from information_schema.columns c
    join (values
      ('import_job_rows', 'matched_member_id'),
      ('import_job_rows', 'created_member_id'),
      ('import_job_rows', 'attendance_member_id'),
      ('member_photo_requests', 'matched_member_id'),
      ('ace_family_members', 'member_id'),
      ('cabinet_members', 'member_id'),
      ('ace_assignment_drafts', 'little_member_id'),
      ('house_assignment_drafts', 'member_id'),
      ('intern_cohort_drafts', 'member_id'),
      ('cabinet_roster_drafts', 'member_id')
    ) as links(table_name, column_name)
      on links.table_name = c.table_name and links.column_name = c.column_name
    where c.table_schema = 'public'
    order by 1, 2
  loop
    -- On a unique conflict this table's whole UPDATE is undone; its rows then
    -- fall back to the existing ON DELETE SET NULL (every listed column has it).
    begin
      execute format('update public.%I set %I = $1 where %I = $2', v_link.table_name, v_link.column_name, v_link.column_name)
        using p_target_id, p_source_id;
    exception when unique_violation then
      null;
    end;
  end loop;

  -- ON DELETE CASCADE removes the source's remaining attendance and House rows.
  delete from public.members where id = p_source_id;
end;
$$;

revoke execute on function public.smart_merge_members(uuid, uuid) from public, anon;
grant execute on function public.smart_merge_members(uuid, uuid) to authenticated;

-- ── Name folding ──────────────────────────────────────────────────────────────
-- The database twin of src/lib/personName.ts (foldName + middle-initial drop):
-- accents and Đ/đ fold, apostrophes join, other punctuation separates, case and
-- spacing are ignored, single-letter middle tokens are dropped. "Hoa Nguyễn"
-- and "HOA  NGUYEN" fold to one key, so the import's same-name guard and name
-- locks treat them as the resolver does. Keep the two in step.

create or replace function public.fold_person_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_folded text;
  v_tokens text[];
  v_core text[] := '{}';
  v_count integer;
begin
  v_folded := lower(regexp_replace(translate(normalize(coalesce(p_name, ''), NFD), 'đĐ', 'dd'), '[\u0300-\u036f]', '', 'g'));
  v_folded := regexp_replace(v_folded, '[''’`]', '', 'g');
  v_folded := btrim(regexp_replace(v_folded, '[^a-z0-9]+', ' ', 'g'));
  if v_folded = '' then
    return lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  end if;
  v_tokens := string_to_array(v_folded, ' ');
  v_count := array_length(v_tokens, 1);
  if v_count <= 2 then
    return v_folded;
  end if;
  for i in 1..v_count loop
    if i = 1 or i = v_count or char_length(v_tokens[i]) > 1 then
      v_core := v_core || v_tokens[i];
    end if;
  end loop;
  return array_to_string(v_core, ' ');
end;
$$;

revoke all on function public.fold_person_name(text) from public, anon, authenticated;

-- ── admin_apply_attendance_import ─────────────────────────────────────────────
--
-- p_request:
--   request_id     uuid, one per confirmation; a retry with the same request
--                  returns the first result without writing again
--   event_id       uuid
--   expected_points, expected_term_id   what the preview showed
--   credits[]      { row_key, member_id,
--                    expected: { first_name, last_name, college, email },
--                    known_same_name_ids?: [uuid]   automatic matches: every
--                                       member with this name the preview saw
--                    evidence_emails?: [text]       addresses that identified the
--                                       member (known-email matches); they must
--                                       still identify only this member
--                    expected_standing?: { year, observations }  automatic
--                                       matches: profile year and recorded-year
--                                       count the evidence was judged against
--                    fill?: { college?, email? }        only where empty now
--                    year?: { from, to }                only if still "from"
--                    aliases?: [{ email, method }]
--                    observed_year? }
--   creates[]      { row_key, first_name, last_name, college?, year?, email?,
--                    known_same_name_ids: [uuid], aliases?: [{ email, method }],
--                    observed_year? }
--
-- Returns { ok: false, problems: [...] } and writes nothing when the preview is
-- stale: the event's points or term changed, a credited member was deleted,
-- merged or edited, an address now belongs to someone else, or a member with the
-- same name as a new member (or an automatic match) appeared that the preview
-- did not see. The admin re-runs matching. A year update also never applies
-- from an event older than the member's latest observation.

create or replace function public.admin_apply_attendance_import(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_email_pattern constant text := '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_event_id uuid;
  v_credits jsonb;
  v_creates jsonb;
  v_fingerprint text;
  v_existing public.attendance_import_requests%rowtype;
  v_event_points integer;
  v_event_term uuid;
  v_academic_year integer;
  v_problems jsonb := '[]'::jsonb;
  v_item jsonb;
  v_alias jsonb;
  v_member public.members%rowtype;
  v_member_id uuid;
  v_email text;
  v_target text;
  v_owner uuid;
  v_new_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_present jsonb := '[]'::jsonb;
  v_year_skipped jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_aliases_added integer := 0;
  v_fills integer := 0;
  v_years integer := 0;
  v_observations integer := 0;
  v_count integer;
  v_result jsonb;
begin
  if not public.is_admin_user(v_uid) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'The import request is not valid' using errcode = '22023';
  end if;

  v_request_id := (p_request ->> 'request_id')::uuid;
  v_event_id := (p_request ->> 'event_id')::uuid;
  v_credits := coalesce(p_request -> 'credits', '[]'::jsonb);
  v_creates := coalesce(p_request -> 'creates', '[]'::jsonb);
  if v_request_id is null or v_event_id is null
     or jsonb_typeof(v_credits) <> 'array' or jsonb_typeof(v_creates) <> 'array' then
    raise exception 'The import request is missing required fields' using errcode = '22023';
  end if;
  if jsonb_array_length(v_credits) + jsonb_array_length(v_creates) = 0 then
    raise exception 'Nothing to import' using errcode = '22023';
  end if;
  if jsonb_array_length(v_credits) + jsonb_array_length(v_creates) > 2000 then
    raise exception 'An import is limited to 2000 credited or created members' using errcode = '22023';
  end if;
  v_fingerprint := md5(p_request::text);

  -- Two imports for one event run one after the other, so the second sees the
  -- members the first created.
  perform pg_advisory_xact_lock(hashtextextended('vsa-attendance-import-event:' || v_event_id::text, 0));

  select * into v_existing from public.attendance_import_requests where request_id = v_request_id;
  if found then
    if v_existing.fingerprint = v_fingerprint and v_existing.created_by is not distinct from v_uid then
      return v_existing.result || jsonb_build_object('replayed', true);
    end if;
    raise exception 'This import request id was already used for a different import'
      using errcode = 'P0001', hint = 'request_id_reused';
  end if;

  -- Request shape: every credit names a member once; every row key is unique.
  if exists (
    select 1 from jsonb_array_elements(v_credits) c
    where jsonb_typeof(c) <> 'object' or (c ->> 'member_id') is null or coalesce(c ->> 'row_key', '') = ''
  ) or exists (
    select 1 from jsonb_array_elements(v_creates) c
    where jsonb_typeof(c) <> 'object' or coalesce(c ->> 'row_key', '') = ''
       or btrim(coalesce(c ->> 'first_name', '')) = '' or btrim(coalesce(c ->> 'last_name', '')) = ''
       or char_length(c ->> 'first_name') > 100 or char_length(c ->> 'last_name') > 100
  ) then
    raise exception 'Every credited row needs a member and every new member needs a first and last name'
      using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_credits) c)
     <> (select count(distinct (c ->> 'member_id')::uuid) from jsonb_array_elements(v_credits) c) then
    raise exception 'A member is credited more than once in this import' using errcode = '22023';
  end if;
  if (select count(*) from (
        select c ->> 'row_key' from jsonb_array_elements(v_credits) c
        union all select c ->> 'row_key' from jsonb_array_elements(v_creates) c) k)
     <> (select count(distinct k) from (
        select c ->> 'row_key' as k from jsonb_array_elements(v_credits) c
        union all select c ->> 'row_key' from jsonb_array_elements(v_creates) c) k) then
    raise exception 'Row keys must be unique' using errcode = '22023';
  end if;

  -- Every address this request touches, with who it is meant for: a member id,
  -- or 'new:<row_key>' for a member created here.
  create temporary table if not exists pg_temp.import_emails (email text, target text, row_key text) on commit drop;
  truncate pg_temp.import_emails;
  insert into pg_temp.import_emails (email, target, row_key)
  select lower(btrim(e.email)), x.target, x.row_key
  from (
    select c ->> 'member_id' as target, c ->> 'row_key' as row_key, c as item from jsonb_array_elements(v_credits) c
    union all
    select 'new:' || (c ->> 'row_key'), c ->> 'row_key', c from jsonb_array_elements(v_creates) c
  ) x
  cross join lateral (
    select a ->> 'email' as email from jsonb_array_elements(coalesce(x.item -> 'aliases', '[]'::jsonb)) a
    union all select e from jsonb_array_elements_text(coalesce(x.item -> 'evidence_emails', '[]'::jsonb)) e
    union all select x.item -> 'fill' ->> 'email'
    union all select x.item ->> 'email' where x.target like 'new:%'
  ) e
  where nullif(btrim(e.email), '') is not null;

  if exists (select 1 from pg_temp.import_emails where email !~ c_email_pattern or char_length(email) > 254) then
    raise exception 'An email address in the import is not valid' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.import_emails group by email having count(distinct target) > 1) then
    raise exception 'One email address is assigned to two different people in this import' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_credits) c
    cross join lateral jsonb_array_elements(coalesce(c -> 'aliases', '[]'::jsonb)) a
    where a ->> 'method' not in ('unique_name_college_year', 'admin_confirmed', 'same_submission')
  ) or exists (
    select 1 from jsonb_array_elements(v_creates) c
    cross join lateral jsonb_array_elements(coalesce(c -> 'aliases', '[]'::jsonb)) a
    where a ->> 'method' <> 'same_submission'
  ) then
    raise exception 'Unknown alias verification method' using errcode = '22023';
  end if;

  -- Event: unchanged since the preview, and still in an academic term.
  select e.points, e.academic_term_id, t.academic_year_start
    into v_event_points, v_event_term, v_academic_year
  from public.events e
  left join public.academic_terms t on t.id = e.academic_term_id
  where e.id = v_event_id
  for share of e;
  if not found then
    return jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object('kind', 'event_missing')));
  end if;
  if v_event_term is null then
    return jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object('kind', 'event_has_no_term')));
  end if;
  if v_event_points is distinct from (p_request ->> 'expected_points')::integer
     or v_event_term is distinct from (p_request ->> 'expected_term_id')::uuid then
    return jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object('kind', 'event_changed')));
  end if;

  for v_email in select distinct email from pg_temp.import_emails order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('vsa-member-email:' || v_email, 0));
  end loop;

  -- Same-name members created by another import (any event) must be visible to
  -- the same-name check below, so imports touching one name queue on it.
  for v_email in
    select distinct public.fold_person_name(coalesce(c ->> 'first_name', c -> 'expected' ->> 'first_name')
             || ' ' || coalesce(c ->> 'last_name', c -> 'expected' ->> 'last_name'))
    from (
      select c from jsonb_array_elements(v_creates) c
      union all select c from jsonb_array_elements(v_credits) c where c ? 'known_same_name_ids'
    ) named
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('vsa-member-name:' || v_email, 0));
  end loop;

  -- Credited members: lock, then confirm they are who the preview showed.
  for v_item in
    select c from jsonb_array_elements(v_credits) c order by (c ->> 'member_id')::uuid
  loop
    v_member_id := (v_item ->> 'member_id')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || v_member_id::text, 0));
    select * into v_member from public.members where id = v_member_id for no key update;
    if not found then
      v_problems := v_problems || jsonb_build_object('kind', 'member_missing', 'row_key', v_item ->> 'row_key');
      continue;
    end if;
    if lower(btrim(coalesce(v_member.first_name, ''))) <> lower(btrim(coalesce(v_item -> 'expected' ->> 'first_name', '')))
       or lower(btrim(coalesce(v_member.last_name, ''))) <> lower(btrim(coalesce(v_item -> 'expected' ->> 'last_name', '')))
       or lower(btrim(coalesce(v_member.college, ''))) <> lower(btrim(coalesce(v_item -> 'expected' ->> 'college', '')))
       or lower(btrim(coalesce(v_member.email, ''))) <> lower(btrim(coalesce(v_item -> 'expected' ->> 'email', ''))) then
      v_problems := v_problems || jsonb_build_object('kind', 'member_changed', 'row_key', v_item ->> 'row_key');
    end if;
  end loop;

  -- Addresses: each must still be free, or already belong to its intended member.
  for v_email, v_target in select distinct email, target from pg_temp.import_emails order by 1 loop
    select member_id into v_owner from public.member_identity_emails where email = v_email;
    -- CASE, not OR: SQL does not promise to skip the uuid cast of 'new:<row_key>'.
    if found and (case when v_target like 'new:%' then true else v_owner <> v_target::uuid end) then
      v_problems := v_problems || jsonb_build_object('kind', 'email_owned_by_other',
        'row_key', (select row_key from pg_temp.import_emails where email = v_email limit 1));
      continue;
    end if;
    if exists (
      select 1 from public.members m
      where m.email is not null and lower(btrim(m.email)) = v_email
        and (case when v_target like 'new:%' then true else m.id <> v_target::uuid end)
    ) then
      v_problems := v_problems || jsonb_build_object('kind', 'email_held_by_other',
        'row_key', (select row_key from pg_temp.import_emails where email = v_email limit 1));
    end if;
  end loop;

  -- An automatic match was judged against this standing; a changed one may no
  -- longer support it (another import can record a year in the meantime).
  for v_item in select c from jsonb_array_elements(v_credits) c where jsonb_typeof(c -> 'expected_standing') = 'object' loop
    v_member_id := (v_item ->> 'member_id')::uuid;
    if not exists (
      select 1 from public.members m
      where m.id = v_member_id
        and coalesce(btrim(m.year), '') = coalesce(btrim(v_item -> 'expected_standing' ->> 'year'), '')
    ) or (select count(*) from public.member_year_observations o where o.member_id = v_member_id)
         <> coalesce((v_item -> 'expected_standing' ->> 'observations')::integer, -1) then
      v_problems := v_problems || jsonb_build_object('kind', 'member_changed', 'row_key', v_item ->> 'row_key');
    end if;
  end loop;

  -- Addresses that identified a member must still be that member's.
  for v_item in select c from jsonb_array_elements(v_credits) c where c ? 'evidence_emails' loop
    v_member_id := (v_item ->> 'member_id')::uuid;
    for v_email in select lower(btrim(e)) from jsonb_array_elements_text(v_item -> 'evidence_emails') e loop
      if not exists (select 1 from public.member_identity_emails where email = v_email and member_id = v_member_id)
         and not exists (select 1 from public.members where id = v_member_id and email is not null and lower(btrim(email)) = v_email) then
        v_problems := v_problems || jsonb_build_object('kind', 'member_changed', 'row_key', v_item ->> 'row_key');
      end if;
    end loop;
  end loop;

  -- Same-name members the preview did not see: a new member may be a duplicate,
  -- and an automatic name match may no longer be unique.
  -- Folded once per import, not once per row.
  create temporary table if not exists pg_temp.import_member_names (id uuid, folded text) on commit drop;
  truncate pg_temp.import_member_names;
  if jsonb_array_length(v_creates) > 0 or exists (select 1 from jsonb_array_elements(v_credits) c where c ? 'known_same_name_ids') then
    insert into pg_temp.import_member_names (id, folded)
    select m.id, public.fold_person_name(m.first_name || ' ' || m.last_name) from public.members m;
  end if;
  for v_item in
    select c from jsonb_array_elements(v_creates) c
    union all
    select c from jsonb_array_elements(v_credits) c where c ? 'known_same_name_ids'
  loop
    if jsonb_typeof(coalesce(v_item -> 'known_same_name_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'known_same_name_ids must be an array' using errcode = '22023';
    end if;
    if exists (
      select 1 from pg_temp.import_member_names m
      where m.folded = public.fold_person_name(coalesce(v_item ->> 'first_name', v_item -> 'expected' ->> 'first_name')
              || ' ' || coalesce(v_item ->> 'last_name', v_item -> 'expected' ->> 'last_name'))
        and m.id::text not in (
          select jsonb_array_elements_text(coalesce(v_item -> 'known_same_name_ids', '[]'::jsonb))
          union all select coalesce(v_item ->> 'member_id', ''))
    ) then
      v_problems := v_problems || jsonb_build_object('kind', 'possible_duplicate_created', 'row_key', v_item ->> 'row_key');
    end if;
  end loop;

  if jsonb_array_length(v_problems) > 0 then
    return jsonb_build_object('ok', false, 'problems', v_problems);
  end if;

  -- ── Writes ──
  for v_item in select c from jsonb_array_elements(v_creates) c loop
    insert into public.members (first_name, last_name, college, year, email, needs_review)
    values (
      btrim(v_item ->> 'first_name'),
      btrim(v_item ->> 'last_name'),
      nullif(left(btrim(coalesce(v_item ->> 'college', '')), 100), ''),
      nullif(left(btrim(coalesce(v_item ->> 'year', '')), 40), ''),
      nullif(lower(btrim(coalesce(v_item ->> 'email', ''))), ''),
      false)
    returning id into v_new_id;
    v_created := v_created || jsonb_build_object('row_key', v_item ->> 'row_key', 'member_id', v_new_id);
  end loop;

  with targets as (
    select (c ->> 'member_id')::uuid as member_id, c ->> 'row_key' as row_key from jsonb_array_elements(v_credits) c
    union all
    select (x ->> 'member_id')::uuid, x ->> 'row_key' from jsonb_array_elements(v_created) x
  ),
  inserted as (
    insert into public.member_event_attendance (member_id, event_id, points_earned)
    select member_id, v_event_id, coalesce(v_event_points, 1) from targets order by member_id
    on conflict (member_id, event_id) do nothing
    returning member_id
  )
  select count(i.member_id), coalesce(jsonb_agg(t.row_key) filter (where i.member_id is null), '[]'::jsonb)
    into v_inserted, v_present
  from targets t left join inserted i on i.member_id = t.member_id;

  for v_item in select c from jsonb_array_elements(v_credits) c loop
    v_member_id := (v_item ->> 'member_id')::uuid;
    if nullif(btrim(coalesce(v_item -> 'fill' ->> 'college', '')), '') is not null then
      update public.members set college = left(btrim(v_item -> 'fill' ->> 'college'), 100), updated_at = now()
      where id = v_member_id and nullif(btrim(college), '') is null;
      get diagnostics v_count = row_count;
      v_fills := v_fills + v_count;
    end if;
    if nullif(btrim(coalesce(v_item -> 'fill' ->> 'email', '')), '') is not null then
      update public.members set email = lower(btrim(v_item -> 'fill' ->> 'email')), updated_at = now()
      where id = v_member_id and nullif(btrim(email), '') is null;
      get diagnostics v_count = row_count;
      v_fills := v_fills + v_count;
    end if;
    if jsonb_typeof(v_item -> 'year') = 'object' and nullif(btrim(coalesce(v_item -> 'year' ->> 'to', '')), '') is not null then
      update public.members set year = left(btrim(v_item -> 'year' ->> 'to'), 40), updated_at = now()
      where id = v_member_id
        and coalesce(btrim(year), '') = coalesce(btrim(v_item -> 'year' ->> 'from'), '')
        -- Never from an event older than what the member last reported.
        and not exists (
          select 1 from public.member_year_observations o
          where o.member_id = v_member_id and o.academic_year_start > v_academic_year
        );
      get diagnostics v_count = row_count;
      if v_count = 0 then
        v_year_skipped := v_year_skipped || to_jsonb(v_item ->> 'row_key');
      end if;
      v_years := v_years + v_count;
    end if;
  end loop;

  for v_item, v_member_id in
    select c, (c ->> 'member_id')::uuid from jsonb_array_elements(v_credits) c
    union all
    select c, (select (x ->> 'member_id')::uuid from jsonb_array_elements(v_created) x where x ->> 'row_key' = c ->> 'row_key')
    from jsonb_array_elements(v_creates) c
  loop
    for v_alias in select a from jsonb_array_elements(coalesce(v_item -> 'aliases', '[]'::jsonb)) a loop
      insert into public.member_identity_emails
        (member_id, email, source, verification_method, import_request_id, created_by)
      values (v_member_id, lower(btrim(v_alias ->> 'email')), 'attendance_import', v_alias ->> 'method', v_request_id, v_uid)
      on conflict (email) do nothing;
      get diagnostics v_count = row_count;
      v_aliases_added := v_aliases_added + v_count;
    end loop;
    if nullif(btrim(coalesce(v_item ->> 'observed_year', '')), '') is not null then
      insert into public.member_year_observations (member_id, academic_year_start, year_label, source, import_request_id)
      values (v_member_id, v_academic_year, left(btrim(v_item ->> 'observed_year'), 40), 'attendance_import', v_request_id)
      on conflict on constraint member_year_observations_unique do nothing;
      get diagnostics v_count = row_count;
      v_observations := v_observations + v_count;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'created', v_created,
    'attendance_inserted', v_inserted,
    'attendance_already_present', v_present,
    'profile_fills', v_fills,
    'years_advanced', v_years,
    'years_skipped', v_year_skipped,
    'aliases_added', v_aliases_added,
    'observations_added', v_observations
  );
  insert into public.attendance_import_requests (request_id, event_id, fingerprint, result, created_by)
  values (v_request_id, v_event_id, v_fingerprint, v_result, v_uid);
  return v_result;
end;
$$;

revoke all on function public.admin_apply_attendance_import(jsonb) from public, anon;
grant execute on function public.admin_apply_attendance_import(jsonb) to authenticated;

commit;
