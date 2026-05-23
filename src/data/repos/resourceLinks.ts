import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';
import { ResourceLink } from '../../types';
import { withErrorHandling } from '../errors';

export const RESOURCE_LINK_CATEGORIES = [
  'Marketing',
  'Room Booking',
  'Reimbursement',
  'Event Planning',
  'Cabinet Operations',
  'House',
  'ACE',
  'VCN',
  'WNC',
  'EOYB',
  'Contacts',
  'Templates',
  'Transition Docs',
] as const;

export type ResourceLinkFormData = Omit<
  Database['public']['Tables']['resource_links']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

function normalizePayload(resource: ResourceLinkFormData): ResourceLinkFormData {
  return {
    ...resource,
    title: resource.title.trim(),
    url: resource.url.trim(),
    category: resource.category.trim(),
    description: resource.description?.trim() || null,
    role: resource.role?.trim() || null,
    program: resource.program?.trim() || null,
    workflow: resource.workflow?.trim() || null,
    owner_role: resource.owner_role?.trim() || null,
    academic_year_start: resource.academic_year_start ?? null,
    academic_year_end: resource.academic_year_end ?? null,
    last_verified_at: resource.last_verified_at ?? null,
    visibility: 'admin_only',
  };
}

function normalizePatch(resource: Partial<ResourceLinkFormData>): Partial<ResourceLinkFormData> {
  const patch: Partial<ResourceLinkFormData> = {
    ...resource,
    visibility: 'admin_only',
  };

  if (resource.title !== undefined) patch.title = resource.title.trim();
  if (resource.url !== undefined) patch.url = resource.url.trim();
  if (resource.category !== undefined) patch.category = resource.category.trim();
  if (resource.description !== undefined) patch.description = resource.description?.trim() || null;
  if (resource.role !== undefined) patch.role = resource.role?.trim() || null;
  if (resource.program !== undefined) patch.program = resource.program?.trim() || null;
  if (resource.workflow !== undefined) patch.workflow = resource.workflow?.trim() || null;
  if (resource.owner_role !== undefined) patch.owner_role = resource.owner_role?.trim() || null;

  return patch;
}

export class ResourceLinksRepository {
  async getAll(): Promise<ResourceLink[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('resource_links')
        .select('*')
        .order('is_archived', { ascending: true })
        .order('is_current', { ascending: false })
        .order('category', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ResourceLink[];
    }, 'Failed to fetch resource links');
  }

  async create(resource: ResourceLinkFormData): Promise<ResourceLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('resource_links')
        .insert(normalizePayload(resource))
        .select('*')
        .single();

      if (error) throw error;
      return data as ResourceLink;
    }, 'Failed to create resource link');
  }

  async update(id: string, resource: Partial<ResourceLinkFormData>): Promise<ResourceLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('resource_links')
        .update(normalizePatch(resource))
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as ResourceLink;
    }, 'Failed to update resource link');
  }

  async setArchived(id: string, isArchived: boolean): Promise<ResourceLink> {
    return withErrorHandling(async () => {
      const patch = isArchived ? { is_archived: true, is_current: false } : { is_archived: false };
      const { data, error } = await supabase
        .from('resource_links')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as ResourceLink;
    }, 'Failed to update archive status');
  }

  async markVerified(id: string): Promise<ResourceLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('resource_links')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as ResourceLink;
    }, 'Failed to mark resource verified');
  }

  async delete(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('resource_links').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete resource link');
  }
}

export const resourceLinksRepository = new ResourceLinksRepository();
