import { supabase } from '../../lib/supabase';
import { ACTIVITY_ACTIONS, activitySummary } from '../../lib/adminActivity';
import { KNOWLEDGE_LINKED_ENTITY_TYPES, KnowledgeEntityApplication, KnowledgeEntityEvent, KnowledgeFreshnessRow, KnowledgeLinkedEntityType } from '../../lib/aiKnowledgeFreshness';
import { APPLICATION_KEYS } from '../../lib/applicationLinks';
import { ValidationError, withErrorHandling } from '../errors';
import { adminActivityRepository, logAdminActivity } from './adminActivity';

export const AI_KNOWLEDGE_SOURCE_TYPES = [
  'manual',
  'public_page',
  'public_event',
  'faq',
  'approved_drive',
  'historical_archive',
] as const;

export const AI_KNOWLEDGE_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

export const AI_KNOWLEDGE_FRESHNESS_LEVELS = ['stable', 'yearly', 'quarterly', 'event_live'] as const;

export type AiKnowledgeSourceType = (typeof AI_KNOWLEDGE_SOURCE_TYPES)[number];
export type AiKnowledgeConfidence = (typeof AI_KNOWLEDGE_CONFIDENCE_LEVELS)[number];
export type AiKnowledgeFreshness = (typeof AI_KNOWLEDGE_FRESHNESS_LEVELS)[number];
export { KNOWLEDGE_LINKED_ENTITY_TYPES };
export type AiKnowledgeLinkedEntityType = KnowledgeLinkedEntityType;

