-- ACE pickup year (#669): when each person was picked up as a Little.
--
-- A member's pickup year is theirs alone. It never changes when they later
-- pick up Littles of their own, and it is not the fam's year: the legacy
-- ace_families.academic_year_start/end columns stay untouched and are not a
-- source for it.
--
-- Two layers:
--   1. ace_family_members.pickup_academic_year_start / pickup_term hold the
--      APPROVED value only. NULL means unknown or not yet reviewed. These are
--      the only pickup columns the public view exposes.
--   2. ace_member_pickup_evidence holds raw historical values and unreviewed
--      candidates (import terms, workbook rows, official pairings). Admin-only,
--      never public. A candidate becomes the approved value only through an
--      admin review (set_ace_member_pickup_year).
--
-- Additive only: two nullable columns with no default (no table rewrite, no
-- backfill), one new admin-only table, one SECURITY INVOKER function, and the
-- public view gains two trailing columns. No existing row, family/Big link,
-- member_id link, photo, publication flag, trigger, or policy changes. No
-- attendance, points, House membership, or leaderboard behavior is touched.
--
-- Rollback: scripts/sql/ace-pickup-year.rollback.sql (back up approved values
-- first if any were set).

-- ─── Approved pickup year on the tree node ──────────────────────────────────

alter table public.ace_family_members
  add column if not exists pickup_academic_year_start integer,
  add column if not exists pickup_term text;

alter table public.ace_family_members
  drop constraint if exists ace_family_members_pickup_year_range;
alter table public.ace_family_members
  add constraint ace_family_members_pickup_year_range
  check (pickup_academic_year_start is null
         or pickup_academic_year_start between 1960 and 2100);

-- A term needs its year, and must belong to it. The four-digit year settles
-- the two-digit term's century: FA23 fits 2023, SP24 fits 2023 (WI/SP fall in
-- the year that began the previous Fall), and SP00 fits 1999.
alter table public.ace_family_members
  drop constraint if exists ace_family_members_pickup_term_valid;
alter table public.ace_family_members
  add constraint ace_family_members_pickup_term_valid
  check (
    pickup_term is null
    or (
      pickup_academic_year_start is not null
      and case
        when pickup_term !~ '^(FA|WI|SP)[0-9]{2}$' then false
        when left(pickup_term, 2) = 'FA'
          then substr(pickup_term, 3)::integer = pickup_academic_year_start % 100
        else substr(pickup_term, 3)::integer = (pickup_academic_year_start + 1) % 100
      end
    )
  );

comment on column public.ace_family_members.pickup_academic_year_start is
  'Approved academic year this person was picked up as a Little (2023 = 2023–24). NULL = unknown or unreviewed; never defaulted from the Big, the fam, the generation, or the current year. Public via published_ace_family_members.';
comment on column public.ace_family_members.pickup_term is
  'Approved exact pickup term (FA23, WI24, SP24) when known. NULL when only the academic year is known. Requires pickup_academic_year_start and must belong to it.';

-- ─── Private evidence and review ────────────────────────────────────────────

create table if not exists public.ace_member_pickup_evidence (
  id uuid primary key default gen_random_uuid(),
  ace_member_id uuid not null references public.ace_family_members(id) on delete cascade,
  source_kind text not null,
  -- A short non-sensitive label (e.g. the import file name). Never a link.
  source_label text,
  -- The value exactly as the source wrote it (FA23, legacy, 2021–22, …).
  raw_value text,
  candidate_academic_year_start integer,
  candidate_term text,
  -- The source's own confidence label (e.g. confirmed, inferred-high).
  source_confidence text,
  review_status text not null default 'pending',
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint ace_member_pickup_evidence_source_kind_check
    check (source_kind in ('import_json', 'workbook_year_row', 'official_pairing', 'assignment_cycle', 'admin_entry')),
  constraint ace_member_pickup_evidence_source_label_check
    check (source_label is null
           or (length(source_label) <= 200
               and source_label !~* '(https?://|drive\.google|docs\.google)')),
  constraint ace_member_pickup_evidence_raw_value_check
    check (raw_value is null or length(raw_value) <= 64),
  constraint ace_member_pickup_evidence_confidence_check
    check (source_confidence is null or length(source_confidence) <= 64),
  constraint ace_member_pickup_evidence_note_check
    check (review_note is null or length(review_note) <= 1000),
  constraint ace_member_pickup_evidence_year_range
    check (candidate_academic_year_start is null
           or candidate_academic_year_start between 1960 and 2100),
  constraint ace_member_pickup_evidence_term_valid
    check (
      candidate_term is null
      or (
        candidate_academic_year_start is not null
        and case
          when candidate_term !~ '^(FA|WI|SP)[0-9]{2}$' then false
          when left(candidate_term, 2) = 'FA'
            then substr(candidate_term, 3)::integer = candidate_academic_year_start % 100
          else substr(candidate_term, 3)::integer = (candidate_academic_year_start + 1) % 100
        end
      )
    ),
  constraint ace_member_pickup_evidence_status_check
    check (review_status in ('pending', 'approved', 'rejected', 'superseded')),
  constraint ace_member_pickup_evidence_approved_has_year
    check (review_status <> 'approved' or candidate_academic_year_start is not null),
  constraint ace_member_pickup_evidence_review_stamp
    check ((review_status = 'pending') = (reviewed_at is null))
);

-- Re-recording the same source value for the same node is a no-op
-- (insert ... on conflict do nothing), so imports and backfills can retry.
create unique index if not exists ace_member_pickup_evidence_source_key
  on public.ace_member_pickup_evidence (ace_member_id, source_kind, source_label, raw_value)
  nulls not distinct;

