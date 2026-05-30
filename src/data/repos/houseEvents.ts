import { supabase } from '../../lib/supabase';
import { HouseEvent } from '../../types';
import { withErrorHandling } from '../errors';

export type HouseEventFormData = Omit<HouseEvent, 'id' | 'created_at' | 'updated_at' | 'house' | 'houses'> & {
  house_ids?: string[];
};

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
  'houses:house_event_houses(house:house_page_assets(*))',
].join(',');

export class HouseEventsRepository {
  async getPublicUpcomingForHouse(houseProfileId: string, today: string, limit = 12): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      // Find event IDs associated with this house
      const { data: associations } = await supabase
        .from('house_event_houses')
        .select('house_event_id')
        .eq('house_page_asset_id', houseProfileId);

      const eventIds = (associations ?? []).map((a) => a.house_event_id);
      if (eventIds.length === 0) return [];

      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .in('id', eventIds)
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch upcoming house events');
  }

  async getPublicPastForHouse(houseProfileId: string, today: string, limit = 24): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      // Find event IDs associated with this house
      const { data: associations } = await supabase
        .from('house_event_houses')
        .select('house_event_id')
        .eq('house_page_asset_id', houseProfileId);

      const eventIds = (associations ?? []).map((a) => a.house_event_id);
      if (eventIds.length === 0) return [];

      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .in('id', eventIds)
        .eq('is_published', true)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch past house events');
  }

  async getPublicEventsForYear(academicYearStart: number, limit = 12): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .eq('academic_year_start', academicYearStart)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch house events for year');
  }

  async getPublicPastEventsForYear(today: string, academicYearStart: number, limit = 4): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .eq('academic_year_start', academicYearStart)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch past house events for year');
  }

  async getPublicUpcomingPreview(today: string, academicYearStart?: number | null, limit = 4): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (academicYearStart) {
        query = query.eq('academic_year_start', academicYearStart);
      }

      const { data, error } = await query;
      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch upcoming house event previews');
  }

  async getAdminEvents(academicYearStart: number | null): Promise<HouseEvent[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('house_events')
        .select(`
          *,
          houses:house_event_houses(house:house_page_assets(*))
        `)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (academicYearStart) query = query.eq('academic_year_start', academicYearStart);

      const { data, error } = await query;
      if (error) throw error;
      return this.mapRelations(data);
    }, 'Failed to fetch admin house events');
  }

  async createEvent(formData: HouseEventFormData): Promise<HouseEvent> {
    return withErrorHandling(async () => {
      const { house_ids, ...event } = formData;
      const { data, error } = await supabase
        .from('house_events')
        .insert(event)
        .select('*')
        .single();

      if (error) throw error;
      const newEvent = data as HouseEvent;

      if (house_ids && house_ids.length > 0) {
        const associations = house_ids.map((houseId) => ({
          house_event_id: newEvent.id,
          house_page_asset_id: houseId,
        }));
        const { error: assocError } = await supabase
          .from('house_event_houses')
          .insert(associations);
        if (assocError) throw assocError;
      }

      return newEvent;
    }, 'Failed to create house event');
  }

  async updateEvent(id: string, formData: Partial<HouseEventFormData>): Promise<HouseEvent> {
    return withErrorHandling(async () => {
      const { house_ids, ...event } = formData;
      const { data, error } = await supabase
        .from('house_events')
        .update(event)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      const updatedEvent = data as HouseEvent;

      if (house_ids !== undefined) {
        // Sync associations
        const { error: deleteError } = await supabase
          .from('house_event_houses')
          .delete()
          .eq('house_event_id', id);
        if (deleteError) throw deleteError;

        if (house_ids.length > 0) {
          const associations = house_ids.map((houseId) => ({
            house_event_id: id,
            house_page_asset_id: houseId,
          }));
          const { error: assocError } = await supabase
            .from('house_event_houses')
            .insert(associations);
          if (assocError) throw assocError;
        }
      }

      return updatedEvent;
    }, 'Failed to update house event');
  }

  async deleteEvent(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('house_events').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete house event');
  }

  private mapRelations(data: any[] | null): HouseEvent[] {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      houses: (item.houses || []).map((h: any) => h.house).filter(Boolean),
    }));
  }
}

export const houseEventsRepository = new HouseEventsRepository();