export interface AiKnowledgeSnippet {
  id: string;
  title: string;
  content: string;
  category: string;
  source_type: AiKnowledgeSourceType;
  source_url: string | null;
  is_public: boolean;
  is_active: boolean;
  priority: number;
  tags: string[];
  aliases: string[];
  confidence: AiKnowledgeConfidence;
  freshness: AiKnowledgeFreshness;
  academic_year: string | null;
  valid_until: string | null;
  last_verified_at: string | null;
  linked_entity_type: AiKnowledgeLinkedEntityType | null;
  linked_entity_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiKnowledgeSnippetInput {
  title: string;
  content: string;
  category: string;
  source_type: AiKnowledgeSourceType;
  source_url?: string | null;
  is_active?: boolean;
  priority: number;
  tags?: string[];
  aliases?: string[];
  confidence?: AiKnowledgeConfidence;
  freshness?: AiKnowledgeFreshness;
  academic_year?: string | null;
  valid_until?: string | null;
  last_verified_at?: string | null;
  linked_entity_type?: AiKnowledgeLinkedEntityType | null;
  linked_entity_key?: string | null;
}

function aiKnowledgeTable() {
  return supabase.from('ai_knowledge_base' as any) as any;
}

function normalizeTags(tags: string[] = []) {
  return Array.from(
    new Set(
      tags
        .map(tag => tag.trim())
        .filter(Boolean),
    ),
  );
}

function normalizePayload(input: AiKnowledgeSnippetInput) {
  return {
    // Fields the caller did not mention are left out entirely, so a save that does not
    // touch the review date or the entity link neither overwrites them nor names a column
    // an older schema does not have.
    title: input.title.trim(),
    content: input.content.trim(),
    category: input.category.trim(),
    source_type: input.source_type,
    source_url: input.source_url?.trim() || null,
    is_active: input.is_active ?? true,
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 0,
    tags: normalizeTags(input.tags),
    aliases: normalizeTags(input.aliases),
    confidence: input.confidence ?? 'high',
    freshness: input.freshness ?? 'stable',
    academic_year: input.academic_year?.trim() || null,
    valid_until: input.valid_until || null,
    ...(input.last_verified_at === undefined ? {} : { last_verified_at: input.last_verified_at || null }),
    ...(input.linked_entity_type === undefined
      ? {}
      : {
          linked_entity_type: input.linked_entity_type || null,
          linked_entity_key: input.linked_entity_type ? input.linked_entity_key?.trim() || null : null,
        }),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AiKnowledgeEntityContext {
  applications: KnowledgeEntityApplication[] | null;
  events: KnowledgeEntityEvent[] | null;
}

export interface AiKnowledgeReview {
  reviewedAt: string;
  reviewer: string | null;
}

export class AiKnowledgeRepository {
  async listAdminSnippets(): Promise<AiKnowledgeSnippet[]> {
    return withErrorHandling(async () => {
      const { data, error } = await aiKnowledgeTable()
        .select('*')
        .eq('is_public', true)
        .order('is_active', { ascending: false })
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AiKnowledgeSnippet[];
    }, 'Failed to fetch Ask VSA knowledge snippets');
  }

  /**
   * A public snippet may only point at something that is itself public. An event
   * must exist and be published (a draft event's details must never reach the
   * assistant), and an application key must be a known one. Inactive snippets are
   * not an answer source, so they are not held to this.
   */
  async assertLinkable(input: AiKnowledgeSnippetInput): Promise<void> {
    const type = input.linked_entity_type;
    if (!type) return;
    const key = input.linked_entity_key?.trim();
    if (!key) throw new ValidationError('Choose what this snippet refers to, or clear the link.', 'linked_entity_key');
    if (type === 'application') {
      if (!(APPLICATION_KEYS as string[]).includes(key)) throw new ValidationError('That is not a known application window.', 'linked_entity_key', key);
      return;
    }
    if (input.is_active === false) return;
    if (!UUID.test(key)) throw new ValidationError('An event link must be the event\u2019s id.', 'linked_entity_key', key);
    const { data, error } = await supabase.from('events').select('id, is_published').eq('id', key).maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationError('That event does not exist.', 'linked_entity_key', key);
    if (data.is_published !== true) {
      throw new ValidationError('That event is not published, so Ask VSA cannot use it. Publish the event first, or clear the link.', 'linked_entity_key', key);
    }
  }

  async createSnippet(input: AiKnowledgeSnippetInput): Promise<AiKnowledgeSnippet> {
    return withErrorHandling(async () => {
      await this.assertLinkable(input);
      const { data, error } = await aiKnowledgeTable()
        .insert({ ...normalizePayload(input), is_public: true })
        .select('*')
        .single();

      if (error) throw error;
      return data as AiKnowledgeSnippet;
    }, 'Failed to create Ask VSA knowledge snippet');
  }

  async updateSnippet(id: string, input: AiKnowledgeSnippetInput): Promise<AiKnowledgeSnippet> {
    return withErrorHandling(async () => {
      await this.assertLinkable(input);
      const { data, error } = await aiKnowledgeTable()
        .update(normalizePayload(input))
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as AiKnowledgeSnippet;
    }, 'Failed to update Ask VSA knowledge snippet');
  }

  async setSnippetActive(id: string, isActive: boolean): Promise<AiKnowledgeSnippet> {
    return withErrorHandling(async () => {
      if (isActive) {
        // Reactivating makes the snippet public again, so it gets the same linked-event check as a save.
        const { data: existing, error: readError } = await aiKnowledgeTable().select('*').eq('id', id).single();
        if (readError) throw readError;
        await this.assertLinkable({ ...(existing as Pick<AiKnowledgeSnippet, 'linked_entity_type' | 'linked_entity_key'>), is_active: true } as AiKnowledgeSnippetInput);
      }
      const { data, error } = await aiKnowledgeTable()
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as AiKnowledgeSnippet;
    }, isActive ? 'Failed to reactivate Ask VSA knowledge snippet' : 'Failed to deactivate Ask VSA knowledge snippet');
  }

  /**
   * "I checked this and it is still right": stamps the review time without
   * touching the content. The reviewer goes to the admin-only activity log, never
   * to this publicly readable table.
   */
  async markReviewed(snippet: Pick<AiKnowledgeSnippet, 'id' | 'title'>): Promise<AiKnowledgeSnippet> {
    return withErrorHandling(async () => {
      const { data, error } = await aiKnowledgeTable()
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', snippet.id)
        .select('*')
        .single();
      if (error) throw error;
      logAdminActivity({
        action: ACTIVITY_ACTIONS.aiKnowledgeReviewed,
        entityType: 'ai_knowledge',
        entityId: snippet.id,
        summary: activitySummary.aiKnowledgeReviewed(snippet.title),
      });
      return data as AiKnowledgeSnippet;
    }, 'Failed to mark Ask VSA knowledge snippet as reviewed');
  }

  /** The most recent review of each snippet, newest first, from the activity log. Empty if the log is unavailable. */
  async listLatestReviews(): Promise<Map<string, AiKnowledgeReview>> {
    const reviews = new Map<string, AiKnowledgeReview>();
    try {
      const entries = await adminActivityRepository.list({ filter: 'ask_vsa', limit: 200 });
      for (const entry of entries) {
        if (entry.action !== ACTIVITY_ACTIONS.aiKnowledgeReviewed || !entry.entityId || reviews.has(entry.entityId)) continue;
        const actor = entry.metadata.actor;
        reviews.set(entry.entityId, { reviewedAt: entry.createdAt, reviewer: typeof actor === 'string' ? actor : null });
      }
    } catch (error) {
      console.warn('Could not load who reviewed Ask VSA knowledge', error);
    }
    return reviews;
  }

  /**
   * What the linked snippets point at, read only when some snippet is linked and
   * only for the linked ids. A failed read is `null` (the entity rules are then
   * skipped), never an empty list (which would read as "the entity is gone").
   */
  async loadEntityContext(snippets: readonly AiKnowledgeSnippet[]): Promise<AiKnowledgeEntityContext> {
    const linked = snippets.filter((snippet) => snippet.linked_entity_type && snippet.linked_entity_key);
    const eventIds = Array.from(new Set(linked.filter((s) => s.linked_entity_type === 'event').map((s) => s.linked_entity_key as string)));
    const needsApplications = linked.some((s) => s.linked_entity_type === 'application');

    const [applications, events] = await Promise.all([
      needsApplications
        ? Promise.resolve(supabase.from('application_links').select('application_key, due_at, updated_at'))
            .then(({ data, error }) => (error ? null : (data as KnowledgeEntityApplication[] | null)))
            .catch(() => null)
        : Promise.resolve<KnowledgeEntityApplication[]>([]),
      eventIds.length > 0
        ? Promise.resolve(supabase.from('events').select('id, date, end_date, is_published, updated_at').in('id', eventIds))
            .then(({ data, error }) => (error ? null : (data as KnowledgeEntityEvent[] | null)))
            .catch(() => null)
        : Promise.resolve<KnowledgeEntityEvent[]>([]),
    ]);
    return { applications, events };
  }
}

export const aiKnowledgeRepository = new AiKnowledgeRepository();

/** The columns the freshness rules read, as an AiKnowledgeSnippet already carries them. */
export function toFreshnessRow(snippet: AiKnowledgeSnippet): KnowledgeFreshnessRow {
  return snippet;
}
