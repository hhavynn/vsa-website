import * as fs from 'fs';
import * as path from 'path';

/**
 * Shape guard for migration 20261004000000 (content_health_state + the Ask VSA
 * entity link). Proving the policies behave needs a database and lives in
 * scripts/verify-content-health.sql; this test only catches the regressions that
 * are visible in the SQL text, with no credentials, on every CI run.
 */
const migrationsDir = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');
const file = fs.readdirSync(migrationsDir).find((name) => name.startsWith('20261004000000_content_health'));
const sql = file ? fs.readFileSync(path.join(migrationsDir, file), 'utf8') : '';
const code = sql.replace(/--.*$/gm, '');

describe('content health migration', () => {
  it('exists and is forward-only: no drops, deletes, or rewrites of existing data', () => {
    expect(file).toBeDefined();
    expect(code).not.toMatch(/\bdrop\s+(table|column|view|function|constraint)\b/i);
    // The only trigger dropped is the one this migration creates, so it can be re-applied.
    const droppedTriggers = code.match(/drop trigger[^;]*;/gi) ?? [];
    expect(droppedTriggers.every((statement) => statement.includes('guard_ai_knowledge_linked_event'))).toBe(true);
    expect(code).not.toMatch(/\btruncate\b/i);
    expect(code).not.toMatch(/^\s*(update|delete\s+from|insert\s+into)\s+public\./im);
  });

  it('turns on RLS and takes every default privilege away from anon and authenticated', () => {
    expect(code).toMatch(/alter table public\.content_health_state enable row level security/i);
    expect(code).toMatch(/revoke all on public\.content_health_state from anon, authenticated/i);
    expect(code).not.toMatch(/grant[^;]*on public\.content_health_state to[^;]*\b(anon|public)\b/i);
  });

  it('is admin-only on every policy', () => {
    const policies = code.match(/create policy[\s\S]*?;/gi) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(4);
    for (const policy of policies) {
      expect(policy).toMatch(/is_admin_user\(auth\.uid\(\)\)/);
      expect(policy).toMatch(/to authenticated/);
    }
  });

  it('lets admins write acknowledgements only, never link-check or check-run results', () => {
    const writes = (code.match(/create policy[\s\S]*?;/gi) ?? []).filter((policy) => /for (insert|update|delete)/i.test(policy));
    expect(writes).toHaveLength(3);
    for (const policy of writes) expect(policy).toMatch(/kind = 'acknowledgement'/);
    // The scheduled job writes with the service role, so no policy opens link_check/check_run to authenticated.
    expect(code).not.toMatch(/kind\s*(=|in)\s*\(?'(link_check|check_run)'[^;]*to authenticated/i);
  });

  it('keeps who-acknowledged-it out of reach of an update', () => {
    expect(code).toMatch(/grant update \(kind, subject_key, fingerprint, acknowledged_at, expires_at\)/i);
    expect(code).not.toMatch(/grant[^;]*update[^(;]*on public\.content_health_state to authenticated/i);
  });

  it('stores the reviewer nowhere public: ai_knowledge_base only gains the two entity-link columns', () => {
    const alter = code.match(/alter table public\.ai_knowledge_base[\s\S]*?;/i)?.[0] ?? '';
    expect(alter).toMatch(/linked_entity_type/);
    expect(alter).toMatch(/linked_entity_key/);
    expect(alter).not.toMatch(/review|verified_by|user/i);
  });

  it('keeps the entity-link constraint from passing on NULL', () => {
    // `null in (...)` is NULL and a CHECK passes on NULL, so the type must be tested for presence first.
    expect(code).toMatch(/linked_entity_type is not null\s+and linked_entity_type in \('application', 'event'\)/i);
  });

  it('enforces "a public snippet never describes an unpublished event" in the database, not only the UI', () => {
    expect(code).toMatch(/create trigger guard_ai_knowledge_linked_event\s+before insert or update of is_active, is_public, linked_entity_type, linked_entity_key/i);
    expect(code).toMatch(/e\.is_published is true/i);
    expect(code).toMatch(/revoke execute on function public\.guard_ai_knowledge_linked_event\(\) from public, anon, authenticated/i);
  });

  it('changes retrieval only by adding the linked-event condition, keeping its signature, definer rights and pinned search_path', () => {
    const fn = code.match(/create or replace function public\.match_ai_knowledge_base[\s\S]*?\$\$;/i)?.[0] ?? '';
    expect(fn).toMatch(/\(\s*query_text text,\s*match_limit integer default 8\s*\)/i);
    expect(fn).toMatch(/security definer\s+set search_path = public/i);
    expect(fn).toMatch(/linked_entity_type is distinct from 'event'/i);
    expect(fn).toMatch(/kb\.valid_until is null or kb\.valid_until > now\(\)/i);
    // `create or replace` on the same signature keeps the grants set by 20260820000003; none are restated here.
    expect(code).not.toMatch(/(grant|revoke)[^;]*match_ai_knowledge_base/i);
    expect(code).not.toMatch(/drop function[^;]*match_ai_knowledge_base/i);
  });

  it('adds no policy to, and drops no policy from, ai_knowledge_base', () => {
    expect(code).not.toMatch(/(create|drop) policy[^;]*ai_knowledge_base/i);
  });

  describe('follow-up 20261004010000: direct reads follow the same rule as retrieval', () => {
    const followUp = fs.readdirSync(migrationsDir).find((name) => name.startsWith('20261004010000_ai_knowledge_public_read'));
    const followUpCode = (followUp ? fs.readFileSync(path.join(migrationsDir, followUp), 'utf8') : '').replace(/--.*$/gm, '');

    it('narrows only the public read policy: it keeps the old conditions and adds the linked-event one', () => {
      expect(followUp).toBeDefined();
      expect(followUpCode.match(/drop policy[^;]*;/gi)).toEqual(['drop policy if exists "Public can read active AI knowledge" on public.ai_knowledge_base;']);
      const policy = followUpCode.match(/create policy[\s\S]*?;/i)?.[0] ?? '';
      expect(policy).toMatch(/for select/i);
      expect(policy).toMatch(/is_public = true\s+and is_active = true/i);
      expect(policy).toMatch(/linked_entity_type is distinct from 'event'/i);
      expect(policy).toMatch(/e\.is_published is true/i);
      // It must not widen access: no role grants it, no write verb.
      expect(policy).not.toMatch(/for (insert|update|delete|all)/i);
      expect(followUpCode).not.toMatch(/\bgrant\b/i);
    });

    it('touches no other table, policy, function or row', () => {
      expect(followUpCode.match(/create policy/gi)).toHaveLength(1);
      expect(followUpCode).not.toMatch(/\b(alter|create|drop)\s+(table|function|trigger|view)\b/i);
      expect(followUpCode).not.toMatch(/^\s*(update|delete\s+from|insert\s+into)\s/im);
    });
  });
});
