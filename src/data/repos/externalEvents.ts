import { supabase } from '../../lib/supabase';
import { withErrorHandling, NotFoundError } from '../errors';
import { ExternalEvent } from '../../types';

export interface ExternalEventFilters {
  status?: ExternalEvent['status'];
  uvsa_school_id?: string;
  is_featured?: boolean;
  limit?: number;
}

export class ExternalEventsRepository {
  /**
   * Get external events with optional filters
   */
  async getEvents(filters: ExternalEventFilters = {}): Promise<ExternalEvent[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('external_events')
        .select('*, uvsa_school:uvsa_schools(*)');

      if (filters.status) {
        query = query.eq('status', filters.status);
      } else {
        // By default, exclude drafts for public view if status not specified
        // But for admin, we might want all. Repos usually handle public view by default
        // or take an 'includeDrafts' flag.
        // Let's stick to status filter if provided.
      }

      if (filters.uvsa_school_id) {
        query = query.eq('uvsa_school_id', filters.uvsa_school_id);
      }

      if (filters.is_featured !== undefined) {
        query = query.eq('is_featured', filters.is_featured);
      }

      // Order: upcoming first (by date), then past (by date descending)
      // Actually, standard is date ascending for upcoming, date descending for past.
      // For a mixed list, we'll just do date descending or date ascending.
      // Let's do date descending (most recent first) for the showcase.
      query = query.order('date', { ascending: false, nullsFirst: false });
      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, 'Failed to fetch external events');
  }

  /**
   * Get all events for admin (includes drafts)
   */
  async getAllEvents(): Promise<ExternalEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .select('*, uvsa_school:uvsa_schools(*)')
        .order('date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }, 'Failed to fetch all external events');
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<ExternalEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .select('*, uvsa_school:uvsa_schools(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError('External event not found', 'external_events', id);
      return data;
    }, 'Failed to fetch external event');
  }

  /**
   * Create or update external event
   */
  async upsertEvent(event: Partial<ExternalEvent>): Promise<ExternalEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .upsert(event)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Failed to save external event');
  }

  /**
   * Delete external event
   */
  async deleteEvent(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('external_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to delete external event');
  }
}

export const externalEventsRepository = new ExternalEventsRepository();
