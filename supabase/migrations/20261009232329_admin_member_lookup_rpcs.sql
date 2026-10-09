-- Admin member lookups by email and name, through POST-only RPCs.
--
-- Historical Recovery looked members up with PostgREST filters such as
-- members?or=(email.ilike.x@y.edu,...) and last_name.ilike.%25Nguyen. Those are
-- GET requests, so attendee emails and names were written into the request URL
-- and into Supabase API logs. These functions take the same values as
-- arguments. supabase-js sends rpc() arguments in a POST body, which is not
-- logged. Each function refuses any PostgREST method but POST (GET and HEAD put
-- the arguments in the URL), so a regression fails loudly instead of leaking
-- quietly. Direct SQL callers set no request method and are allowed.
--
-- Objects
--   admin_lookup_members(p_emails text[], p_surnames text[])   exact email / surname suffix
--   admin_search_members(p_query text, p_limit integer)        name or email typeahead
--
-- Both return a jsonb array of {id, first_name, last_name, email, college, year,
-- points, events_attended}, the columns the recovery screens already read. One
-- jsonb value is a single row, so the PostgREST row cap cannot truncate a
-- surname lookup (121 production members share one surname).
--
-- Access boundary: admin only. SECURITY INVOKER, so the members RLS policies
-- (raw reads restricted to public.is_admin_user) still apply underneath the
-- explicit admin check. search_path is pinned to '' and every reference is
-- schema-qualified. EXECUTE is revoked from PUBLIC and anon (both: anon also
-- inherits through PUBLIC) and granted to authenticated only. Errors never echo
-- an input value. Read-only; nothing here writes.

-- ─── Exact lookups ──────────────────────────────────────────────────────────
--
-- p_emails     members whose stored email, trimmed and lowercased, equals one
--              of these (trimmed and lowercased). Exact, no wildcards.
-- p_surnames   members whose trimmed, lowercased last name ends with one of
--              these (trimmed, lowercased). Literal suffix, no wildcards; it
--              only narrows candidates and callers compare full names.
-- Either may be null or empty. At most 1000 distinct values each.

create or replace function public.admin_lookup_members(
  p_emails text[] default null,
  p_surnames text[] default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_emails text[];
  v_surnames text[];
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can look up members' using errcode = '42501';
  end if;
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Member lookups must use POST' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct v), '{}') into v_emails
  from (select lower(btrim(e)) as v from unnest(coalesce(p_emails, '{}'::text[])) as e) s
  where v <> '';
  select coalesce(array_agg(distinct v), '{}') into v_surnames
  from (select lower(btrim(n)) as v from unnest(coalesce(p_surnames, '{}'::text[])) as n) s
  where v <> '';

  if cardinality(v_emails) > 1000 or cardinality(v_surnames) > 1000 then
    raise exception 'Too many lookup values (at most 1000 emails and 1000 surnames per call)' using errcode = '22023';
  end if;
  if cardinality(v_emails) = 0 and cardinality(v_surnames) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'first_name', m.first_name, 'last_name', m.last_name, 'email', m.email,
      'college', m.college, 'year', m.year, 'points', m.points, 'events_attended', m.events_attended)
    order by m.id), '[]'::jsonb)
  into v_result
  from public.members m
  where lower(btrim(m.email)) = any (v_emails)
     or exists (
       select 1 from unnest(v_surnames) as s
       where right(lower(btrim(m.last_name)), length(s)) = s
     );

  return v_result;
end;
$$;

revoke all on function public.admin_lookup_members(text[], text[]) from public, anon;
grant execute on function public.admin_lookup_members(text[], text[]) to authenticated;

-- ─── Typeahead search ───────────────────────────────────────────────────────
--
-- Same rules the client used before, with literal (not wildcard) matching:
--   one token containing '@'  -> email contains it
--   one name token            -> first or last name contains it
--   two or more name tokens   -> first name contains the first token and last
--                                name contains the last token
-- Name tokens split on whitespace and '.'. Fewer than 2 non-space characters
-- returns []. p_limit is clamped to 1..50. Ordered by last, first name.

create or replace function public.admin_search_members(
  p_query text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_clean text;
  v_tokens text[];
  v_names text[];
  v_email text;
  v_any text;
  v_first text;
  v_last text;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can look up members' using errcode = '42501';
  end if;
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Member lookups must use POST' using errcode = '42501';
  end if;

  v_clean := lower(regexp_replace(left(coalesce(p_query, ''), 200), '[,()%*\\]', ' ', 'g'));
  v_tokens := array(select t from regexp_split_to_table(v_clean, '\s+') as t where t <> '');
  if length(array_to_string(v_tokens, '')) < 2 then
    return '[]'::jsonb;
  end if;

  if cardinality(v_tokens) = 1 and strpos(v_tokens[1], '@') > 0 then
    v_email := v_tokens[1];
  else
    v_names := array(select t from regexp_split_to_table(replace(v_clean, '.', ' '), '\s+') as t where t <> '');
    if cardinality(v_names) = 0 then
      return '[]'::jsonb;
    elsif cardinality(v_names) = 1 then
      v_any := v_names[1];
    else
      v_first := v_names[1];
      v_last := v_names[cardinality(v_names)];
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'first_name', m.first_name, 'last_name', m.last_name, 'email', m.email,
      'college', m.college, 'year', m.year, 'points', m.points, 'events_attended', m.events_attended)
    order by m.last_name, m.first_name, m.id), '[]'::jsonb)
  into v_result
  from (
    select mm.*
    from public.members mm
    where (v_email is null or strpos(lower(coalesce(mm.email, '')), v_email) > 0)
      and (v_any is null or strpos(lower(mm.first_name), v_any) > 0 or strpos(lower(mm.last_name), v_any) > 0)
      and (v_first is null or strpos(lower(mm.first_name), v_first) > 0)
      and (v_last is null or strpos(lower(mm.last_name), v_last) > 0)
    order by mm.last_name, mm.first_name, mm.id
    limit v_limit
  ) m;

  return v_result;
end;
$$;

revoke all on function public.admin_search_members(text, integer) from public, anon;
grant execute on function public.admin_search_members(text, integer) to authenticated;
