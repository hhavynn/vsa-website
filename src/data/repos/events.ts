import { supabase } from '../../lib/supabase';
import { withErrorHandling, DatabaseError, NotFoundError, ValidationError } from '../errors';
import { Event } from '../../types';
import { CreateEventFormData, UpdateEventFormData } from '../../schemas';

export interface EventWithAttendance extends Event {
  attendance_count: number;
  user_attended?: boolean;
}

export interface EventFilters {
  event_type?: Event['event_type'];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface EventStats {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  total_attendance: number;
}

export class EventsRepository {
  /**
   * Get all events with optional filtering
   */
  async getEvents(filters: EventFilters = {}): Promise<EventWithAttendance[]> {
    return withErrorHandling(async () => {
      // Step 1: fetch events (simple select). Avoid embedded aggregates which can cause 400s.
      let eventsQuery = supabase.from('events').select('*');

      // Apply filters
      if (filters.event_type) eventsQuery = eventsQuery.eq('event_type', filters.event_type);
      if (filters.date_from) eventsQuery = eventsQuery.gte('date', filters.date_from);
      if (filters.date_to) eventsQuery = eventsQuery.lte('date', filters.date_to);

      // Order by date
      eventsQuery = eventsQuery.order('date', { ascending: true });

      // Apply pagination
      if (filters.limit) eventsQuery = eventsQuery.limit(filters.limit);
      if (filters.offset) eventsQuery = eventsQuery.range(filters.offset, filters.offset + (filters.limit || 10) - 1);

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      if (!events) throw new NotFoundError('No events found');

      // Step 2: fetch attendance rows for the returned events and compute counts client-side.
      const eventIds = events.map((e: any) => e.id).filter(Boolean);
      let attendanceRows: Array<{ event_id: string }> = [];
      if (eventIds.length) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('event_attendance')
          .select('event_id')
          .in('event_id', eventIds as unknown as string[]);
        if (attendanceError) throw attendanceError;
        attendanceRows = attendanceData || [];
      }

      const countsMap: Record<string, number> = {};
      for (const row of attendanceRows) {
        countsMap[row.event_id] = (countsMap[row.event_id] || 0) + 1;
      }

      return events.map((event: any) => ({
        ...event,
        attendance_count: countsMap[event.id] || 0,
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

      const attendanceRows = attendanceData || [];
      const attendanceCount = attendanceRows.length;
      const userAttended = userId ? attendanceRows.some((r: any) => r.user_id === userId) : false;

      return {
        ...event,
        attendance_count: attendanceCount,
        user_attended: !!userAttended,
      };
    }, 'Failed to fetch event');
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
        
        if (!event.check_in_code || event.check_in_code !== code) {
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
