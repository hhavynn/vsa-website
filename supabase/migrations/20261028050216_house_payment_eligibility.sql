-- House payment eligibility, post-payment reruns and the payment-cleared
-- Lock/Reveal gate (#656, #657, #658, #659, #660).
--
-- Applied to production 2026-10-28 (schema_migrations version 20261028050216)
-- via apply_migration, after staging verification on the production schema;
-- renamed from 20261028000000 to match. Only this comment differs from the
-- applied text (function bodies verified identical by md5).
--
-- WHY
--   CRC sorts House applicants first-come, first-served, then removes people
--   who never paid the House fee and sorts again. Until now payment lived only
--   in a free-text "excluded" reason, so nothing stopped a stale draft that
--   still contained an unpaid applicant from being locked and revealed.
--
-- WHAT
--   house_payment_cycles   One row per academic year and House application
--                          window (house_fall / house_winter / house_spring):
--                          payment deadline (stored as an instant; the admin
--                          UI enters America/Los_Angeles wall time), optional
--                          grace period, explicit cutoff authorization and a
--                          status_version that increases on every payment or
--                          cohort change.
--   house_applicants       The private, minimal application snapshot needed to
--                          rerun placement: name as typed, original submission
--                          instant, sheet row, ranked House ids, optional
--                          member link, payment status, withdrawal reason.
--                          No email, phone, amount, account number, receipt or
--                          other form answer.
--   house_payment_audit    Append-only history of every status, withdrawal,
--                          deadline and cutoff change (actor, time, reason,
--                          source, request id).
--   house_payment_requests Idempotency keys for payment-status requests, so a
--                          retried bulk update replays instead of re-applying.
--   house_assignment_batches gains lineage and eligibility columns
--                          (payment_cycle_id, eligibility_mode,
--                          payment_snapshot_version, revised_from_batch_id,
--                          generation_reason, applicant_set_fingerprint,
--                          eligibility_summary); drafts gain applicant_id.
--
--   Payment status changes only through
--   admin_set_house_applicant_payments (one transaction per request; optional
--   expected-version check; idempotent by request id; audited). Applicants
--   are registered only through admin_register_house_applicants, which refuses
--   to silently change a saved application.
--
-- THE GATE (#660)
--   A timestamp-priority batch is payment-gated when it names a payment cycle,
--   or when any payment cycle exists for its academic year (an older,
--   unlinked draft can then never be locked). house_batch_payment_blockers()
--   lists why a gated batch may not be locked or revealed: provisional
--   eligibility, cutoff not reached, payments changed since the sort, an
--   included applicant who is not Paid/Waived, an unresolved applicant, or an
--   eligible applicant missing from the draft. The batch status trigger
--   refuses draft -> locked and locked -> published while any blocker exists.
--   A row must place its application's confirmed member, never a member who
--   is also an uncleared applicant, and a roster is revealed at most once.
--   Reveal must start with admin_begin_house_batch_publish, which re-checks
--   the gate under row locks and freezes the cycle's payments and identities
--   until the batch is published or reopened; house_memberships rows sourced
--   from a gated batch (inserted, or moved to another House or batch) are refused
--   outside that window or for anyone not cleared. A draft revised by a rerun
--   is frozen. After Reveal nothing is changed automatically: later payment
--   edits are recorded for leadership review only.
--
-- SECURITY
--   Every new table: RLS on, all client privileges revoked, then admin-only
--   (is_admin_user) select, plus the narrowest column-level update grants. No
--   delete grants: eligibility history that supports a House decision is never
--   deletable from a client. RPCs are SECURITY DEFINER with search_path = ''
--   and an explicit is_admin_user check; EXECUTE is revoked from PUBLIC and
--   anon. Nothing here reads or writes members, attendance, points or any
--   public view, and nothing is exposed to anon.
--
-- ADDITIVE
--   No existing table, column, policy or grant is replaced. Manual batches
--   and timestamp batches in years without a payment cycle behave exactly as
--   before. Production had no House assignment batches when this was written
--   (checked read-only 2026-10-28).
--
-- DEPLOY
--   Apply this migration first (after scripts/test-house-payments.sh passes),
--   then ship the frontend. Verify: scripts/test-house-payments.sh offline.

-- ─── Payment cycles ──────────────────────────────────────────────────────────

create table if not exists public.house_payment_cycles (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  application_key text not null,
  payment_deadline timestamptz,
  grace_until timestamptz,
  deadline_note text,
  cutoff_authorized_at timestamptz,
  cutoff_authorized_by uuid references auth.users(id) on delete set null,
  cutoff_authorized_reason text,
  -- Required in the same update that changes the deadline after the cutoff.
  last_change_reason text,
  status_version bigint not null default 0,
  publishing_batch_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_payment_cycles_key_check
    check (application_key in ('house_fall', 'house_winter', 'house_spring')),
  constraint house_payment_cycles_grace_check
    check (grace_until is null or (payment_deadline is not null and grace_until > payment_deadline)),
  constraint house_payment_cycles_note_check
    check (deadline_note is null or char_length(deadline_note) <= 500),
  constraint house_payment_cycles_authorization_check
    check (cutoff_authorized_at is null or char_length(btrim(coalesce(cutoff_authorized_reason, ''))) between 1 and 500),
  constraint house_payment_cycles_version_check check (status_version >= 0),
  constraint house_payment_cycles_year_key unique (academic_year_start, application_key)
);

-- ─── Applicants (minimal application snapshot + payment status) ──────────────

create table if not exists public.house_applicants (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.house_payment_cycles(id) on delete restrict,
  -- "<submission instant ISO>#<sheet row>": stable within one Form responses sheet.
  applicant_key text not null,
  source_name text not null,
  submission_timestamp timestamptz not null,
  source_row_number integer not null,
  -- house_page_assets ids, first choice first.
  preferences jsonb not null,
  member_id uuid references public.members(id) on delete set null,
  match_status text not null default 'unmatched',
  match_method text,
  payment_status text not null default 'unverified',
  payment_evidence text,
  payment_reference text,
  payment_note text,
  payment_updated_by uuid references auth.users(id) on delete set null,
  payment_updated_at timestamptz,
  -- Non-payment reason this applicant is left out (withdrew, ineligible); null = included.
  withdrawn_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_applicants_cycle_key unique (cycle_id, applicant_key),
  constraint house_applicants_row_check check (source_row_number >= 1),
  constraint house_applicants_name_check check (char_length(btrim(source_name)) between 1 and 200),
  constraint house_applicants_preferences_check
    check (jsonb_typeof(preferences) = 'array' and jsonb_array_length(preferences) between 1 and 12),
  constraint house_applicants_match_status_check
    check (match_status in ('match', 'review', 'unmatched', 'manual')),
  constraint house_applicants_match_method_check
    check (match_method is null or match_method in ('email', 'name', 'manual')),
  constraint house_applicants_payment_status_check
    check (payment_status in ('unverified', 'pending', 'paid', 'unpaid', 'waived')),
  constraint house_applicants_payment_evidence_check
    check (payment_evidence is null or payment_evidence in ('payment_checklist', 'crc_confirmation', 'waiver_approval', 'other')),
  constraint house_applicants_reference_check
    check (payment_reference is null or char_length(payment_reference) <= 120),
  constraint house_applicants_note_check
    check (payment_note is null or char_length(payment_note) <= 500),
  constraint house_applicants_withdrawn_check
    check (withdrawn_reason is null or char_length(btrim(withdrawn_reason)) between 1 and 500)
);

create index if not exists house_applicants_cycle_status_idx
  on public.house_applicants (cycle_id, payment_status);
create index if not exists house_applicants_member_idx
  on public.house_applicants (member_id) where member_id is not null;

-- ─── Audit and idempotency ───────────────────────────────────────────────────

create table if not exists public.house_payment_audit (
  id bigint generated always as identity primary key,
  cycle_id uuid not null references public.house_payment_cycles(id) on delete restrict,
  applicant_id uuid references public.house_applicants(id) on delete restrict,
  event_type text not null,
  from_value text,
  to_value text,
  reason text,
  source text not null,
  request_id uuid,
  actor uuid,
  created_at timestamptz not null default now(),
  constraint house_payment_audit_event_check check (event_type in (
    'status_changed', 'withdrawal_changed', 'applicants_registered',
    'deadline_changed', 'cutoff_authorized', 'cutoff_revoked', 'member_link_changed',
    'publish_started', 'publish_released'
  )),
  constraint house_payment_audit_source_check check (source in (
    'single', 'bulk', 'checklist_import', 'placement_import', 'draft_bootstrap', 'admin', 'system'
  ))
);

create index if not exists house_payment_audit_cycle_idx
  on public.house_payment_audit (cycle_id, created_at desc);
create index if not exists house_payment_audit_applicant_idx
  on public.house_payment_audit (applicant_id, created_at desc) where applicant_id is not null;

create table if not exists public.house_payment_requests (
  request_id uuid primary key,
  cycle_id uuid not null references public.house_payment_cycles(id) on delete restrict,
  result jsonb not null,
  actor uuid,
  created_at timestamptz not null default now()
);

-- ─── Batch lineage and draft applicant links ─────────────────────────────────

alter table public.house_assignment_batches
  add column if not exists payment_cycle_id uuid references public.house_payment_cycles(id) on delete restrict,
  add column if not exists eligibility_mode text,
  add column if not exists payment_snapshot_version bigint,
  -- A revision keeps its original: deleting Draft A while Draft B exists is refused.
  add column if not exists revised_from_batch_id uuid references public.house_assignment_batches(id) on delete restrict,
  add column if not exists generation_reason text,
  add column if not exists applicant_set_fingerprint text,
  add column if not exists eligibility_summary jsonb;

alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_eligibility_mode_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_eligibility_mode_check
    check (eligibility_mode is null or eligibility_mode in ('provisional', 'final'));
alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_generation_reason_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_generation_reason_check
    check (generation_reason is null or generation_reason in ('initial', 'post_payment_rerun'));
alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_payment_link_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_payment_link_check
    check (
      payment_cycle_id is null
      or (assignment_method = 'timestamp_ranked' and eligibility_mode is not null and payment_snapshot_version is not null)
    );
alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_eligibility_summary_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_eligibility_summary_check
    check (eligibility_summary is null or jsonb_typeof(eligibility_summary) = 'object');

create index if not exists house_assignment_batches_cycle_idx
  on public.house_assignment_batches (payment_cycle_id) where payment_cycle_id is not null;
create index if not exists house_assignment_batches_revised_from_idx
  on public.house_assignment_batches (revised_from_batch_id) where revised_from_batch_id is not null;

alter table public.house_assignment_drafts
  add column if not exists applicant_id uuid references public.house_applicants(id) on delete restrict;

create unique index if not exists house_assignment_drafts_batch_applicant_key
  on public.house_assignment_drafts (batch_id, applicant_id) where applicant_id is not null;

alter table public.house_payment_cycles
  drop constraint if exists house_payment_cycles_publishing_batch_fkey;
alter table public.house_payment_cycles
  add constraint house_payment_cycles_publishing_batch_fkey
    foreign key (publishing_batch_id) references public.house_assignment_batches(id) on delete set null;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.house_payment_cutoff_reached(p_cycle public.house_payment_cycles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_cycle.cutoff_authorized_at is not null
    or (p_cycle.payment_deadline is not null and now() >= coalesce(p_cycle.grace_until, p_cycle.payment_deadline));
$$;

-- The payment cycle that governs a batch: its own, or (for an unlinked
-- timestamp-priority batch) any cycle of its year, so an older draft cannot
-- slip past the gate. Null means the batch is not payment-gated.
create or replace function public.house_batch_payment_cycle(p_batch public.house_assignment_batches)
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_batch.payment_cycle_id,
    case when p_batch.assignment_method = 'timestamp_ranked' then (
      select c.id from public.house_payment_cycles c
      where c.academic_year_start = p_batch.academic_year_start
      order by c.created_at, c.id
      limit 1
    ) end
  );
$$;

-- Reasons a payment-gated batch may not be locked or revealed. Empty when it
-- may (or when the batch is not payment-gated). SECURITY INVOKER: callers
-- see only what admin-only RLS lets them see.
create or replace function public.house_batch_payment_blockers(p_batch_id uuid)
returns text[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_batch public.house_assignment_batches%rowtype;
  v_cycle public.house_payment_cycles%rowtype;
  v_cycle_id uuid;
  v_blockers text[] := '{}';
  v_count integer;
begin
  select * into v_batch from public.house_assignment_batches where id = p_batch_id;
  if not found then
    return array['House assignment batch not found.'];
  end if;
  v_cycle_id := public.house_batch_payment_cycle(v_batch);
  if v_cycle_id is null then
    return v_blockers;
  end if;
  select * into v_cycle from public.house_payment_cycles where id = v_cycle_id;
  if not found then
    return array['The payment cycle for this draft could not be read. Nothing can be locked or revealed until it can.'];
  end if;

  if v_batch.payment_cycle_id is null then
    return array['This draft is not linked to the payment roster. Rerun sorting with payment-cleared applicants to create a draft that can be locked.'];
  end if;
  if v_batch.eligibility_mode is distinct from 'final' then
    v_blockers := v_blockers || 'This is a provisional sort that may include unpaid or unverified applicants. Rerun with payment-cleared applicants after the payment cutoff.'::text;
  end if;
  if not public.house_payment_cutoff_reached(v_cycle) then
    v_blockers := v_blockers || 'The payment cutoff has not been reached and no early cutoff was authorized.'::text;
  end if;
  if v_batch.payment_snapshot_version is distinct from v_cycle.status_version then
    v_blockers := v_blockers || 'Payments changed since this sort. Rerun sorting with the current payment statuses.'::text;
  end if;

  select count(*) into v_count
  from public.house_assignment_drafts d
  left join public.house_applicants a on a.id = d.applicant_id
  where d.batch_id = v_batch.id
    and (a.id is null or a.cycle_id <> v_cycle.id);
  if v_count > 0 then
    v_blockers := v_blockers || format('%s draft row(s) are not linked to an applicant in this payment roster.', v_count);
  end if;

  select count(*) into v_count
  from public.house_assignment_drafts d
  join public.house_applicants a on a.id = d.applicant_id
  where d.batch_id = v_batch.id
    and (a.payment_status not in ('paid', 'waived') or a.withdrawn_reason is not null);
  if v_count > 0 then
    v_blockers := v_blockers || format('%s included applicant(s) are not Paid or Waived, or were withdrawn.', v_count);
  end if;

  select count(*) into v_count
  from public.house_applicants a
  where a.cycle_id = v_cycle.id
    and a.withdrawn_reason is null
    and a.payment_status in ('unverified', 'pending');
  if v_count > 0 then
    v_blockers := v_blockers || format('%s applicant(s) still have an unverified or pending payment.', v_count);
  end if;

  select count(*) into v_count
  from public.house_applicants a
  where a.cycle_id = v_cycle.id
    and a.withdrawn_reason is null
    and a.payment_status in ('paid', 'waived')
    and not exists (
      select 1 from public.house_assignment_drafts d
      where d.batch_id = v_batch.id and d.applicant_id = a.id
    );
  if v_count > 0 then
    v_blockers := v_blockers || format('%s Paid or Waived applicant(s) are missing from this draft.', v_count);
  end if;

  -- Payment is judged per application, but the person revealed is the row's
  -- member. A row may not place someone other than its application's
  -- confirmed member, nor a member who is also an uncleared applicant.
  select count(*) into v_count
  from public.house_assignment_drafts d
  join public.house_applicants a on a.id = d.applicant_id
  where d.batch_id = v_batch.id
    and a.member_id is not null
    and a.match_status in ('match', 'manual')
    and d.member_id is distinct from a.member_id;
  if v_count > 0 then
    v_blockers := v_blockers || format('%s draft row(s) place a different member than their application''s confirmed member. Fix the link on the payment roster and rerun.', v_count);
  end if;

  select count(*) into v_count
  from public.house_assignment_drafts d
  where d.batch_id = v_batch.id
    and d.member_id is not null
    and exists (
      select 1 from public.house_applicants o
      where o.cycle_id = v_cycle.id
        and o.member_id = d.member_id
        and (o.payment_status not in ('paid', 'waived') or o.withdrawn_reason is not null)
    );
  if v_count > 0 then
    v_blockers := v_blockers || format('%s placed member(s) are also linked to an application that is not Paid or Waived.', v_count);
  end if;

  if exists (
    select 1 from public.house_assignment_batches b
    where b.payment_cycle_id = v_cycle.id and b.status = 'published' and b.id <> v_batch.id
  ) then
    v_blockers := v_blockers || 'Houses for this payment roster were already revealed. Later corrections go through leadership review, not a second Reveal.'::text;
  end if;

  return v_blockers;
end;
$$;

-- ─── Batch guard: lineage is fixed; Lock and Reveal pass the gate ────────────

create or replace function public.guard_house_batch_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.house_payment_cycles%rowtype;
  v_source public.house_assignment_batches%rowtype;
  v_blockers text[];
begin
  if tg_op = 'INSERT' then
    if new.payment_cycle_id is not null then
      select * into v_cycle from public.house_payment_cycles where id = new.payment_cycle_id for update;
      if v_cycle.academic_year_start <> new.academic_year_start then
        raise exception 'The payment cycle belongs to another academic year.' using errcode = '23514';
      end if;
      if new.eligibility_mode = 'final' then
        if new.payment_snapshot_version <> v_cycle.status_version then
          raise exception 'Payments changed since this sort was generated. Rerun before saving.' using errcode = '40001';
        end if;
        if not public.house_payment_cutoff_reached(v_cycle) then
          raise exception 'A final payment-cleared draft needs the payment cutoff to be reached or authorized.' using errcode = '23514';
        end if;
      elsif new.payment_snapshot_version > v_cycle.status_version then
        raise exception 'The payment snapshot version is newer than the payment roster.' using errcode = '23514';
      end if;
    end if;
    if new.revised_from_batch_id is not null then
      select * into v_source from public.house_assignment_batches where id = new.revised_from_batch_id;
      if not found or v_source.academic_year_start <> new.academic_year_start then
        raise exception 'A revised draft must come from a batch of the same academic year.' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if new.payment_cycle_id is distinct from old.payment_cycle_id
    or new.eligibility_mode is distinct from old.eligibility_mode
    or new.payment_snapshot_version is distinct from old.payment_snapshot_version
    or new.revised_from_batch_id is distinct from old.revised_from_batch_id
    or new.generation_reason is distinct from old.generation_reason
    or new.applicant_set_fingerprint is distinct from old.applicant_set_fingerprint
    or new.eligibility_summary is distinct from old.eligibility_summary then
    raise exception 'A draft''s payment eligibility and lineage are fixed when it is saved. Rerun to make a new draft.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('locked', 'published') then
      v_blockers := public.house_batch_payment_blockers(new.id);
      if cardinality(v_blockers) > 0 then
        raise exception 'Payment eligibility blocks this: %', v_blockers[1] using errcode = '23514';
      end if;
    end if;
    if new.status = 'published' and public.house_batch_payment_cycle(new) is not null then
      if not exists (
        select 1 from public.house_payment_cycles c
        where c.id = new.payment_cycle_id and c.publishing_batch_id = new.id
      ) then
        raise exception 'Start the Reveal with admin_begin_house_batch_publish before publishing.' using errcode = '23514';
      end if;
    end if;
    if new.payment_cycle_id is not null and new.status in ('published', 'draft', 'archived') then
      update public.house_payment_cycles
      set publishing_batch_id = null
      where id = new.payment_cycle_id and publishing_batch_id = new.id;
      if found then
        insert into public.house_payment_audit (cycle_id, event_type, from_value, to_value, source, actor)
        values (new.payment_cycle_id, 'publish_released', new.id::text, new.status, 'system', auth.uid());
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_house_batch_payment on public.house_assignment_batches;
create trigger guard_house_batch_payment
  before insert or update on public.house_assignment_batches
  for each row
  execute function public.guard_house_batch_payment();

-- A draft row's applicant must belong to its batch's payment cycle.
create or replace function public.guard_house_draft_applicant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.applicant_id is not null and not exists (
    select 1
    from public.house_assignment_batches b
    join public.house_applicants a on a.cycle_id = b.payment_cycle_id
    where b.id = new.batch_id and a.id = new.applicant_id
  ) then
    raise exception 'This applicant does not belong to the draft''s payment roster.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A draft that a rerun revised is the audit record of the original sort: its
-- rows never change again (deleting the batch is refused by the foreign key).
create or replace function public.guard_house_revised_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid := case when tg_op = 'INSERT' then new.batch_id else old.batch_id end;
begin
  if exists (select 1 from public.house_assignment_batches b where b.revised_from_batch_id = v_batch_id) then
    raise exception 'This draft was revised by a rerun and is kept unchanged. Edit the newer draft instead.' using errcode = '55006';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_house_revised_draft on public.house_assignment_drafts;
create trigger guard_house_revised_draft
  before insert or update or delete on public.house_assignment_drafts
  for each row
  execute function public.guard_house_revised_draft();

drop trigger if exists guard_house_draft_applicant on public.house_assignment_drafts;
create trigger guard_house_draft_applicant
  before insert or update of applicant_id, batch_id on public.house_assignment_drafts
  for each row
  execute function public.guard_house_draft_applicant();

-- ─── Cycle guard: deadline changes after the cutoff are explicit ─────────────

create or replace function public.guard_house_payment_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(new.last_change_reason, '')), '');
  v_deadline_changed boolean;
  v_authorization_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status_version <> 0 or new.publishing_batch_id is not null or new.cutoff_authorized_at is not null
      or new.payment_deadline is not null or new.grace_until is not null then
      raise exception 'Create the payment roster first, then set its deadline (so the change is recorded).' using errcode = '23514';
    end if;
    new.last_change_reason := null;
    return new;
  end if;

  if new.academic_year_start <> old.academic_year_start or new.application_key <> old.application_key then
    raise exception 'A payment cycle''s year and application window are fixed.' using errcode = '23514';
  end if;

  v_deadline_changed := new.payment_deadline is distinct from old.payment_deadline
    or new.grace_until is distinct from old.grace_until;
  v_authorization_changed := new.cutoff_authorized_at is distinct from old.cutoff_authorized_at
    or new.cutoff_authorized_reason is distinct from old.cutoff_authorized_reason;

  if (v_deadline_changed or v_authorization_changed) and old.publishing_batch_id is not null then
    raise exception 'A Reveal is in progress for this payment cycle; the deadline cannot change now.' using errcode = '55006';
  end if;
  if v_deadline_changed and v_reason is null and (
    public.house_payment_cutoff_reached(old)
    or (new.payment_deadline is not null and coalesce(new.grace_until, new.payment_deadline) <= now())
  ) then
    raise exception 'Give a reason: the deadline has passed, or this change would end payments now.' using errcode = '23514';
  end if;

  if v_authorization_changed then
    if new.cutoff_authorized_at is not null then
      new.cutoff_authorized_at := now();
      new.cutoff_authorized_by := auth.uid();
    else
      new.cutoff_authorized_by := null;
      new.cutoff_authorized_reason := null;
    end if;
  else
    new.cutoff_authorized_by := old.cutoff_authorized_by;
  end if;

  if v_deadline_changed then
    insert into public.house_payment_audit (cycle_id, event_type, from_value, to_value, reason, source, actor)
    values (
      new.id, 'deadline_changed',
      concat_ws(' / ', old.payment_deadline::text, old.grace_until::text),
      concat_ws(' / ', new.payment_deadline::text, new.grace_until::text),
      v_reason, 'admin', auth.uid()
    );
  end if;
  if v_authorization_changed then
    insert into public.house_payment_audit (cycle_id, event_type, from_value, to_value, reason, source, actor)
    values (
      new.id,
      case when new.cutoff_authorized_at is null then 'cutoff_revoked' else 'cutoff_authorized' end,
      old.cutoff_authorized_at::text, new.cutoff_authorized_at::text,
      coalesce(new.cutoff_authorized_reason, v_reason), 'admin', auth.uid()
    );
  end if;
  new.last_change_reason := null;
  return new;
end;
$$;

drop trigger if exists guard_house_payment_cycle on public.house_payment_cycles;
create trigger guard_house_payment_cycle
  before insert or update on public.house_payment_cycles
  for each row
  execute function public.guard_house_payment_cycle();

drop trigger if exists update_house_payment_cycles_updated_at on public.house_payment_cycles;
create trigger update_house_payment_cycles_updated_at
  before update on public.house_payment_cycles
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_house_applicants_updated_at on public.house_applicants;
create trigger update_house_applicants_updated_at
  before update on public.house_applicants
  for each row
  execute function public.update_updated_at_column();

-- ─── Membership guard: a gated batch writes only cleared members, only ──────
-- ─── inside its Reveal window ────────────────────────────────────────────────

create or replace function public.guard_house_membership_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.house_assignment_batches%rowtype;
  v_cycle_id uuid;
begin
  if new.source is distinct from 'house_assignment_batch' then
    return new;
  end if;
  if new.source_import_id is null then
    raise exception 'A House membership from an assignment batch must name its batch.' using errcode = '42501';
  end if;
  select * into v_batch from public.house_assignment_batches where id = new.source_import_id;
  if not found then
    raise exception 'The House assignment batch for this membership does not exist.' using errcode = '42501';
  end if;
  v_cycle_id := public.house_batch_payment_cycle(v_batch);
  if v_cycle_id is null then
    return new;
  end if;
  if v_batch.payment_cycle_id is null or not exists (
    select 1 from public.house_payment_cycles c
    where c.id = v_batch.payment_cycle_id and c.publishing_batch_id = v_batch.id
  ) or v_batch.status <> 'locked' then
    raise exception 'House memberships from a payment-gated draft can only be written during its Reveal.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.house_assignment_drafts d
    join public.house_applicants a on a.id = d.applicant_id
    where d.batch_id = v_batch.id
      and d.member_id = new.member_id
      and d.house_profile_id = new.house_profile_id
      and a.payment_status in ('paid', 'waived')
      and a.withdrawn_reason is null
      and (a.member_id is null or a.match_status not in ('match', 'manual') or a.member_id = new.member_id)
  ) or exists (
    select 1 from public.house_applicants o
    where o.cycle_id = v_batch.payment_cycle_id
      and o.member_id = new.member_id
      and (o.payment_status not in ('paid', 'waived') or o.withdrawn_reason is not null)
  ) then
    raise exception 'This member is not a payment-cleared placement in the draft being revealed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_house_membership_payment on public.house_memberships;
