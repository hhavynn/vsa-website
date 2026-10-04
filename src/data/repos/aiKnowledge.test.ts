import { aiKnowledgeRepository } from './aiKnowledge';
import { adminActivityRepository, logAdminActivity } from './adminActivity';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./adminActivity', () => ({
  logAdminActivity: jest.fn(),
  adminActivityRepository: { list: jest.fn() },
}));

const BASE = { title: 'GBM details', content: 'Public fact.', category: 'events', source_type: 'manual' as const, priority: 0 };
const PUBLISHED = '4b0c3c4e-0000-4000-8000-000000000001';
const DRAFT = '4b0c3c4e-0000-4000-8000-000000000002';

beforeEach(() => {
  supabaseMock.reset();
  jest.clearAllMocks();
});

const writes = () => supabaseMock.queries().filter((q) => q.calls.some((c) => ['insert', 'update', 'upsert', 'delete'].includes(c.method)));

describe('marking a snippet reviewed', () => {
  it('stamps only the review date, never the content, and records the reviewer in the admin activity log', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'k1', title: 'GBM details', last_verified_at: '2026-10-04T00:00:00Z' }, error: null });

    await aiKnowledgeRepository.markReviewed({ id: 'k1', title: 'GBM details' });

    const update = supabaseMock.queries()[0].calls.find((call) => call.method === 'update');
    expect(Object.keys(update?.args[0] as object)).toEqual(['last_verified_at']);
    expect(supabaseMock.queries()[0].calls).toContainEqual({ method: 'eq', args: ['id', 'k1'] });
    expect(logAdminActivity).toHaveBeenCalledWith({
      action: 'ai.knowledge_reviewed',
      entityType: 'ai_knowledge',
      entityId: 'k1',
      summary: 'Reviewed Ask VSA knowledge "GBM details"',
    });
  });

  it('does not log a review that did not save', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    supabaseMock.queueResult('ai_knowledge_base', { data: null, error: { message: 'permission denied' } });
    await expect(aiKnowledgeRepository.markReviewed({ id: 'k1', title: 'x' })).rejects.toBeTruthy();
    expect(logAdminActivity).not.toHaveBeenCalled();
  });

  it('reads the latest review per snippet from the log, newest first, ignoring other entries', async () => {
    (adminActivityRepository.list as jest.Mock).mockResolvedValue([
      { action: 'ai.knowledge_reviewed', entityId: 'k1', createdAt: '2026-10-03T00:00:00Z', metadata: { actor: 'Havyn' } },
      { action: 'ai.knowledge_reviewed', entityId: 'k1', createdAt: '2026-09-01T00:00:00Z', metadata: { actor: 'Someone' } },
      { action: 'ai.knowledge_reviewed', entityId: 'k2', createdAt: '2026-09-02T00:00:00Z', metadata: {} },
      { action: 'house.assignment_changed', entityId: 'k3', createdAt: '2026-09-02T00:00:00Z', metadata: {} },
    ]);

    const reviews = await aiKnowledgeRepository.listLatestReviews();

    expect(Array.from(reviews.entries())).toEqual([
      ['k1', { reviewedAt: '2026-10-03T00:00:00Z', reviewer: 'Havyn' }],
      ['k2', { reviewedAt: '2026-09-02T00:00:00Z', reviewer: null }],
    ]);
    expect(adminActivityRepository.list).toHaveBeenCalledWith({ filter: 'ask_vsa', limit: 200 });
  });

  it('falls back to no reviewers when the activity log is unavailable', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (adminActivityRepository.list as jest.Mock).mockRejectedValue(new Error('no table'));
    expect((await aiKnowledgeRepository.listLatestReviews()).size).toBe(0);
  });
});

