import { supabase } from '../../lib/supabase';
import { withErrorHandling, DatabaseError, NotFoundError, ValidationError } from '../errors';
import { Event, EventInterestCounts } from '../../types';
import { CreateEventFormData, UpdateEventFormData } from '../../schemas';

export interface EventWithAttendance extends Event {
  attendance_count: number;
  user_attended?: boolean;
  interest_counts?: EventInterestCounts | null;
}

export type PublicEventPreview = Pick<
  Event,
  | 'id'
  | 'name'
  | 'date'
  | 'start_time'
  | 'end_time'
  | 'end_date'
  | 'location'
  | 'points'
  | 'event_type'
  | 'image_url'
  | 'thumbnail_url'
> & {
  interest_counts?: EventInterestCounts | null;
};

export interface EventFilters {
  event_type?: Event['event_type'];
  academic_term_id?: string | null;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'date' | 'name' | 'created_at';
  sort_ascending?: boolean;
  include_unpublished?: boolean;
}

export interface EventStats {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  total_attendance: number;
}

export interface PublishedPastEventArchiveAvailability {
  termIds: string[];
  hasUnassignedEvents: boolean;
}

export class EventsRepository {
  async getPublishedPastEventArchiveAvailability(
    dateTo: string
  ): Promise<PublishedPastEventArchiveAvailability> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('events')
        .select('academic_term_id')
        .eq('is_published', true)
        .lte('date', dateTo);

      if (error) throw error;

      const termIds = new Set<string>();
      let hasUnassignedEvents = false;

      for (const event of data ?? []) {
        if (event.academic_term_id) {
          termIds.add(event.academic_term_id);
        } else {
          hasUnassignedEvents = true;
        }
      }

