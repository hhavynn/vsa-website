-- Follow-up to 20261004000000 (PR #515 review): close the direct-read path.
--
-- 20261004000000 made match_ai_knowledge_base skip a snippet whose linked event is
-- unpublished or deleted, and added a trigger that blocks SAVING such a snippet.
-- But the public SELECT policy on ai_knowledge_base still let anon read the full
-- text of an active snippet straight from the table (PostgREST), including one
-- whose linked event was unpublished after it was linked. This narrows that one
-- policy to the same rule, so the invariant "a public snippet never describes an
-- unpublished event" holds on every read path, not just retrieval.
--
-- The policy only gains a condition: rows with no event link, and rows linked to
-- a published event, stay readable exactly as before. The events subquery runs as
-- the reader, so events' own RLS ("Events are viewable by everyone": is_published)
-- already limits it to published events; anon has SELECT on events.id and
-- events.is_published (restrict_anon_event_columns). Admins are unaffected: the
-- "Admins can manage AI knowledge" policy (ALL) still lets them see and fix every row.
-- Nothing is deactivated or rewritten.

drop policy if exists "Public can read active AI knowledge" on public.ai_knowledge_base;
create policy "Public can read active AI knowledge"
  on public.ai_knowledge_base
  for select
  using (
    is_public = true
    and is_active = true
    and (
      linked_entity_type is distinct from 'event'
      or exists (
        select 1 from public.events e
        where e.id::text = ai_knowledge_base.linked_entity_key
          and e.is_published is true
      )
    )
  );