describe('draft and unpublished material never becomes a public Ask VSA source', () => {
  it('refuses to link a public snippet to an unpublished event, and writes nothing', async () => {
    supabaseMock.queueResult('events', { data: { id: DRAFT, is_published: false }, error: null });

    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'event', linked_entity_key: DRAFT })).rejects.toThrow(/not published/);

    expect(writes()).toEqual([]);
  });

  it('refuses an event that does not exist, a malformed id, and an unknown application window', async () => {
    supabaseMock.queueResult('events', { data: null, error: null });
    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'event', linked_entity_key: PUBLISHED })).rejects.toThrow(/does not exist/);
    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'event', linked_entity_key: 'not-an-id' })).rejects.toThrow(/event/);
    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'application', linked_entity_key: 'secret_form' })).rejects.toThrow(/not a known application/);
    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'application', linked_entity_key: ' ' })).rejects.toThrow(/Choose what/);
    expect(writes()).toEqual([]);
  });

  it('links a published event and a known application window, and saves nothing but the link fields', async () => {
    supabaseMock.queueResult('events', { data: { id: PUBLISHED, is_published: true }, error: null });
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'new' }, error: null });
    await aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'event', linked_entity_key: PUBLISHED });

    const insert = writes()[0].calls.find((call) => call.method === 'insert')?.args[0] as Record<string, unknown>;
    expect(insert).toMatchObject({ linked_entity_type: 'event', linked_entity_key: PUBLISHED, is_public: true });
    // Nothing is copied from the event: the payload has only the admin-typed fields.
    expect(Object.keys(insert)).not.toEqual(expect.arrayContaining(['description', 'location', 'date']));

    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'new2' }, error: null });
    await expect(aiKnowledgeRepository.createSnippet({ ...BASE, linked_entity_type: 'application', linked_entity_key: 'house_fall' })).resolves.toBeTruthy();
  });

  it('does not hold an inactive snippet to the published-event rule, and clears the key when no type is set', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x' }, error: null });
    await aiKnowledgeRepository.updateSnippet('x', { ...BASE, is_active: false, linked_entity_type: 'event', linked_entity_key: PUBLISHED });
    expect(supabaseMock.queries().some((q) => q.table === 'events')).toBe(false);

    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x' }, error: null });
    await aiKnowledgeRepository.updateSnippet('x', { ...BASE, linked_entity_type: null, linked_entity_key: 'leftover' });
    const update = supabaseMock.queries()[1].calls.find((call) => call.method === 'update')?.args[0];
    expect(update).toMatchObject({ linked_entity_type: null, linked_entity_key: null });
  });
});

describe('reactivating and saving', () => {
  it('refuses to reactivate a snippet whose linked event is still a draft, and writes nothing', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x', linked_entity_type: 'event', linked_entity_key: DRAFT }, error: null });
    supabaseMock.queueResult('events', { data: { id: DRAFT, is_published: false }, error: null });

    await expect(aiKnowledgeRepository.setSnippetActive('x', true)).rejects.toThrow(/not published/);

    expect(writes()).toEqual([]);
  });

  it('reactivates a snippet with no link, or whose event is published, and never checks when deactivating', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x', linked_entity_type: null, linked_entity_key: null }, error: null });
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x' }, error: null });
    await expect(aiKnowledgeRepository.setSnippetActive('x', true)).resolves.toBeTruthy();
    expect(supabaseMock.queries().some((q) => q.table === 'events')).toBe(false);

    supabaseMock.reset();
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'y' }, error: null });
    await aiKnowledgeRepository.setSnippetActive('y', false);
    expect(supabaseMock.queries()).toHaveLength(1);
  });

  it('leaves the review date and the link columns out of a save that does not mention them', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x' }, error: null });
    await aiKnowledgeRepository.updateSnippet('x', { ...BASE });
    const update = supabaseMock.queries()[0].calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>;
    expect(update).not.toHaveProperty('last_verified_at');
    expect(update).not.toHaveProperty('linked_entity_type');
    expect(update).not.toHaveProperty('linked_entity_key');
  });

  it('can still clear the review date or the link when asked to', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: { id: 'x' }, error: null });
    await aiKnowledgeRepository.updateSnippet('x', { ...BASE, last_verified_at: null, linked_entity_type: null });
    const update = supabaseMock.queries()[0].calls.find((call) => call.method === 'update')?.args[0];
    expect(update).toMatchObject({ last_verified_at: null, linked_entity_type: null, linked_entity_key: null });
  });
});

describe('reading what linked snippets point at', () => {
  const linked = (type: 'event' | 'application', key: string) => ({ linked_entity_type: type, linked_entity_key: key }) as never;

  it('makes no request when nothing is linked', async () => {
    const context = await aiKnowledgeRepository.loadEntityContext([{ linked_entity_type: null, linked_entity_key: null } as never]);
    expect(context).toEqual({ applications: [], events: [] });
    expect(supabaseMock.queries()).toEqual([]);
  });

  it('reads only the linked event ids, once, and the windows only if one is linked', async () => {
    await aiKnowledgeRepository.loadEntityContext([linked('event', PUBLISHED), linked('event', PUBLISHED), linked('event', DRAFT)]);

    const queries = supabaseMock.queries();
    expect(queries.map((q) => q.table)).toEqual(['events']);
    expect(queries[0].calls).toContainEqual({ method: 'in', args: ['id', [PUBLISHED, DRAFT]] });
  });

  it('reports a failed read as unknown (null), never as "the entity is gone"', async () => {
    supabaseMock.queueResult('application_links', { data: null, error: { message: 'boom' } });
    const context = await aiKnowledgeRepository.loadEntityContext([linked('application', 'house_fall')]);
    expect(context.applications).toBeNull();
  });
});
