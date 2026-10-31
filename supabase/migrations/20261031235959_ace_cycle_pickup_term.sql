-- #674: verified pickup term on newly published Littles (review-gated).
-- DO NOT apply from an automatic deploy. Requires 20261027190000 pickup-year
-- evidence schema. Owner should check existing locked cycles before applying:
-- a legacy locked cycle with no term must be unlocked and reviewed first.
-- No existing nodes, parent edges, photos, member links or published dates change.
-- New source rows are private under the existing evidence RLS. This migration
-- is idempotent for schema objects and function definitions, not a backfill.

do $prerequisite$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ace_family_members'
      and column_name = 'pickup_term'
  ) or to_regclass('public.ace_member_pickup_evidence') is null then
    raise exception 'ACE pickup year schema 20261027190000 must be applied first';
  end if;
end;
$prerequisite$;

alter table public.ace_assignment_cycles
  add column if not exists pickup_term text;

alter table public.ace_assignment_cycles
  drop constraint if exists ace_assignment_cycles_pickup_term_valid;
alter table public.ace_assignment_cycles
  add constraint ace_assignment_cycles_pickup_term_valid check (
    pickup_term is null
    or (
      academic_year_start between 1960 and 2100
      and case
        when pickup_term !~ '^(FA|WI|SP)[0-9]{2}$' then false
        when left(pickup_term, 2) = 'FA'
          then substr(pickup_term, 3)::integer = academic_year_start % 100
        else substr(pickup_term, 3)::integer = (academic_year_start + 1) % 100
      end
    )
  );

-- Existing one-per-year index prevents a Fall + Spring cycle. Keep only one
-- *open* cycle per year/term, treating NULL as a distinct legacy slot.
create unique index if not exists ace_assignment_cycles_one_open_per_term
  on public.ace_assignment_cycles (academic_year_start, pickup_term)
  nulls not distinct where status <> 'archived';
drop index if exists public.ace_assignment_cycles_one_open_per_year;

create or replace function public.guard_ace_assignment_cycle_term()
returns trigger language plpgsql security definer set search_path = ''
as $guard$
begin
  if old.status <> 'draft'
     and new.pickup_term is distinct from old.pickup_term then
    raise exception 'Unlock the assignment cycle before changing its pickup term';
  end if;
  if old.status = 'draft' and new.status = 'locked'
     and new.pickup_term is null then
    raise exception 'Choose the pickup term before locking';
  end if;
  return new;
end;
$guard$;
drop trigger if exists guard_ace_assignment_cycle_term
  on public.ace_assignment_cycles;
create trigger guard_ace_assignment_cycle_term
  before update on public.ace_assignment_cycles
  for each row execute function public.guard_ace_assignment_cycle_term();
revoke execute on function public.guard_ace_assignment_cycle_term()
  from public, anon, authenticated;

comment on column public.ace_assignment_cycles.pickup_term is
  'Admin-selected academic-cycle pickup term (FA26/WI27/SP27 for 2026–27), frozen at Lock; never inferred from submission date or Big.';

-- Exact current atomic publish body from 20261001213356, modified only to
-- require an approved term, stamp newly created Littles, and insert their
-- private reviewed provenance. The existing admin gate, row lock, blockers,
-- transaction-local publish flag and idempotent published retry are retained.

