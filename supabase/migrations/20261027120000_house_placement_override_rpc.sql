-- Atomic manual overrides for timestamp-priority House placement drafts.
--
-- WHY
--   Admin -> Houses lets an admin move one automatically placed applicant, or
--   swap two, with a documented reason. A swap used to be two separate row
--   updates from the browser, so the first could succeed and the second fail,
--   leaving two applicants in one House (over capacity) until someone noticed.
--   This function applies a one-row move or a two-row swap in one
--   transaction: every row changes, or none does.
--
-- WHAT
--   public.admin_apply_house_placement_override(p_batch_id, p_changes, p_reason)
--     p_changes: [{"draft_id": "<uuid>", "house_profile_id": "<uuid>"}, ...]
--                (one entry for a move, two for a swap)
--     p_reason:  required unless every change returns a row to the House the
--                allocator chose (generated_house_profile_id)
--   It only accepts a draft, timestamp_ranked batch; only Houses in that
--   batch's capacity_config; only rows of that batch. It sets
--   override_reason (cleared when a row goes back to its generated House),
--   then refuses the whole change if a destination House would exceed its
--   capacity. It returns the updated rows.
--
-- SECURITY
--   SECURITY INVOKER: it runs as the calling admin, so the existing admin-only
--   RLS on house_assignment_batches / house_assignment_drafts and the
--   draft-only mutation guard trigger still apply. It also checks
--   is_admin_user() itself for a clear error. EXECUTE is revoked from PUBLIC
--   and anon and granted to authenticated only. Nothing here touches
--   house_memberships, members, points, attendance or any public view.
--
-- Additive: one new function, no table, column, policy or grant changes.
-- Deploy: apply this migration, then ship the frontend that calls it. Until it
-- is applied, the editor still performs single-row moves (one atomic row
-- update) but refuses swaps instead of risking a half-applied one.

create or replace function public.admin_apply_house_placement_override(
  p_batch_id uuid,
  p_changes jsonb,
  p_reason text default null
)
returns setof public.house_assignment_drafts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.house_assignment_batches%rowtype;
  v_draft public.house_assignment_drafts%rowtype;
  v_change jsonb;
  v_draft_id uuid;
  v_house_id uuid;
  v_ids uuid[] := '{}';
  v_destinations uuid[] := '{}';
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_capacity integer;
  v_count integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can change House placements.' using errcode = '42501';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) < 1 or jsonb_array_length(p_changes) > 2 then
    raise exception 'An override changes one row, or two rows for a swap.' using errcode = '22023';
  end if;

  select * into v_batch
  from public.house_assignment_batches
  where id = p_batch_id
  for update;
  if not found then
    raise exception 'House assignment batch not found.' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'draft' then
    raise exception 'This batch is %. Reopen it before changing placements.', v_batch.status using errcode = '22023';
  end if;
  if v_batch.assignment_method <> 'timestamp_ranked'
     or v_batch.capacity_config is null
     or jsonb_typeof(v_batch.capacity_config) <> 'object' then
    raise exception 'Overrides apply only to automatic placement batches.' using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_draft_id := (v_change ->> 'draft_id')::uuid;
    v_house_id := (v_change ->> 'house_profile_id')::uuid;
    if v_draft_id is null or v_house_id is null then
      raise exception 'Each change needs a draft_id and a house_profile_id.' using errcode = '22023';
    end if;
    if v_draft_id = any(v_ids) then
      raise exception 'The same row appears twice in one override.' using errcode = '22023';
    end if;
    v_ids := v_ids || v_draft_id;

    if not (v_batch.capacity_config ? v_house_id::text) then
      raise exception 'That House is not part of this placement.' using errcode = '22023';
    end if;

    select * into v_draft
    from public.house_assignment_drafts
    where id = v_draft_id and batch_id = p_batch_id
    for update;
    if not found then
      raise exception 'That row is not part of this batch.' using errcode = 'P0002';
    end if;

    if v_house_id is distinct from v_draft.generated_house_profile_id and v_reason is null then
      raise exception 'A reason is required for a manual override.' using errcode = '22023';
    end if;

    if v_draft.house_profile_id is distinct from v_house_id then
      v_destinations := v_destinations || v_house_id;
    end if;

    update public.house_assignment_drafts
    set house_profile_id = v_house_id,
        override_reason = case when v_house_id = v_draft.generated_house_profile_id then null else v_reason end
    where id = v_draft_id;
  end loop;

  -- Checked after every change, so a swap (each House loses one and gains
  -- one) passes and a move into a full House does not.
  for v_house_id in select distinct unnest(v_destinations) loop
    v_capacity := (v_batch.capacity_config ->> v_house_id::text)::integer;
    select count(*) into v_count
    from public.house_assignment_drafts
    where batch_id = p_batch_id and house_profile_id = v_house_id;
    if v_count > v_capacity then
      raise exception 'That House would have % applicants but its capacity is %. Nothing was changed.', v_count, v_capacity
        using errcode = '23514';
    end if;
  end loop;

  return query
    select *
    from public.house_assignment_drafts
    where id = any(v_ids)
    order by source_order;
end;
$$;

revoke all on function public.admin_apply_house_placement_override(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_apply_house_placement_override(uuid, jsonb, text) to authenticated;

comment on function public.admin_apply_house_placement_override(uuid, jsonb, text) is
  'Admin-only: moves one automatically placed applicant, or swaps two, in one transaction, with capacity and reason checks. Never writes house_memberships.';
