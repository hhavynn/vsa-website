-- Ask VSA knowledge base v2 schema.
-- Adds retrieval aliases, confidence/freshness metadata, academic-year scoping,
-- expiry-aware retrieval, and archive-oriented source types.
-- Behavior rules live in the Edge Function system prompt, not in this table.

alter table public.ai_knowledge_base
  add column if not exists aliases text[] not null default '{}',
  add column if not exists confidence text not null default 'high',
  add column if not exists freshness text not null default 'stable',
  add column if not exists academic_year text,
  add column if not exists valid_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_knowledge_base_confidence_check'
  ) then
    alter table public.ai_knowledge_base
      add constraint ai_knowledge_base_confidence_check
      check (confidence in ('high', 'medium', 'low'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ai_knowledge_base_freshness_check'
  ) then
    alter table public.ai_knowledge_base
      add constraint ai_knowledge_base_freshness_check
      check (freshness in ('stable', 'yearly', 'quarterly', 'event_live'));
  end if;
end $$;

-- Allow archive-oriented source types alongside the original four.
alter table public.ai_knowledge_base
  drop constraint if exists ai_knowledge_base_source_type_check;
alter table public.ai_knowledge_base
  add constraint ai_knowledge_base_source_type_check
  check (source_type in ('manual', 'public_page', 'public_event', 'faq', 'approved_drive', 'historical_archive'));

-- Aliases are the strongest retrieval signal after the title.
create or replace function public.ai_knowledge_base_set_search_vector()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.search_vector =
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(new.aliases, ' ')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'C');
  return new;
end;
$$;

-- Recompute search vectors for existing rows with the new trigger logic.
update public.ai_knowledge_base set title = title;

-- Retrieval v2: skip expired entries, match on aliases, surface year/confidence
-- metadata so the assistant can label historical answers, allow up to 8 snippets.
drop function if exists public.match_ai_knowledge_base(text, integer);

create function public.match_ai_knowledge_base(
  query_text text,
  match_limit integer default 8
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  source_type text,
  source_url text,
  confidence text,
  freshness text,
  academic_year text,
  rank real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.source_type,
    kb.source_url,
    kb.confidence,
    kb.freshness,
    kb.academic_year,
    ts_rank_cd(kb.search_vector, query.tsq) + (kb.priority::real * 0.02) as rank
  from public.ai_knowledge_base kb, query
  where kb.is_public = true
    and kb.is_active = true
    and (kb.valid_until is null or kb.valid_until > now())
    and (
      query.tsq @@ kb.search_vector
      or kb.title ilike '%' || coalesce(query_text, '') || '%'
      or kb.category ilike '%' || coalesce(query_text, '') || '%'
      or exists (
        select 1
        from unnest(kb.aliases) alias
        where coalesce(query_text, '') ilike '%' || alias || '%'
      )
    )
  order by rank desc, kb.priority desc, kb.updated_at desc
  limit greatest(1, least(match_limit, 8));
$$;

revoke all on function public.match_ai_knowledge_base(text, integer) from public;
grant execute on function public.match_ai_knowledge_base(text, integer) to anon, authenticated, service_role;