create or replace function public.publish_ace_assignment_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.ace_assignment_cycles%rowtype;
  v_total integer;
  v_created integer := 0;
  v_problems text[] := array[]::text[];
  v_count integer;
  v_draft public.ace_assignment_drafts%rowtype;
  v_big public.ace_family_members%rowtype;
  v_order integer;
  v_node_id uuid;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.ace_assignment_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Assignment cycle not found';
  end if;

  select count(*) into v_total
  from public.ace_assignment_drafts where cycle_id = p_cycle_id;

  if v_cycle.status = 'published' then
    return jsonb_build_object(
      'cycle_id', p_cycle_id, 'status', 'published',
      'created', 0, 'total', v_total, 'already_published', true
    );
  end if;

  if v_cycle.status <> 'locked' then
    raise exception 'Lock the assignment cycle before publishing (it is %)', v_cycle.status;
  end if;

  if v_total = 0 then
    raise exception 'Nothing to publish: this cycle has no Littles';
  end if;

  if v_cycle.pickup_term is null then
    v_problems := v_problems || 'Choose the pickup term before publishing';
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts
  where cycle_id = p_cycle_id and big_ace_member_id is null;
  if v_count > 0 then
    v_problems := v_problems || format('%s Little(s) have no Big (or their Big was deleted)', v_count);
  end if;

  select count(*) into v_count from (
    select 1
    from public.ace_assignment_drafts
    where cycle_id = p_cycle_id
    group by lower(regexp_replace(btrim(little_name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) dup;
  if v_count > 0 then
    v_problems := v_problems || format('%s Little name(s) appear more than once', v_count);
  end if;

  select count(*) into v_count from (
    select 1
    from public.ace_assignment_drafts
    where cycle_id = p_cycle_id and little_member_id is not null
    group by little_member_id
    having count(*) > 1
  ) dup;
  if v_count > 0 then
    v_problems := v_problems || format('%s member(s) are assigned more than once', v_count);
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts
  where cycle_id = p_cycle_id and published_ace_member_id is not null;
  if v_count > 0 then
    v_problems := v_problems || format('%s assignment(s) already created a tree node', v_count);
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts d
  join public.ace_family_members n on n.parent_member_id = d.big_ace_member_id
  where d.cycle_id = p_cycle_id
    and (
      (d.little_member_id is not null and n.member_id = d.little_member_id)
      or lower(regexp_replace(btrim(n.name), '\s+', ' ', 'g'))
         = lower(regexp_replace(btrim(d.little_name), '\s+', ' ', 'g'))
    );
  if v_count > 0 then
    v_problems := v_problems || format('%s Little(s) are already on the tree under that Big', v_count);
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception 'Publish blocked: %', array_to_string(v_problems, '; ');
  end if;

  perform set_config('vsa.ace_publish', 'on', true);

  for v_draft in
    select * from public.ace_assignment_drafts
    where cycle_id = p_cycle_id and published_ace_member_id is null
    order by display_order, created_at, id
  loop
    select * into v_big from public.ace_family_members where id = v_draft.big_ace_member_id;

    select coalesce(max(display_order), -1) + 1 into v_order
    from public.ace_family_members
    where family_id = v_big.family_id and parent_member_id = v_big.id;

    insert into public.ace_family_members
      (family_id, name, role_label, parent_member_id, member_id, display_order, is_published,
       pickup_academic_year_start, pickup_term)
    values
      (v_big.family_id, btrim(v_draft.little_name), 'Little', v_big.id,
       v_draft.little_member_id, v_order, true,
       v_cycle.academic_year_start, v_cycle.pickup_term)
    returning id into v_node_id;

    -- One private, already-reviewed source record per newly created Little.
    -- A successful retry exits above; failed publishes roll this back atomically.
    insert into public.ace_member_pickup_evidence
      (ace_member_id, source_kind, source_label, raw_value,
       candidate_academic_year_start, candidate_term,
       review_status, reviewed_by, reviewed_at)
    values
      (v_node_id, 'assignment_cycle', 'ACE assignment cycle', v_cycle.pickup_term,
       v_cycle.academic_year_start, v_cycle.pickup_term,
       'approved', auth.uid(), now());

    update public.ace_assignment_drafts
    set published_ace_member_id = v_node_id
    where id = v_draft.id;

    v_created := v_created + 1;
  end loop;

  update public.ace_assignment_cycles set status = 'published' where id = p_cycle_id;

  perform set_config('vsa.ace_publish', 'off', true);

  return jsonb_build_object(
    'cycle_id', p_cycle_id, 'status', 'published',
    'created', v_created, 'total', v_total, 'already_published', false
  );
end;
$$;

revoke execute on function public.publish_ace_assignment_cycle(uuid) from public, anon;
grant execute on function public.publish_ace_assignment_cycle(uuid) to authenticated;
