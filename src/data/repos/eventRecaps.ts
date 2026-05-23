import { supabase } from '../../lib/supabase';
import { EventRecap } from '../../types';
import { withErrorHandling, DatabaseError } from '../errors';

export type EventRecapFormData = Pick<
  EventRecap,
  | 'owner_names'
  | 'cabinet_roles'
  | 'attendance_notes'
  | 'what_worked'
  | 'what_failed'
  | 'next_time_improvements'
  | 'budget_notes'
  | 'aftersocial_notes'
  | 'risks_issues'
  | 'drive_folder_url'
  | 'planning_doc_url'
  | 'gallery_event_id'
  | 'public_highlight'
  | 'is_public_highlight_published'
>;

function normalizeText(value: string | null): string | null {
  return value?.trim() || null;
}

function normalizeRecapInput(input: EventRecapFormData): EventRecapFormData {
  return {
    ...input,
    owner_names: normalizeText(input.owner_names),
    cabinet_roles: normalizeText(input.cabinet_roles),
    attendance_notes: normalizeText(input.attendance_notes),
    what_worked: normalizeText(input.what_worked),
    what_failed: normalizeText(input.what_failed),
    next_time_improvements: normalizeText(input.next_time_improvements),
    budget_notes: normalizeText(input.budget_notes),
    aftersocial_notes: normalizeText(input.aftersocial_notes),
    risks_issues: normalizeText(input.risks_issues),
    drive_folder_url: normalizeText(input.drive_folder_url),
    planning_doc_url: normalizeText(input.planning_doc_url),
    gallery_event_id: normalizeText(input.gallery_event_id),
    public_highlight: normalizeText(input.public_highlight),
    is_public_highlight_published: input.is_public_highlight_published,
  };
}

export class EventRecapsRepository {
  async getRecapForEvent(eventId: string): Promise<EventRecap | null> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('event_recaps')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as EventRecap | null;
    }, 'Failed to fetch event recap');
  }

  async getRecapEventIds(eventIds: string[]): Promise<string[]> {
    return withErrorHandling(async () => {
      if (eventIds.length === 0) return [];

      const { data, error } = await supabase
        .from('event_recaps')
        .select('event_id')
        .in('event_id', eventIds);

      if (error) throw error;
      return (data ?? []).map((row) => row.event_id).filter(Boolean);
    }, 'Failed to fetch event recap statuses');
  }

  async saveRecapForEvent(
    eventId: string,
    input: EventRecapFormData,
    userId: string,
    existingRecapId?: string,
  ): Promise<EventRecap> {
    return withErrorHandling(async () => {
      const values = normalizeRecapInput(input);

      if (existingRecapId) {
        const { data, error } = await supabase
          .from('event_recaps')
          .update({
            ...values,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRecapId)
          .select('*')
          .single();

        if (error) throw error;
        if (!data) throw new DatabaseError('Failed to update event recap');
        return data as EventRecap;
      }

      const { data, error } = await supabase
        .from('event_recaps')
        .insert({
          ...values,
          event_id: eventId,
          created_by: userId,
          updated_by: userId,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new DatabaseError('Failed to create event recap');
      return data as EventRecap;
    }, 'Failed to save event recap');
  }
}

export const eventRecapsRepository = new EventRecapsRepository();
