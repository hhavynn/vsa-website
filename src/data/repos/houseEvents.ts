import { supabase } from '../../lib/supabase';
import { HouseEvent } from '../../types';
import { withErrorHandling } from '../errors';

export type HouseEventFormData = Omit<HouseEvent, 'id' | 'created_at' | 'updated_at' | 'house'>;

const PUBLIC_FIELDS = [
  'id',
  'house_profile_id',
  'academic_year_start',
  'academic_year_end',
  'title',
  'slug',
  'description',
  'event_date',
  'start_time',
  'end_time',
  'location',
  'image_url',
  'image_thumbnail_url',
  'gallery_url',
  'recap_url',
  'rsvp_url',
  'google_calendar_enabled',
  'is_published',
  'created_at',
  'updated_at',
].join(',');

export class HouseEventsRepository {
  async getPublicUpcomingForHouse(houseProfileId: string, today: string, limit = 12): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('house_profile_id', houseProfileId)
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as HouseEvent[];
    }, 'Failed to fetch upcoming house events');
  }

  async getPublicPastForHouse(houseProfileId: string, today: string, limit = 24): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('house_profile_id', houseProfileId)
        .eq('is_published', true)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as HouseEvent[];
    }, 'Failed to fetch past house events');
  }

  async getPublicUpcomingPreview(today: string, limit = 4): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as HouseEvent[];
    }, 'Failed to fetch upcoming house event previews');
  }

  async getAdminEvents(academicYearStart: number | null): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('house_events')
        .select('*')
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (academicYearStart) query = query.eq('academic_year_start', academicYearStart);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as HouseEvent[];
    }, 'Failed to fetch admin house events');
  }

  async createEvent(event: HouseEventFormData): Promise<HouseEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .insert(event)
        .select('*')
        .single();

      if (error) throw error;
      return data as HouseEvent;
    }, 'Failed to create house event');
  }

  async updateEvent(id: string, event: Partial<HouseEventFormData>): Promise<HouseEvent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .update(event)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as HouseEvent;
    }, 'Failed to update house event');
  }

  async deleteEvent(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('house_events').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete house event');
  }
}

export const houseEventsRepository = new HouseEventsRepository();
