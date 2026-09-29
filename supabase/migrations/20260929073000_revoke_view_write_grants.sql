-- Revoke the write privileges anon and authenticated still hold on public
-- views, leaving SELECT exactly where it is today.
--
-- Not yet applied to production. Migrations here are applied manually; apply
-- only with owner approval.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- Supabase's default privileges grant ALL on every new relation in `public` to
-- anon and authenticated (pg_default_acl: arwdDxtm, for both the postgres and
-- supabase_admin grantors). The migrations that created the views below only
-- ever added `grant select`, so the default INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER and MAINTAIN grants were never removed.
--
-- A read-only catalog inventory of production on 2026-09-29 found five views
-- that are auto-updatable (a single base table, no aggregates), owned by
-- postgres (rolbypassrls = true), without security_invoker, and granting all
-- of the above to anon and authenticated:
--
--   public_application_links         over application_links
--   published_ace_families           over ace_families
--   published_house_page_assets      over house_page_assets
--   published_intern_cohort_members  over intern_cohort_members (production only)
--   published_vcn_archives           over vcn_archives
--
-- A write through such a view runs as its owner, so base-table RLS never
-- applies. Anyone holding the public anon key could PATCH or DELETE the base
-- rows through PostgREST: for example, set is_enabled/open_at/due_at on a
-- closed application window so the view unmasks its target_url, or delete ACE
-- families. This was established from grants and view shape only; nothing was
-- written through the views to confirm it.
--
-- Sweeping every other view in `public` found six more still holding the
-- default write grants: member_yearly_points and the five house_* leaderboard
-- views. None of them is auto-updatable (information_schema.views reports
-- is_updatable = NO), so there is no write path through them today, but the
-- grants serve no purpose and would become live if a view were ever reduced
-- to a single-table projection. They get the same treatment.
--
-- published_ace_family_members is already SELECT-only in production, but its
-- creating migration (20260514000000) never revoked, so a database rebuilt
-- from this chain would still carry ALL. It is included so both paths end in
-- the same state; in production it is a no-op.
--
-- Already SELECT-only on both paths and left alone:
--   member_event_history      (20260820000001)
--   my_member_photo_requests  (20260701000000)
--   public_member_avatars     (20260701000000)
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT CHANGE
-- ---------------------------------------------------------------------------
--
-- * Read access. Every view keeps SELECT for exactly the roles that hold it
--   now (anon and authenticated for all twelve). Client code only reads these
--   views; admin writes go to the base tables, whose policies are untouched.
-- * security_invoker. Switching these views to invoker would break public
--   reads: base tables such as application_links deliberately have no public
--   read policy, and the views exist to expose a masked projection of them.
-- * Default privileges. pg_default_acl still grants ALL on future relations,
--   so every new view must keep using revoke-then-grant (MIGRATION_CHECKLIST.md).
--   Changing the defaults affects every future table and is a separate
--   decision.
--
-- Replayable on a clean rebuild: published_intern_cohort_members is not created
-- by any migration in this chain, so its revoke is guarded by to_regclass. The
-- closing check aborts the migration if any view in `public` still grants
-- anything but SELECT to anon, authenticated or PUBLIC.

-- ─── Auto-updatable views ──────────────────────────────────────────────────

-- Supabase default privileges grant ALL on new relations to anon and
-- authenticated. These simple views are auto-updatable and definer-owned, so
-- the leftover INSERT/UPDATE/DELETE grants let anyone write through them past
-- the base tables' RLS. Revoke everything, then grant SELECT only.
revoke all on public.public_application_links from anon, authenticated;
grant select on public.public_application_links to anon, authenticated;

revoke all on public.published_ace_families from anon, authenticated;
grant select on public.published_ace_families to anon, authenticated;

revoke all on public.published_house_page_assets from anon, authenticated;
grant select on public.published_house_page_assets to anon, authenticated;

revoke all on public.published_vcn_archives from anon, authenticated;
grant select on public.published_vcn_archives to anon, authenticated;

do $guard$
begin
  if to_regclass('public.published_intern_cohort_members') is not null then
    revoke all on public.published_intern_cohort_members from anon, authenticated;
    grant select on public.published_intern_cohort_members to anon, authenticated;
  else
    raise notice 'public.published_intern_cohort_members not present; skipping.';
  end if;
end
$guard$;

-- ─── Leaderboard and join views ────────────────────────────────────────────

-- Not auto-updatable, so no write path today; the default grants are removed
-- so they cannot become one.
revoke all on public.member_yearly_points from anon, authenticated;
grant select on public.member_yearly_points to anon, authenticated;

revoke all on public.house_member_yearly_points from anon, authenticated;
grant select on public.house_member_yearly_points to anon, authenticated;

revoke all on public.house_member_all_time_points from anon, authenticated;
grant select on public.house_member_all_time_points to anon, authenticated;

revoke all on public.house_yearly_points from anon, authenticated;
grant select on public.house_yearly_points to anon, authenticated;

revoke all on public.house_all_time_points from anon, authenticated;
grant select on public.house_all_time_points to anon, authenticated;

revoke all on public.house_recent_activity from anon, authenticated;
grant select on public.house_recent_activity to anon, authenticated;

revoke all on public.published_ace_family_members from anon, authenticated;
grant select on public.published_ace_family_members to anon, authenticated;

-- ─── Post-condition ────────────────────────────────────────────────────────

-- Reads the ACLs directly (aclexplode) rather than information_schema, which
-- does not report MAINTAIN.
do $check$
declare
  leftover text;
begin
  select string_agg(
           format('%s (%s: %s)', c.relname,
                  case when a.grantee = 0 then 'PUBLIC' else r.rolname end,
                  a.privilege_type),
           ', ' order by c.relname, a.privilege_type)
    into leftover
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(c.relacl) a
  left join pg_catalog.pg_roles r on r.oid = a.grantee
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and a.privilege_type <> 'SELECT'
    and (a.grantee = 0 or r.rolname in ('anon', 'authenticated'));

  if leftover is not null then
    raise exception 'public views still grant non-SELECT privileges to client roles: %', leftover;
  end if;
end
$check$;
