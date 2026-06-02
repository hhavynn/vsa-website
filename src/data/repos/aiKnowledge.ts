import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

export const AI_KNOWLEDGE_SOURCE_TYPES = ['manual', 'public_page', 'public_event', 'faq'] as const;

export type AiKnowledgeSourceType = (typeof AI_KNOWLEDGE_SOURCE_TYPES)[number];

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
  last_verified_at: string | null;
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
  last_verified_at?: string | null;
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
    title: input.title.trim(),
    content: input.content.trim(),
    category: input.category.trim(),
    source_type: input.source_type,
    source_url: input.source_url?.trim() || null,
    is_active: input.is_active ?? true,
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 0,
    tags: normalizeTags(input.tags),
    last_verified_at: input.last_verified_at || null,
  };
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

  async createSnippet(input: AiKnowledgeSnippetInput): Promise<AiKnowledgeSnippet> {
    return withErrorHandling(async () => {
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
      const { data, error } = await aiKnowledgeTable()
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as AiKnowledgeSnippet;
    }, isActive ? 'Failed to reactivate Ask VSA knowledge snippet' : 'Failed to deactivate Ask VSA knowledge snippet');
  }
}

export const aiKnowledgeRepository = new AiKnowledgeRepository();