      return { termIds: Array.from(termIds), hasUnassignedEvents };
    }, 'Failed to fetch past event archive availability');
  }

  /**
   * Get all events with optional filtering
   */
  async getEvents(filters: EventFilters = {}): Promise<EventWithAttendance[]> {
    return withErrorHandling(async () => {
      // Step 1: fetch events (simple select). Avoid embedded aggregates which can cause 400s.
      let eventsQuery = supabase.from('events').select('*');

      // Apply filters
      if (!filters.include_unpublished) eventsQuery = eventsQuery.eq('is_published', true);
      if (filters.event_type) eventsQuery = eventsQuery.eq('event_type', filters.event_type);
      if (filters.academic_term_id !== undefined) {
        eventsQuery = filters.academic_term_id
          ? eventsQuery.eq('academic_term_id', filters.academic_term_id)
          : eventsQuery.is('academic_term_id', null);
      }
      if (filters.date_from) eventsQuery = eventsQuery.gte('date', filters.date_from);
      if (filters.date_to) eventsQuery = eventsQuery.lte('date', filters.date_to);

      // Order by date
      const sortBy = filters.sort_by || 'date';
      const ascending = filters.sort_ascending !== undefined ? filters.sort_ascending : true;
      eventsQuery = eventsQuery.order(sortBy, { ascending });

      // Apply pagination
      if (filters.limit) eventsQuery = eventsQuery.limit(filters.limit);
      if (filters.offset) eventsQuery = eventsQuery.range(filters.offset, filters.offset + (filters.limit || 10) - 1);

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      if (!events) throw new NotFoundError('No events found');

      // Fetch interest counts
      const eventIds = events.map(e => e.id);
      const { data: interestData } = await supabase
        .from('event_interest_counts')
        .select('*')
        .in('event_id', eventIds);

      const interestMap = new Map<string, EventInterestCounts>();
      interestData?.forEach(ic => interestMap.set(ic.event_id, ic));

      // Note: We no longer fetch attendance rows here to avoid large egress payloads.
      // attendance_count is not used on list views.
      return events.map((event: any) => ({
        ...event,
        attendance_count: 0,
        interest_counts: interestMap.get(event.id) || null,
      }));
    }, 'Failed to fetch events');
  }

  /**
   * Get a single event by ID
   */
  async getEventById(id: string, userId?: string): Promise<EventWithAttendance> {
    return withErrorHandling(async () => {
      // Fetch event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      if (!event) throw new NotFoundError('Event not found', 'event', id);

      // Fetch attendance rows for this event (we'll count and check user attendance client-side)
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('event_attendance')
        .select('user_id, checked_in_at')
        .eq('event_id', id);

      if (attendanceError) throw attendanceError;

      // Fetch interest counts
      const { data: interestData } = await supabase
        .from('event_interest_counts')
        .select('*')
        .eq('event_id', id)
        .single();

      const attendanceRows = attendanceData || [];
      const attendanceCount = attendanceRows.length;
      const userAttended = userId ? attendanceRows.some((r: any) => r.user_id === userId) : false;

      return {
        ...event,
        attendance_count: attendanceCount,
        user_attended: !!userAttended,
        interest_counts: interestData || null,
      };
    }, 'Failed to fetch event');
  }

  /**
   * Record public interest in an event
   */
  async recordInterest(eventId: string, signal: 'interested' | 'going'): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.rpc('record_event_interest', {
        p_event_id: eventId,
        p_signal: signal
      });

      if (error) throw error;
    }, 'Failed to record event interest');
  }

  /**
   * Create a new event
   */
  async createEvent(eventData: CreateEventFormData): Promise<Event> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new DatabaseError('Failed to create event');

      return data;
    }, 'Failed to create event');
  }

  /**
   * Update an existing event
   */
  async updateEvent(id: string, eventData: UpdateEventFormData): Promise<Event> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('events')
        .update({
          ...eventData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError('Event not found', 'event', id);

      return data;
    }, 'Failed to update event');
  }

  /**
   * Get the admin-only check-in code for an event
   */
  async getCheckInCode(eventId: string): Promise<string | null> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('event_check_in_secrets')
        .select('check_in_code')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) throw error;
      return data?.check_in_code ?? null;
    }, 'Failed to fetch check-in code');
  }

  /**
   * Set (or replace) the admin-only check-in code for an event
   */
  async setCheckInCode(eventId: string, code: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('event_check_in_secrets')
        .upsert({ event_id: eventId, check_in_code: code });

      if (error) throw error;
    }, 'Failed to set check-in code');
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to delete event');
  }

  /**
   * Check in a user to an event
   */
  async checkInUser(eventId: string, userId: string, checkInType: 'code' | 'manual', code?: string): Promise<void> {
    return withErrorHandling(async () => {
      // First, get the event to validate the check-in
      const event = await this.getEventById(eventId);

      if (checkInType === 'code') {
        if (!code) {
          throw new ValidationError('Check-in code is required');
        }

        const storedCode = await this.getCheckInCode(eventId);
        if (!storedCode || storedCode !== code) {
          throw new ValidationError('Invalid check-in code');
        }

        if (event.is_code_expired) {
          throw new ValidationError('Check-in code has expired');
        }
      }

      // Check if user is already checked in
      const { data: existingAttendance } = await supabase
        .from('event_attendance')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (existingAttendance) {
        throw new ValidationError('User is already checked in to this event');
      }

      // Create attendance record
      const { error } = await supabase
        .from('event_attendance')
        .insert([{
          event_id: eventId,
          user_id: userId,
          points_earned: event.points,
          check_in_type: checkInType,
          checked_in_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    }, 'Failed to check in user');
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<EventStats> {
    return withErrorHandling(async () => {
      const now = new Date().toISOString();

      // Get total events
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      // Get upcoming events
      const { count: upcomingEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('date', now);

      // Get past events
      const { count: pastEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .lt('date', now);

      // Get total attendance
      const { count: totalAttendance } = await supabase
        .from('event_attendance')
        .select('*', { count: 'exact', head: true });

      return {
        total_events: totalEvents || 0,
        upcoming_events: upcomingEvents || 0,
        past_events: pastEvents || 0,
        total_attendance: totalAttendance || 0,
      };
    }, 'Failed to fetch event statistics');
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit: number = 5): Promise<EventWithAttendance[]> {
    return this.getEvents({
      date_from: new Date().toISOString(),
      limit,
    });
  }

  async getPublicUpcomingPreview(dateFrom: string, limit: number = 4): Promise<PublicEventPreview[]> {
    return withErrorHandling(async () => {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, name, date, start_time, end_time, end_date, location, points, event_type, image_url, thumbnail_url')
        .eq('is_published', true)
        .gte('date', dateFrom)
        .order('date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      if (!events) return [];

      // Fetch interest counts
      const eventIds = events.map(e => e.id);
      const { data: interestData } = await supabase
        .from('event_interest_counts')
        .select('*')
        .in('event_id', eventIds);

      const interestMap = new Map<string, EventInterestCounts>();
      interestData?.forEach(ic => interestMap.set(ic.event_id, ic));

      return events.map((event: any) => ({
        ...event,
        interest_counts: interestMap.get(event.id) || null,
      })) as PublicEventPreview[];
    }, 'Failed to fetch upcoming event previews');
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType: Event['event_type'], limit?: number): Promise<EventWithAttendance[]> {
    return this.getEvents({
      event_type: eventType,
      limit,
    });
  }
}

// Export a singleton instance
export const eventsRepository = new EventsRepository();
