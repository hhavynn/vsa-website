import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { withErrorHandling } from '../errors';

export interface EventWithAttendance extends Event {
  attendance_count: number;
}

export interface EventFilters {
  event_type?: Event['event_type'];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class EventsRepository {
  async getEvents(filters: EventFilters = {}): Promise<EventWithAttendance[]> {
    return withErrorHandling(async () => {
      let eventsQuery = supabase.from('events').select('*');

      if (filters.event_type) eventsQuery = eventsQuery.eq('event_type', filters.event_type);
      if (filters.date_from) eventsQuery = eventsQuery.gte('date', filters.date_from);
      if (filters.date_to) eventsQuery = eventsQuery.lte('date', filters.date_to);

      eventsQuery = eventsQuery.order('date', { ascending: true });

      if (filters.limit) eventsQuery = eventsQuery.limit(filters.limit);
      if (filters.offset) {
        const pageSize = filters.limit ?? 10;
        eventsQuery = eventsQuery.range(filters.offset, filters.offset + pageSize - 1);
      }

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      if (!events?.length) return [];

      const eventIds = events.map((event) => event.id).filter(Boolean);
      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('event_attendance')
        .select('event_id')
        .in('event_id', eventIds);

      if (attendanceError) throw attendanceError;

      const attendanceCounts = (attendanceRows ?? []).reduce<Record<string, number>>((counts, row) => {
        counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
        return counts;
      }, {});

      return events.map((event) => ({
        ...event,
        attendance_count: attendanceCounts[event.id] ?? 0,
      }));
    }, 'Failed to fetch events');
  }
}

export const eventsRepository = new EventsRepository();