create index if not exists ace_member_pickup_evidence_pending_idx
  on public.ace_member_pickup_evidence (ace_member_id)
  where review_status = 'pending';

alter table public.ace_member_pickup_evidence enable row level security;

drop policy if exists "Admins can view ace pickup evidence" on public.ace_member_pickup_evidence;
create policy "Admins can view ace pickup evidence"
  on public.ace_member_pickup_evidence for select to authenticated
  using (public.is_admin_user(auth.uid()));

-- New evidence is always an unreviewed claim recorded by the caller;
-- approval happens only through set_ace_member_pickup_year.
drop policy if exists "Admins can insert ace pickup evidence" on public.ace_member_pickup_evidence;
create policy "Admins can insert ace pickup evidence"
  on public.ace_member_pickup_evidence for insert to authenticated
  with check (
    public.is_admin_user(auth.uid())
    and review_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_by = auth.uid()
  );

drop policy if exists "Admins can review ace pickup evidence" on public.ace_member_pickup_evidence;
create policy "Admins can review ace pickup evidence"
  on public.ace_member_pickup_evidence for update to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

-- No DELETE policy: evidence is kept as a review history and only goes away
-- with its node (on delete cascade).
revoke all on public.ace_member_pickup_evidence from anon, authenticated;
grant select, insert, update on public.ace_member_pickup_evidence to authenticated;

comment on table public.ace_member_pickup_evidence is
  'Admin-only historical pickup-year evidence and review history for ace_family_members. Never public. Approved values are copied to ace_family_members.pickup_* by set_ace_member_pickup_year; an approval the node no longer matches becomes superseded.';

-- ─── Review: approve, correct or clear one node's pickup year ───────────────

-- SECURITY INVOKER: the caller's own RLS applies, so only admins can change
-- anything. Writes only pickup_academic_year_start and pickup_term on the node
-- (never name, parent, family, member link, photo or publication), plus the
-- review stamp on the evidence row it approves and `superseded` on earlier
-- approvals the new value replaces. Idempotent: re-applying the current
-- value changes nothing and reports changed = false.
create or replace function public.set_ace_member_pickup_year(
  p_ace_member_id uuid,
  p_academic_year_start integer,
  p_term text default null,
  p_evidence_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_node public.ace_family_members%rowtype;
  v_evidence public.ace_member_pickup_evidence%rowtype;
  v_term text := nullif(upper(btrim(coalesce(p_term, ''))), '');
  v_changed boolean;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can set ACE pickup years.' using errcode = '42501';
  end if;
  if v_term is not null and p_academic_year_start is null then
    raise exception 'A pickup term needs its academic year.' using errcode = '22023';
  end if;

  select * into v_node
  from public.ace_family_members
  where id = p_ace_member_id
  for update;
  if not found then
    raise exception 'ACE member % not found.', p_ace_member_id using errcode = 'P0002';
  end if;

  if p_evidence_id is not null then
    if p_academic_year_start is null then
      raise exception 'Approving evidence needs an academic year.' using errcode = '22023';
    end if;
    select * into v_evidence
    from public.ace_member_pickup_evidence
    where id = p_evidence_id and ace_member_id = p_ace_member_id
    for update;
    if not found then
      raise exception 'Evidence % does not belong to ACE member %.', p_evidence_id, p_ace_member_id
        using errcode = 'P0002';
    end if;
    if v_evidence.candidate_academic_year_start is distinct from p_academic_year_start
       or v_evidence.candidate_term is distinct from v_term then
      raise exception 'The approved value must match the evidence candidate.' using errcode = '22023';
    end if;
    if v_evidence.review_status <> 'approved' then
      update public.ace_member_pickup_evidence
      set review_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_evidence_id;
    end if;
  end if;

  v_changed := v_node.pickup_academic_year_start is distinct from p_academic_year_start
            or v_node.pickup_term is distinct from v_term;
  if v_changed then
    update public.ace_family_members
    set pickup_academic_year_start = p_academic_year_start,
        pickup_term = v_term
    where id = p_ace_member_id;

    -- Keep the review history consistent with the live value.
    update public.ace_member_pickup_evidence
    set review_status = 'superseded'
    where ace_member_id = p_ace_member_id
      and review_status = 'approved'
      and (candidate_academic_year_start is distinct from p_academic_year_start
           or candidate_term is distinct from v_term);
  end if;

  return jsonb_build_object(
    'ace_member_id', p_ace_member_id,
    'changed', v_changed,
    'previous', jsonb_build_object(
      'academic_year_start', v_node.pickup_academic_year_start,
      'term', v_node.pickup_term),
    'current', jsonb_build_object(
      'academic_year_start', p_academic_year_start,
      'term', v_term)
  );
end;
$$;

revoke execute on function public.set_ace_member_pickup_year(uuid, integer, text, uuid) from public, anon;
grant execute on function public.set_ace_member_pickup_year(uuid, integer, text, uuid) to authenticated;

-- ─── Public ACE tree view ───────────────────────────────────────────────────

-- Appends the two approved columns; every existing column keeps its name,
-- type, and order, and the published-member + published-fam filter is
-- unchanged. Evidence is never joined in.
create or replace view public.published_ace_family_members as
select
  m.id,
  m.family_id,
  m.name,
  m.role_label,
  m.photo_url,
  m.parent_member_id,
  m.display_order,
  m.created_at,
  m.updated_at,
  m.member_id,
  m.pickup_academic_year_start,
  m.pickup_term
from public.ace_family_members m
join public.ace_families f on f.id = m.family_id
where m.is_published = true and f.is_published = true;

revoke all on public.published_ace_family_members from anon, authenticated;
grant select on public.published_ace_family_members to anon, authenticated;