-- Not on member_id updates: smart_merge_members repoints memberships to the
-- surviving member, which must keep working after a Reveal.
create trigger guard_house_membership_payment
  before insert or update of house_profile_id, source, source_import_id on public.house_memberships
  for each row
  execute function public.guard_house_membership_payment();

-- ─── RPC: register applicants (the rerun snapshot) ───────────────────────────

create or replace function public.admin_register_house_applicants(
  p_cycle_id uuid,
  p_applicants jsonb,
  p_source text default 'placement_import'
)
returns table (applicant_key text, applicant_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.house_payment_cycles%rowtype;
  v_item jsonb;
  v_key text;
  v_name text;
  v_ts timestamptz;
  v_row integer;
  v_prefs jsonb;
  v_member uuid;
  v_match text;
  v_method text;
  v_existing public.house_applicants%rowtype;
  v_created integer := 0;
  v_id uuid;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can register House applicants.' using errcode = '42501';
  end if;
  if p_source not in ('placement_import', 'draft_bootstrap') then
    raise exception 'Unknown applicant source %.', p_source using errcode = '22023';
  end if;
  if jsonb_typeof(p_applicants) is distinct from 'array' or jsonb_array_length(p_applicants) = 0 then
    raise exception 'Send at least one applicant.' using errcode = '22023';
  end if;
  select * into v_cycle from public.house_payment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Payment cycle not found.' using errcode = 'P0002';
  end if;
  if v_cycle.publishing_batch_id is not null then
    raise exception 'A Reveal is in progress for this payment cycle.' using errcode = '55006';
  end if;
  if (select count(distinct item->>'applicant_key') from jsonb_array_elements(p_applicants) item) <> jsonb_array_length(p_applicants) then
    raise exception 'The same applicant key appears twice.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_applicants) loop
    v_key := nullif(btrim(coalesce(v_item->>'applicant_key', '')), '');
    v_name := btrim(coalesce(v_item->>'source_name', ''));
    v_ts := (v_item->>'submission_timestamp')::timestamptz;
    v_row := (v_item->>'source_row_number')::integer;
    v_prefs := v_item->'preferences';
    v_member := nullif(v_item->>'member_id', '')::uuid;
    v_match := coalesce(nullif(v_item->>'match_status', ''), 'unmatched');
    v_method := nullif(v_item->>'match_method', '');
    if v_key is null or v_ts is null or v_row is null or v_prefs is null then
      raise exception 'Applicant % is missing its key, submission time, sheet row or ranking.', coalesce(v_name, '?') using errcode = '22023';
    end if;
    if v_member is null then
      v_match := 'unmatched';
      v_method := null;
    end if;

    select * into v_existing from public.house_applicants a where a.cycle_id = p_cycle_id and a.applicant_key = v_key;
    if found then
      if v_existing.source_name <> v_name
        or v_existing.submission_timestamp <> v_ts
        or v_existing.source_row_number <> v_row
        or v_existing.preferences <> v_prefs then
        raise exception 'Sheet row % (%) differs from the application already saved for this cycle. Re-export the original responses sheet; a saved application is never silently changed.', v_row, v_name using errcode = '23514';
      end if;
      if v_existing.member_id is null and v_member is not null then
        update public.house_applicants
        set member_id = v_member, match_status = v_match, match_method = v_method
        where id = v_existing.id;
      end if;
      applicant_key := v_key; applicant_id := v_existing.id; created := false;
      return next;
    else
      if exists (
        select 1 from public.house_applicants a
        where a.cycle_id = p_cycle_id
          and a.submission_timestamp = v_ts
          and lower(a.source_name) = lower(v_name)
      ) then
        raise exception 'Sheet row % (%) matches a saved application at a different sheet row. The responses sheet changed; re-export it unchanged.', v_row, v_name using errcode = '23514';
      end if;
      insert into public.house_applicants (
        cycle_id, applicant_key, source_name, submission_timestamp, source_row_number,
        preferences, member_id, match_status, match_method, created_by
      ) values (
        p_cycle_id, v_key, v_name, v_ts, v_row, v_prefs, v_member, v_match, v_method, auth.uid()
      ) returning id into v_id;
      v_created := v_created + 1;
      applicant_key := v_key; applicant_id := v_id; created := true;
      return next;
    end if;
  end loop;

  if v_created > 0 then
    update public.house_payment_cycles set status_version = status_version + 1 where id = p_cycle_id;
    insert into public.house_payment_audit (cycle_id, event_type, to_value, source, actor)
    values (p_cycle_id, 'applicants_registered', v_created::text, p_source, auth.uid());
  end if;
end;
$$;

-- ─── RPC: change payment status / withdrawal (single, bulk, checklist) ──────

create or replace function public.admin_set_house_applicant_payments(
  p_cycle_id uuid,
  p_changes jsonb,
  p_source text,
  p_reason text,
  p_request_id uuid,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.house_payment_cycles%rowtype;
  v_prior public.house_payment_requests%rowtype;
  v_item jsonb;
  v_applicant public.house_applicants%rowtype;
  v_status text;
  v_evidence text;
  v_reference text;
  v_note text;
  v_withdrawn text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_applied integer := 0;
  v_unchanged integer := 0;
  v_kept_waivers integer := 0;
  v_changed boolean;
  v_bump boolean := false;
  v_result jsonb;
  v_post_reveal boolean;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can change House payment eligibility.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'A request id is required so a retry cannot apply twice.' using errcode = '22023';
  end if;
  if p_source not in ('single', 'bulk', 'checklist_import') then
    raise exception 'Unknown payment change source %.', p_source using errcode = '22023';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'Send at least one change.' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'The reason is longer than 500 characters.' using errcode = '22023';
  end if;

  select * into v_cycle from public.house_payment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Payment cycle not found.' using errcode = 'P0002';
  end if;

  select * into v_prior from public.house_payment_requests where request_id = p_request_id;
  if found then
    if v_prior.cycle_id <> p_cycle_id then
      raise exception 'This request id was already used for another payment cycle.' using errcode = '22023';
    end if;
    return v_prior.result || jsonb_build_object('replayed', true);
  end if;

  if v_cycle.publishing_batch_id is not null then
    raise exception 'A Reveal is in progress for this payment cycle; payment statuses are frozen until it finishes.' using errcode = '55006';
  end if;
  if p_expected_version is not null and p_expected_version <> v_cycle.status_version then
    raise exception 'Payments changed since this preview (version % is now %). Refresh and review again.', p_expected_version, v_cycle.status_version using errcode = '40001';
  end if;
  if (select count(distinct item->>'applicant_id') from jsonb_array_elements(p_changes) item) <> jsonb_array_length(p_changes) then
    raise exception 'The same applicant appears twice in one request.' using errcode = '22023';
  end if;

  v_post_reveal := exists (
    select 1 from public.house_assignment_batches b
    where b.payment_cycle_id = p_cycle_id and b.status = 'published'
  );

  for v_item in select * from jsonb_array_elements(p_changes) loop
    select * into v_applicant
    from public.house_applicants
    where id = nullif(v_item->>'applicant_id', '')::uuid and cycle_id = p_cycle_id
    for update;
    if not found then
      raise exception 'An applicant in this request does not belong to this payment cycle.' using errcode = '23514';
    end if;

    v_status := coalesce(nullif(v_item->>'payment_status', ''), v_applicant.payment_status);
    if v_status not in ('unverified', 'pending', 'paid', 'unpaid', 'waived') then
      raise exception 'Unknown payment status %.', v_status using errcode = '22023';
    end if;
    v_evidence := case when v_item ? 'payment_evidence' then nullif(v_item->>'payment_evidence', '') else v_applicant.payment_evidence end;
    v_reference := case when v_item ? 'payment_reference' then nullif(btrim(v_item->>'payment_reference'), '') else v_applicant.payment_reference end;
    v_note := case when v_item ? 'payment_note' then nullif(btrim(v_item->>'payment_note'), '') else v_applicant.payment_note end;
    v_withdrawn := case when v_item ? 'withdrawn_reason' then nullif(btrim(v_item->>'withdrawn_reason'), '') else v_applicant.withdrawn_reason end;

    if p_source = 'checklist_import' and v_applicant.payment_status = 'waived' and v_status <> 'waived' then
      v_kept_waivers := v_kept_waivers + 1;
      continue;
    end if;
    if v_status = 'waived' and v_applicant.payment_status <> 'waived'
      and v_reason is null and not (v_item ? 'payment_note' and v_note is not null) then
      raise exception 'A waiver needs a documented authorization reason.' using errcode = '23514';
    end if;

    v_changed := v_status <> v_applicant.payment_status
      or v_evidence is distinct from v_applicant.payment_evidence
      or v_reference is distinct from v_applicant.payment_reference
      or v_note is distinct from v_applicant.payment_note
      or v_withdrawn is distinct from v_applicant.withdrawn_reason;
    if not v_changed then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    update public.house_applicants
    set payment_status = v_status,
        payment_evidence = v_evidence,
        payment_reference = v_reference,
        payment_note = v_note,
        withdrawn_reason = v_withdrawn,
        payment_updated_by = auth.uid(),
        payment_updated_at = now()
    where id = v_applicant.id;

    if v_status <> v_applicant.payment_status or v_withdrawn is distinct from v_applicant.withdrawn_reason then
      v_bump := true;
    end if;
    if v_status <> v_applicant.payment_status then
      insert into public.house_payment_audit (cycle_id, applicant_id, event_type, from_value, to_value, reason, source, request_id, actor)
      values (p_cycle_id, v_applicant.id, 'status_changed', v_applicant.payment_status, v_status,
        nullif(concat_ws(' · ', v_reason, case when v_post_reveal then 'after Reveal: leadership review, no House change made' end), ''),
        p_source, p_request_id, auth.uid());
    end if;
    if v_withdrawn is distinct from v_applicant.withdrawn_reason then
      insert into public.house_payment_audit (cycle_id, applicant_id, event_type, from_value, to_value, reason, source, request_id, actor)
      values (p_cycle_id, v_applicant.id, 'withdrawal_changed', v_applicant.withdrawn_reason, v_withdrawn, v_reason, p_source, p_request_id, auth.uid());
    end if;
    v_applied := v_applied + 1;
  end loop;

  -- Only eligibility changes make saved sorts stale; a note or evidence edit does not.
  if v_bump then
    update public.house_payment_cycles set status_version = status_version + 1 where id = p_cycle_id
    returning * into v_cycle;
  end if;

  v_result := jsonb_build_object(
    'applied', v_applied,
    'unchanged', v_unchanged,
    'kept_waivers', v_kept_waivers,
    'status_version', v_cycle.status_version,
    'post_reveal', v_post_reveal,
    'replayed', false
  );
  insert into public.house_payment_requests (request_id, cycle_id, result, actor)
  values (p_request_id, p_cycle_id, v_result, auth.uid());
  return v_result;
end;
$$;

-- ─── RPC: confirm or correct an applicant's member link ─────────────────────
-- Identity decides who a cleared application reveals, so a change is audited,
-- refused during a Reveal, and makes every saved sort for the roster stale.

create or replace function public.admin_link_house_applicant_member(
  p_applicant_id uuid,
  p_member_id uuid,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applicant public.house_applicants%rowtype;
  v_cycle public.house_payment_cycles%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can link House applicants.' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 500 then
    raise exception 'Give a reason (up to 500 characters) for the identity change.' using errcode = '22023';
  end if;
  select * into v_applicant from public.house_applicants where id = p_applicant_id;
  if not found then
    raise exception 'Applicant not found.' using errcode = 'P0002';
  end if;
  select * into v_cycle from public.house_payment_cycles where id = v_applicant.cycle_id for update;
  if v_cycle.publishing_batch_id is not null then
    raise exception 'A Reveal is in progress for this payment cycle; identities are frozen until it finishes.' using errcode = '55006';
  end if;
  if p_member_id is not distinct from v_applicant.member_id and v_applicant.match_status = 'manual' then
    return v_cycle.status_version;
  end if;
  if p_member_id is not null and exists (
    select 1 from public.house_applicants o
    where o.cycle_id = v_applicant.cycle_id and o.member_id = p_member_id and o.id <> v_applicant.id
      and o.match_status in ('match', 'manual')
  ) then
    raise exception 'That member is already the confirmed member of another application in this roster.' using errcode = '23514';
  end if;
  update public.house_applicants
  set member_id = p_member_id,
      match_status = case when p_member_id is null then 'unmatched' else 'manual' end,
      match_method = case when p_member_id is null then null else 'manual' end
  where id = v_applicant.id;
  update public.house_payment_cycles set status_version = status_version + 1 where id = v_cycle.id
  returning * into v_cycle;
  insert into public.house_payment_audit (cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor)
  values (v_cycle.id, v_applicant.id, 'member_link_changed', v_applicant.member_id::text, p_member_id::text, v_reason, 'single', auth.uid());
  return v_cycle.status_version;
end;
$$;

-- ─── RPC: start a Reveal (re-check the gate and freeze payments) ─────────────

create or replace function public.admin_begin_house_batch_publish(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.house_assignment_batches%rowtype;
  v_cycle public.house_payment_cycles%rowtype;
  v_blockers text[];
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can reveal House assignments.' using errcode = '42501';
  end if;
  select * into v_batch from public.house_assignment_batches where id = p_batch_id;
  if not found then
    raise exception 'House assignment batch not found.' using errcode = 'P0002';
  end if;
  if public.house_batch_payment_cycle(v_batch) is null then
    return;
  end if;
  if v_batch.payment_cycle_id is null then
    raise exception 'This draft is not linked to the payment roster. Rerun sorting with payment-cleared applicants.' using errcode = '23514';
  end if;
  -- Same lock order as the batch status trigger (batch, then cycle).
  select * into v_batch from public.house_assignment_batches where id = p_batch_id for update;
  select * into v_cycle from public.house_payment_cycles where id = v_batch.payment_cycle_id for update;
  if v_batch.status <> 'locked' then
    raise exception 'Only a locked batch can be revealed (this one is %).', v_batch.status using errcode = '23514';
  end if;
  if v_cycle.publishing_batch_id is not null then
    if v_cycle.publishing_batch_id = v_batch.id then
      return;
    end if;
    raise exception 'Another draft''s Reveal is already in progress for this payment cycle.' using errcode = '55006';
  end if;
  v_blockers := public.house_batch_payment_blockers(p_batch_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Payment eligibility blocks this Reveal: %', v_blockers[1] using errcode = '23514';
  end if;
  update public.house_payment_cycles set publishing_batch_id = v_batch.id where id = v_cycle.id;
  insert into public.house_payment_audit (cycle_id, event_type, to_value, source, actor)
  values (v_cycle.id, 'publish_started', v_batch.id::text, 'admin', auth.uid());
end;
$$;

-- ─── RLS and grants ──────────────────────────────────────────────────────────

alter table public.house_payment_cycles enable row level security;
alter table public.house_applicants enable row level security;
alter table public.house_payment_audit enable row level security;
alter table public.house_payment_requests enable row level security;

revoke all on public.house_payment_cycles from anon, authenticated;
revoke all on public.house_applicants from anon, authenticated;
revoke all on public.house_payment_audit from anon, authenticated;
revoke all on public.house_payment_requests from anon, authenticated;

grant select, insert on public.house_payment_cycles to authenticated;
grant update (payment_deadline, grace_until, deadline_note, cutoff_authorized_at, cutoff_authorized_reason, last_change_reason)
  on public.house_payment_cycles to authenticated;
grant select on public.house_applicants to authenticated;
grant select on public.house_payment_audit to authenticated;

drop policy if exists "Admins can view House payment cycles" on public.house_payment_cycles;
create policy "Admins can view House payment cycles"
  on public.house_payment_cycles for select to authenticated
  using (public.is_admin_user(auth.uid()));
drop policy if exists "Admins can create House payment cycles" on public.house_payment_cycles;
create policy "Admins can create House payment cycles"
  on public.house_payment_cycles for insert to authenticated
  with check (public.is_admin_user(auth.uid()));
drop policy if exists "Admins can update House payment cycles" on public.house_payment_cycles;
create policy "Admins can update House payment cycles"
  on public.house_payment_cycles for update to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can view House applicants" on public.house_applicants;
create policy "Admins can view House applicants"
  on public.house_applicants for select to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can view House payment audit" on public.house_payment_audit;
create policy "Admins can view House payment audit"
  on public.house_payment_audit for select to authenticated
  using (public.is_admin_user(auth.uid()));

-- house_batch_payment_blockers runs as the calling admin, so its helpers need
-- EXECUTE for authenticated too. They read nothing an admin cannot already read.
revoke execute on function public.house_payment_cutoff_reached(public.house_payment_cycles) from public, anon;
grant execute on function public.house_payment_cutoff_reached(public.house_payment_cycles) to authenticated;
revoke execute on function public.house_batch_payment_cycle(public.house_assignment_batches) from public, anon;
grant execute on function public.house_batch_payment_cycle(public.house_assignment_batches) to authenticated;
revoke execute on function public.house_batch_payment_blockers(uuid) from public, anon;
grant execute on function public.house_batch_payment_blockers(uuid) to authenticated;

revoke execute on function public.guard_house_batch_payment() from public, anon, authenticated;
revoke execute on function public.guard_house_draft_applicant() from public, anon, authenticated;
revoke execute on function public.guard_house_revised_draft() from public, anon, authenticated;
revoke execute on function public.guard_house_payment_cycle() from public, anon, authenticated;
revoke execute on function public.guard_house_membership_payment() from public, anon, authenticated;

revoke execute on function public.admin_register_house_applicants(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_register_house_applicants(uuid, jsonb, text) to authenticated;
revoke execute on function public.admin_set_house_applicant_payments(uuid, jsonb, text, text, uuid, bigint) from public, anon;
grant execute on function public.admin_set_house_applicant_payments(uuid, jsonb, text, text, uuid, bigint) to authenticated;
revoke execute on function public.admin_link_house_applicant_member(uuid, uuid, text) from public, anon;
grant execute on function public.admin_link_house_applicant_member(uuid, uuid, text) to authenticated;
revoke execute on function public.admin_begin_house_batch_publish(uuid) from public, anon;
grant execute on function public.admin_begin_house_batch_publish(uuid) to authenticated;

comment on table public.house_payment_cycles is
  'Admin-only. One House application window per academic year: payment deadline (instant; entered as America/Los_Angeles), grace, explicit cutoff authorization, status_version.';
comment on table public.house_applicants is
  'Admin-only minimal House application snapshot for reruns plus payment eligibility. No email, contact, amount, account or receipt data.';
comment on table public.house_payment_audit is
  'Admin-only, append-only history of House payment eligibility, deadline and Reveal-window changes.';
comment on table public.house_payment_requests is
  'No client access. Idempotency keys for admin_set_house_applicant_payments.';
comment on column public.house_assignment_batches.eligibility_mode is
  'provisional (may include unpaid/unverified applicants; never lockable) or final (payment-cleared at payment_snapshot_version).';
comment on column public.house_assignment_batches.revised_from_batch_id is
  'The draft this one was rerun from. The original is kept unchanged and cannot be deleted while a revision exists.';
