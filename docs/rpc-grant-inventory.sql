-- Read-only RPC / grant inventory for the public schema.
--
-- Issue: #381 — "Reconcile anon-executable legacy RPCs and live schema drift",
-- first acceptance criterion: export a read-only pg_proc/grant inventory for
-- every public-schema RPC, including owner, security mode, arguments/overloads,
-- and has_function_privilege('anon', ..., 'EXECUTE').
--
-- WHY THIS EXISTS
-- ---------------
-- The #226 audit could only see PostgREST's OpenAPI surface, which publishes one
-- path per function *name*. It therefore cannot prove that a given name has no
-- additional overload, and it cannot read grants at all — it can only infer them
-- from probe responses. Both gaps are called out in
-- docs/anon-key-exposure-audit-2026-08-19.md.
--
-- These queries close both gaps by reading the catalog directly. Run them in the
-- Supabase SQL editor (or any psql session) against STAGING FIRST, then against
-- production. Everything here is SELECT-only against system catalogs: it creates
-- nothing, changes nothing, and invokes none of the functions it describes.
--
-- DO NOT "test" a mutation RPC to see what it does. #381's guardrails prohibit
-- invoking points/merge functions during this reconciliation, and
-- `recalculate_member_points` and `smart_merge_members` both touch protected
-- domains (AGENTS.md).

-- ---------------------------------------------------------------------------
-- 1. The grant matrix: every public function, its security posture, and who may
--    execute it. This is the table #381 asks for.
--
--    Read `anon_execute = true` on anything in the admin / check-in / merge /
--    data-rights / points-mutation families as a finding, not a curiosity.
-- ---------------------------------------------------------------------------
select
  p.proname                                              as function_name,
  pg_get_function_identity_arguments(p.oid)              as arguments,
  pg_get_userbyid(p.proowner)                            as owner,
  case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_mode,
  -- A SECURITY DEFINER function without a pinned search_path is a privilege-
  -- escalation vector; every DEFINER function in this repo sets search_path = ''.
  coalesce(
    (select cfg from unnest(p.proconfig) as cfg where cfg like 'search_path=%'),
    case when p.prosecdef then '!! DEFINER WITH NO PINNED search_path !!' else '' end
  )                                                      as search_path_setting,
  has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  -- PUBLIC is the default grantee for new functions; a forgotten REVOKE here is
  -- how anon ends up with EXECUTE without anyone granting it directly.
  (aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))).grantee = 0
                                                         as granted_to_public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
order by
  has_function_privilege('anon', p.oid, 'EXECUTE') desc,  -- findings float to the top
  p.proname,
  arguments;

-- ---------------------------------------------------------------------------
-- 2. Overload detector.
--
--    The OpenAPI surface shows one path per name, so a second overload of a
--    revoked function is invisible to the #226 method. Any row here means the
--    name-level reasoning in that audit is incomplete for that function.
-- ---------------------------------------------------------------------------
select
  p.proname                                       as function_name,
  count(*)                                        as overload_count,
  array_agg(pg_get_function_identity_arguments(p.oid) order by p.oid) as signatures,
  bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) as any_overload_anon_executable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
group by p.proname
having count(*) > 1
order by any_overload_anon_executable desc, p.proname;

-- ---------------------------------------------------------------------------
-- 3. Relation-level grant matrix, for the same reason.
--
--    Column-level grants do not appear in information_schema.table_privileges,
--    so a table can show no anon SELECT here while still exposing columns. Query
--    4 covers that case.
-- ---------------------------------------------------------------------------
select
  c.relname                                            as relation,
  case c.relkind when 'r' then 'table' when 'v' then 'view'
                 when 'm' then 'matview' when 'p' then 'partitioned' end as kind,
  c.relrowsecurity                                     as rls_enabled,
  c.relforcerowsecurity                                as rls_forced,
  has_table_privilege('anon',          c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon',          c.oid, 'INSERT') as anon_insert,
  has_table_privilege('anon',          c.oid, 'UPDATE') as anon_update,
  has_table_privilege('anon',          c.oid, 'DELETE') as anon_delete,
  has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
  (select count(*) from pg_policy pol where pol.polrelid = c.oid) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v', 'm', 'p')
order by
  -- A table with anon access and RLS disabled is the worst combination.
  (has_table_privilege('anon', c.oid, 'SELECT') and not c.relrowsecurity) desc,
  anon_select desc,
  c.relname;

-- ---------------------------------------------------------------------------
-- 4. Column-level grants to anon.
--
--    After the #379/#380/#382 migrations, `events`, `members`, `uvsa_schools`,
--    and `external_events` should appear here with an explicit allowlist and
--    no table-level anon SELECT in query 3. Any column in this list that looks
--    like a note, secret, URL, email, or internal flag is a finding.
-- ---------------------------------------------------------------------------
select
  table_name,
  grantee,
  privilege_type,
  array_agg(column_name order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee, privilege_type
order by table_name, grantee, privilege_type;

-- ---------------------------------------------------------------------------
-- 5. Views that bypass base-table RLS.
--
--    A view runs with its owner's privileges unless it is declared
--    security_invoker, so base-table RLS does NOT apply when anon reads it —
--    the view's own grants are the entire access control. Rows here where
--    `security_invoker` is false and `anon_select` is true are the views whose
--    column lists must be audited by hand.
-- ---------------------------------------------------------------------------
select
  c.relname                                       as view_name,
  pg_get_userbyid(c.relowner)                     as owner,
  coalesce(
    (select true from unnest(c.reloptions) o where o = 'security_invoker=true'),
    false
  )                                               as security_invoker,
  coalesce(
    (select true from unnest(c.reloptions) o where o = 'security_barrier=true'),
    false
  )                                               as security_barrier,
  has_table_privilege('anon', c.oid, 'SELECT')    as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT')    as anon_insert_through_view
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
order by anon_select desc, c.relname;

-- ---------------------------------------------------------------------------
-- 6. Drift check: live columns for the tables this repo's migrations describe.
--
--    #226 found `src/types/database.ts` missing `member_event_history` entirely,
--    and missing `events.start_time` / `end_time` / `end_date`. It also found the
--    live `ai_knowledge_base` lacking the v2 columns from
--    20260704000000_ai_knowledge_v2_schema.sql. Diff this output against the
--    migrations before trusting either as the schema of record.
-- ---------------------------------------------------------------------------
select
  table_name,
  array_agg(column_name order by ordinal_position) as live_columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;
