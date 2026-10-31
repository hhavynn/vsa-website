-- #674 disposable Postgres contract. Runs AFTER the #669 and #673 fixture
-- checks in pickup_full. All changes are rolled back; do not run against prod.
begin;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;

-- Two terms in 2026–27 may coexist; the exact pair must remain unique.
insert into public.ace_assignment_cycles
  (id, academic_year_start, academic_year_end, pickup_term)
values
  ('40000000-0000-0000-0000-000000000001', 2026, 2027, 'FA26'),
  ('40000000-0000-0000-0000-000000000002', 2026, 2027, 'SP27');

do $test$
begin
  begin
    insert into public.ace_assignment_cycles
      (academic_year_start, academic_year_end, pickup_term)
    values (2026, 2027, 'FA26');
    raise exception 'FAIL duplicate cycle term was accepted';
  exception when unique_violation then
    raise notice 'PASS: duplicate open term rejected';
  end;
  begin
    insert into public.ace_assignment_cycles
      (academic_year_start, academic_year_end, pickup_term)
    values (2027, 2028, 'SP27');
    raise exception 'FAIL mis-scoped Spring term was accepted';
  exception when check_violation then
    raise notice 'PASS: SP27 belongs to 2026–27, not 2027–28';
  end;
  begin
    insert into public.ace_assignment_cycles (id, academic_year_start, academic_year_end)
    values ('40000000-0000-0000-0000-000000000003', 2026, 2027);
    update public.ace_assignment_cycles set status='locked'
      where id='40000000-0000-0000-0000-000000000003';
    raise exception 'FAIL legacy null-term cycle locked';
  exception when raise_exception then
    if SQLERRM like 'FAIL %' then raise; end if;
    if SQLERRM not like '%Choose the pickup term%' then raise; end if;
    raise notice 'PASS: legacy cycle cannot lock without approved term';
  end;
end;
$test$;

-- Preserve the existing Big's pickup date even when picking up in later years.
update public.ace_family_members
set pickup_academic_year_start = 2021, pickup_term = 'FA21'
where id = '30000000-0000-0000-0000-000000000002';

insert into public.ace_assignment_drafts
  (cycle_id, little_name, big_ace_member_id)
values
  ('40000000-0000-0000-0000-000000000001', 'Synthetic Autumn Little', '30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', 'Synthetic Spring Little', '30000000-0000-0000-0000-000000000002');

update public.ace_assignment_cycles set status='locked'
where id in ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002');

do $test$
begin
  begin
    update public.ace_assignment_cycles set pickup_term='WI27'
    where id='40000000-0000-0000-0000-000000000001';
    raise exception 'FAIL locked term was modified';
  exception when raise_exception then
    if SQLERRM like 'FAIL %' then raise; end if;
    if SQLERRM not like '%Unlock the assignment cycle%' then raise; end if;
    raise notice 'PASS: locked term is immutable';
  end;
end;
$test$;

-- The existing SECURITY DEFINER publisher is the sole tree writer.
select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001');
select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000002');

do $test$
declare
  v_result jsonb;
begin
  if (select count(*) from public.ace_family_members
      where name like 'Synthetic % Little'
        and parent_member_id='30000000-0000-0000-0000-000000000002'
        and ((name='Synthetic Autumn Little' and pickup_academic_year_start=2026 and pickup_term='FA26')
          or (name='Synthetic Spring Little' and pickup_academic_year_start=2026 and pickup_term='SP27'))) <> 2 then
    raise exception 'FAIL: new Littles not stamped into the original Big lineage';
  end if;
  if (select pickup_academic_year_start from public.ace_family_members
      where id='30000000-0000-0000-0000-000000000002') <> 2021
     or (select pickup_term from public.ace_family_members
      where id='30000000-0000-0000-0000-000000000002') <> 'FA21' then
    raise exception 'FAIL: historical Big was rewritten';
  end if;
  if (select count(*) from public.ace_member_pickup_evidence e
      join public.ace_family_members m on m.id=e.ace_member_id
      where m.name in ('Synthetic Autumn Little','Synthetic Spring Little')
        and e.source_kind='assignment_cycle'
        and e.review_status='approved' and e.reviewed_by=auth.uid()
        and e.reviewed_at is not null
        and e.candidate_academic_year_start=m.pickup_academic_year_start
        and e.candidate_term=m.pickup_term) <> 2 then
    raise exception 'FAIL: private reviewed evidence missing';
  end if;
  v_result := public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001');
  if v_result->>'already_published' <> 'true' or (v_result->>'created')::integer <> 0 then
    raise exception 'FAIL: published retry created another Little';
  end if;
  if (select count(*) from public.ace_member_pickup_evidence e
      join public.ace_family_members m on m.id=e.ace_member_id
      where m.name in ('Synthetic Autumn Little','Synthetic Spring Little')) <> 2 then
    raise exception 'FAIL: published retry duplicated evidence';
  end if;
  raise notice 'PASS: Fall + Spring Littles correctly stamped; Big unchanged; retry idempotent';
end;
$test$;

reset role;
set local role anon;
do $test$
begin
  begin
    perform 1 from public.ace_member_pickup_evidence limit 1;
    raise exception 'FAIL: anon read private evidence';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot read private assignment evidence';
  end;
end;
$test$;
reset role;
rollback;
