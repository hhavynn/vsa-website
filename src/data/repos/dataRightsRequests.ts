import { supabase } from '../../lib/supabase';
import {
  DataRightsDependencyPreview,
  DataRightsDependencyPreviewSchema,
  DataRightsExportBundle,
  DataRightsExportBundleSchema,
} from '../../schemas';
import { Database } from '../../types/database';
import { withErrorHandling } from '../errors';

export type DataRightsRequest = Database['public']['Tables']['data_rights_requests']['Row'];
export type DataRightsRequestEvent = Database['public']['Tables']['data_rights_request_events']['Row'];

export type DataRightsRequestInput = Omit<
  Database['public']['Tables']['data_rights_requests']['Insert'],
  'id' | 'completed_at' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
>;

export type DataRightsRequestPatch = Omit<
  Database['public']['Tables']['data_rights_requests']['Update'],
  'id' | 'completed_at' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
>;

export interface DataRightsAdminOption {
  id: string;
  displayName: string;
}

const REQUEST_SELECT = 'id, request_type, status, subject_auth_user_id, subject_member_id, subject_display_name, contact_channel, contact_reference, verification_status, verification_method, assigned_to, reviewer_id, priority, summary, internal_notes, decision, completed_at, created_by, updated_by, created_at, updated_at' as const;

function nullableText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function normalizeInput(input: DataRightsRequestInput): DataRightsRequestInput {
  return {
    ...input,
    subject_display_name: nullableText(input.subject_display_name),
    contact_channel: nullableText(input.contact_channel),
    contact_reference: nullableText(input.contact_reference),
    verification_method: nullableText(input.verification_method),
    summary: nullableText(input.summary),
    internal_notes: nullableText(input.internal_notes),
    decision: nullableText(input.decision),
  };
}

function normalizePatch(input: DataRightsRequestPatch): DataRightsRequestPatch {
  const patch = { ...input };
  if (input.subject_display_name !== undefined)
    patch.subject_display_name = nullableText(input.subject_display_name);
  if (input.contact_channel !== undefined)
    patch.contact_channel = nullableText(input.contact_channel);
  if (input.contact_reference !== undefined)
    patch.contact_reference = nullableText(input.contact_reference);
  if (input.verification_method !== undefined)
    patch.verification_method = nullableText(input.verification_method);
  if (input.summary !== undefined) patch.summary = nullableText(input.summary);
  if (input.internal_notes !== undefined)
    patch.internal_notes = nullableText(input.internal_notes);
  if (input.decision !== undefined) patch.decision = nullableText(input.decision);
  return patch;
}

export class DataRightsRequestsRepository {
  async listDataRightsRequests(): Promise<DataRightsRequest[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('data_rights_requests')
        .select(REQUEST_SELECT)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as DataRightsRequest[];
    }, 'Failed to fetch data-rights requests');
  }

  async createDataRightsRequest(input: DataRightsRequestInput): Promise<DataRightsRequest> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('data_rights_requests')
        .insert(normalizeInput(input))
        .select(REQUEST_SELECT)
        .single();

      if (error) throw error;
      return data as DataRightsRequest;
    }, 'Failed to create data-rights request');
  }

  async updateDataRightsRequest(
    id: string,
    input: DataRightsRequestPatch,
  ): Promise<DataRightsRequest> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('data_rights_requests')
        .update(normalizePatch(input))
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single();

      if (error) throw error;
      return data as DataRightsRequest;
    }, 'Failed to update data-rights request');
  }

  async listDataRightsRequestEvents(requestId: string): Promise<DataRightsRequestEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('data_rights_request_events')
        .select('id, request_id, event_type, event_summary, created_by, created_at')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as DataRightsRequestEvent[];
    }, 'Failed to fetch data-rights request history');
  }

  async getDataRightsDependencyPreview(requestId: string): Promise<DataRightsDependencyPreview> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('get_data_rights_dependency_preview', {
        p_request_id: requestId,
      });

      if (error) throw error;
      return DataRightsDependencyPreviewSchema.parse(data);
    }, 'Failed to generate data-rights dependency preview');
  }

  async generateDataRightsExport(requestId: string): Promise<DataRightsExportBundle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('generate_data_rights_export', {
        p_request_id: requestId,
      });

      if (error) throw error;
      return DataRightsExportBundleSchema.parse(data);
    }, 'Failed to generate data-rights export');
  }

  async listAdminAssignees(): Promise<DataRightsAdminOption[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .eq('is_admin', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((profile) => ({
        id: profile.id,
        displayName: `${profile.first_name} ${profile.last_name}`.trim() || 'Admin',
      }));
    }, 'Failed to fetch admin assignees');
  }
}

export const dataRightsRequestsRepository = new DataRightsRequestsRepository();
