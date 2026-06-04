import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';
import { ApplicationKey, ApplicationLink, PublicApplicationLink } from '../../types';
import { withErrorHandling } from '../errors';
import { maskTargetUrl } from '../../lib/applicationLinks';

export type ApplicationLinkFormData = Omit<
  Database['public']['Tables']['application_links']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

const PUBLIC_SELECT = [
  'id',
  'application_key',
  'title',
  'description',
  'button_label',
  'target_url',
  'status',
  'open_at',
  'due_at',
  'is_enabled',
  'before_open_message',
  'after_close_message',
  'sort_order',
  'updated_at',
].join(', ');

function normalizePayload(input: ApplicationLinkFormData): ApplicationLinkFormData {
  return {
    ...input,
    title: input.title.trim(),
    button_label: input.button_label.trim(),
    target_url: input.target_url.trim(),
    description: input.description?.trim() || null,
    before_open_message: input.before_open_message?.trim() || null,
    after_close_message: input.after_close_message?.trim() || null,
  };
}

function normalizePatch(
  input: Partial<ApplicationLinkFormData>,
): Partial<ApplicationLinkFormData> {
  const patch: Partial<ApplicationLinkFormData> = { ...input };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.button_label !== undefined) patch.button_label = input.button_label.trim();
  if (input.target_url !== undefined) patch.target_url = input.target_url.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.before_open_message !== undefined)
    patch.before_open_message = input.before_open_message?.trim() || null;
  if (input.after_close_message !== undefined)
    patch.after_close_message = input.after_close_message?.trim() || null;
  return patch;
}

// Defensive: even though the view masks target_url server-side, never surface a
// URL through a public method unless the row is currently open.
function maskPublicRow(row: PublicApplicationLink): PublicApplicationLink {
  return { ...row, target_url: maskTargetUrl(row.status, row.target_url) };
}

export class ApplicationLinksRepository {
  // ── Admin (raw rows, requires admin RLS) ──────────────────────────────────
  async listAdminApplicationLinks(): Promise<ApplicationLink[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('application_links')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('application_key', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ApplicationLink[];
    }, 'Failed to fetch application links');
  }

  async createApplicationLink(input: ApplicationLinkFormData): Promise<ApplicationLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('application_links')
        .insert(normalizePayload(input))
        .select('*')
        .single();

      if (error) throw error;
      return data as ApplicationLink;
    }, 'Failed to create application link');
  }

  async updateApplicationLink(
    id: string,
    input: Partial<ApplicationLinkFormData>,
  ): Promise<ApplicationLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('application_links')
        .update(normalizePatch(input))
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as ApplicationLink;
    }, 'Failed to update application link');
  }

  async setApplicationLinkEnabled(id: string, isEnabled: boolean): Promise<ApplicationLink> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('application_links')
        .update({ is_enabled: isEnabled })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as ApplicationLink;
    }, 'Failed to update application link status');
  }

  async deleteApplicationLink(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('application_links').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete application link');
  }

  // ── Public (view-backed, target_url masked unless open) ───────────────────
  // These read the public_application_links view, which never exposes the raw
  // target_url for closed/future/disabled rows. Errors propagate so callers can
  // detect Supabase outages (isSupabaseUnavailable) and show degraded copy.
  async getPublicApplicationLinks(): Promise<PublicApplicationLink[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('public_application_links')
        .select(PUBLIC_SELECT)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as unknown as PublicApplicationLink[]).map(maskPublicRow);
    }, 'Failed to fetch application links');
  }

  async getPublicApplicationLink(
    applicationKey: ApplicationKey,
  ): Promise<PublicApplicationLink | null> {
    const links = await this.getPublicApplicationLinksByKeys([applicationKey]);
    return links[0] ?? null;
  }

  async getPublicApplicationLinksByKeys(
    applicationKeys: ApplicationKey[],
  ): Promise<PublicApplicationLink[]> {
    if (applicationKeys.length === 0) return [];

    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('public_application_links')
        .select(PUBLIC_SELECT)
        .in('application_key', applicationKeys)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as unknown as PublicApplicationLink[]).map(maskPublicRow);
    }, 'Failed to fetch application links');
  }
}

export const applicationLinksRepository = new ApplicationLinksRepository();
