-- #704: deny legacy members.house cache through the anonymous member projection.
-- Forward-only ACL change. Does NOT alter attendance, House assignments, points,
-- stored member records, or the currently published House-identity view.
--
-- The members.house display cache is not academic-year scoped. Its value may
-- still contain a previous year's House and is updated mid-transaction during
-- draft publication. A browser must never read it through public_members.
--
-- Column grants are intentional: PostgreSQL cannot DROP a column using
-- CREATE OR REPLACE VIEW without dropping/recreating an established view,
-- which risks breaking dependents. Table-level SELECT is revoked, then only
-- the known safe projection columns are re-granted.
--
-- Deployment dependency: pair with PR #701's Reveal-gated
-- public_house_memberships and its Find My Points migration. Before #701 is
-- deployed the old Find My Points .select('house') will receive 42501.
-- The web UI PR #704 must deploy before these permission revocations.
begin;

revoke all on public.public_members from public, anon, authenticated;
grant select (id, first_name, last_name, college, year, points, events_attended)
  on public.public_members to anon, authenticated;

-- Defend against inherited future grants from PUBLIC and direct role grants.
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_column_privilege(v_role, 'public.public_members', 'house', 'SELECT') then
      raise exception '#704: % can still SELECT public_members.house', v_role;
    end if;
    if not has_column_privilege(v_role, 'public.public_members', 'id', 'SELECT')
       or not has_column_privilege(v_role, 'public.public_members', 'points', 'SELECT') then
      raise exception '#704: member identity or individual points lost for %', v_role;
    end if;
  end loop;
end;
$$;

comment on view public.public_members is
  'Public member identity + individual points projection. The legacy house cache remains internally stored but its column is not client-readable. Current House identity uses public_house_memberships after Reveal.';

commit;
