import { supabase } from '../../lib/supabase';
import { withErrorHandling, NotFoundError } from '../errors';
import { ExternalEvent } from '../../types';
import { Database } from '../../types/database';
import { ExternalSyncPlan, LinkedExternalPayload } from '../../lib/externalEventLinking';

type ExternalEventInsert = Database['public']['Tables']['external_events']['Insert'];

export interface ExternalEventFilters {
  status?: ExternalEvent['status'];
  uvsa_school_id?: string;
  is_featured?: boolean;
  limit?: number;
}

/**
 * Every `external_events` column an anonymous visitor may read, with the joined
 * school restricted to its own public columns.
 *
 * `source_notes` and `confidence_level` are deliberately absent: migration
 * 20260820000002_restrict_anon_uvsa_columns.sql revokes anon's table-wide SELECT
 * on both tables and re-grants only the public columns (#382). A `select('*')`
 * therefore fails for anon, and the nested `uvsa_schools(*)` fails for the same
 * reason — so both sides of the join must name their columns.
 *
 * Admin reads run as `authenticated`, which keeps table-level SELECT.
 */
const PUBLIC_EXTERNAL_EVENT_COLUMNS =
  'id, host_type, source_event_id, uvsa_school_id, title, event_type, date, academic_term_id, location, description, points, rsvp_url, ride_form_url, instagram_url, host_info_url, ride_info, status, photo_album_url, recap, is_featured, created_at, updated_at, uvsa_school:uvsa_schools(id, school_name, short_name, slug, system_type, city, vsa_name, instagram_url, linktree_url, website_url, facebook_url, youtube_url, tiktok_url, description, known_for, recurring_events, logo_url, image_url, is_active, sort_order, created_at, updated_at)' as const;

export class ExternalEventsRepository {
  /**
   * Get external events with optional filters
   */
  async getEvents(filters: ExternalEventFilters = {}): Promise<ExternalEvent[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('external_events')
        .select(PUBLIC_EXTERNAL_EVENT_COLUMNS);

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

      // Order: upcoming first (nearest date first), then others (most recent date first)
      if (filters.status === 'upcoming') {
        query = query.order('date', { ascending: true, nullsFirst: false });
      } else {
        query = query.order('date', { ascending: false, nullsFirst: false });
      }
      
      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      // supabase-js types a to-one embed as an array; PostgREST returns a single
      // object at runtime. The previous `select('*, ...)` string was untyped, so
      // this mismatch existed but was invisible. Runtime shape is unchanged.
      return (data ?? []) as unknown as ExternalEvent[];
    }, 'Failed to fetch external events');
  }

  /**
   * Get all events for admin (includes drafts)
   */
  async getAllEvents(): Promise<ExternalEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .select<string, ExternalEvent>('*, uvsa_school:uvsa_schools(*), source_event:events(id, name)')
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
        .select(PUBLIC_EXTERNAL_EVENT_COLUMNS)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError('External event not found', 'external_events', id);
      // See the embed-cardinality note in getEvents.
      return data as unknown as ExternalEvent;
    }, 'Failed to fetch external event');
  }

  /**
   * The listings that mirror the given events, keyed by source event id.
   *
   * Public: anon reads only non-draft rows (row policy), and only the public
   * columns, so a hidden listing simply has no entry.
   */
  async getListingsBySourceEventIds(eventIds: string[]): Promise<Map<string, ExternalEvent>> {
    return withErrorHandling(async () => {
      const listings = new Map<string, ExternalEvent>();
      if (eventIds.length === 0) return listings;

      const { data, error } = await supabase
        .from('external_events')
        .select(PUBLIC_EXTERNAL_EVENT_COLUMNS)
        .in('source_event_id', eventIds);

      if (error) throw error;
      for (const row of (data ?? []) as unknown as ExternalEvent[]) {
        if (row.source_event_id) listings.set(row.source_event_id, row);
      }
      return listings;
    }, 'Failed to fetch linked external listings');
  }

  /**
   * Create or update the one listing that mirrors an event.
   *
   * Upserts on the unique `source_event_id`, so saving the same event twice
   * updates in place and can never create a second listing. Columns the
   * payload omits (featured, recap, photo album, source notes) are left alone.
   */
  async saveLinkedListing(sourceEventId: string, payload: LinkedExternalPayload): Promise<ExternalEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .upsert(
          { ...payload, source_event_id: sourceEventId } as ExternalEventInsert,
          { onConflict: 'source_event_id' }
        )
        .select<string, ExternalEvent>()
        .single();

      if (error) throw error;
      return data;
    }, 'Failed to save the UVSA Network listing');
  }

  /**
   * Hide an event's listing without deleting it: its links, recap, and album
   * stay, and switching the event back to External Event reuses the record.
   */
  async hideLinkedListing(sourceEventId: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('external_events')
        .update({ status: 'draft' })
        .eq('source_event_id', sourceEventId);

      if (error) throw error;
    }, 'Failed to hide the UVSA Network listing');
  }

  /** Carries out the plan `planExternalSync` made for one event save. */
  async applySyncPlan(sourceEventId: string, plan: ExternalSyncPlan): Promise<void> {
    if (plan.action === 'upsert') await this.saveLinkedListing(sourceEventId, plan.payload);
    else if (plan.action === 'hide') await this.hideLinkedListing(sourceEventId);
  }

  /**
   * Create or update external event
   */
  async upsertEvent(event: Partial<ExternalEvent>): Promise<ExternalEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('external_events')
        .upsert(event as ExternalEventInsert)
        .select<string, ExternalEvent>()
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
