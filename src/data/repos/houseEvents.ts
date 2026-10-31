import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/database';
import type { HouseEvent, HousePageAsset, PublicHouseEvent, PublicHouseEventHost } from '../../types';
import { withErrorHandling } from '../errors';

export type HouseEventFormData = Omit<HouseEvent, 'id' | 'created_at' | 'updated_at' | 'house' | 'houses'> & {
  house_ids?: string[];
};

/** Admin lists read at most this many events per year (#636). */
export const ADMIN_HOUSE_EVENT_LIMIT = 500;

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
  // The host ids come from the join (public for published events); the
  // profile embed itself is admin-only, so public reads fill hosts from
  // published_house_page_assets (mapPublicRelations).
  // Public join IDs only. Resolve published House profiles in mapPublicRelations.
  'houses:house_event_houses(house_page_asset_id)',
].join(',');

/**
 * Public House-event host association lookup. Only published profile fields
 * required to label/route a published House event are requested.
 * Do NOT select '*' here: the underlying admin HousePageAsset table also has
 * internal_notes and source_doc_url. The published view is a second boundary,
 * not permission to expand network payloads as columns evolve.
 */
export const PUBLIC_HOUSE_EVENT_HOST_FIELDS = 'id,house,house_key,display_name,accent_color,is_active' as const;

type PublicHouseEventRow = Omit<PublicHouseEvent, 'house' | 'houses'> & {
  houses?: Array<{ house_page_asset_id: string }>;
};

export class HouseEventsRepository {
  async getPublicUpcomingForHouse(houseProfileId: string, today: string, limit = 12): Promise<PublicHouseEvent[]> {
    return withErrorHandling(async () => {
      // Find event IDs associated with this house via join table
      const { data: associations, error: associationError } = await supabase
        .from('house_event_houses')
        .select('house_event_id')
        .eq('house_page_asset_id', houseProfileId);

      if (associationError) throw associationError;
      const associatedEventIds = (associations ?? []).map((a) => a.house_event_id);

      let query = supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      // Filter by either direct house_profile_id OR join table associations
      if (associatedEventIds.length > 0) {
        query = query.or(`house_profile_id.eq.${houseProfileId},id.in.(${associatedEventIds.join(',')})`);
      } else {
        query = query.eq('house_profile_id', houseProfileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return this.mapPublicRelations(data);
    }, 'Failed to fetch upcoming house events');
  }

  /**
   * One published event of this House, by id: lets a calendar link land on an
   * event that is beyond the House page's bounded lists. Null when the event is
   * not published, does not exist, or is not hosted by this House.
   */
  async getPublicEventForHouse(eventId: string, houseProfileId: string): Promise<PublicHouseEvent | null> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [event] = await this.mapPublicRelations([data]);
      const hosted = event.house_profile_id === houseProfileId || (event.houses ?? []).some((house) => house.id === houseProfileId);
      return hosted ? event : null;
    }, 'Failed to fetch the linked house event');
  }

  async getPublicPastForHouse(houseProfileId: string, today: string, limit = 24): Promise<PublicHouseEvent[]> {
    return withErrorHandling(async () => {
      // Find event IDs associated with this house via join table
      const { data: associations, error: associationError } = await supabase
        .from('house_event_houses')
        .select('house_event_id')
        .eq('house_page_asset_id', houseProfileId);

      if (associationError) throw associationError;
      const associatedEventIds = (associations ?? []).map((a) => a.house_event_id);

      let query = supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      // Filter by either direct house_profile_id OR join table associations
      if (associatedEventIds.length > 0) {
        query = query.or(`house_profile_id.eq.${houseProfileId},id.in.(${associatedEventIds.join(',')})`);
      } else {
        query = query.eq('house_profile_id', houseProfileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return this.mapPublicRelations(data);
    }, 'Failed to fetch past house events');
  }

  async getPublicEventsForYear(academicYearStart: number, limit = 12): Promise<PublicHouseEvent[]> {
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
      return this.mapPublicRelations(data);
    }, 'Failed to fetch house events for year');
  }

  async getPublicPastEventsForYear(today: string, academicYearStart: number, limit = 4): Promise<PublicHouseEvent[]> {
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
      return this.mapPublicRelations(data);
    }, 'Failed to fetch past house events for year');
  }

  async getPublicUpcomingPreview(today: string, academicYearStart?: number | null, limit = 4): Promise<PublicHouseEvent[]> {
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
      return this.mapPublicRelations(data);
    }, 'Failed to fetch upcoming house event previews');
  }

  async getPublicEventsInRange(from: string, to: string, limit = 200): Promise<PublicHouseEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_events')
        .select(PUBLIC_FIELDS)
        .eq('is_published', true)
        .gte('event_date', from)
        .lte('event_date', to)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return this.mapPublicRelations(data);
    }, 'Failed to fetch house events for calendar');
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
        .order('start_time', { ascending: false })
        .limit(ADMIN_HOUSE_EVENT_LIMIT);

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

  /**
   * Creates or updates an event and its host Houses in one database
   * transaction (admin_save_house_event): everything changes or nothing does.
   * A create retried with the same requestId returns the same event; an update
   * is refused if the event changed after `expectedUpdatedAt`. Returns false
   * when the database does not have the function yet (migration 20261028080000),
   * so the caller can fall back to the previous two-step save.
   */
  async saveEventAtomic(input: {
    eventId: string | null;
    formData: Partial<HouseEventFormData>;
    requestId: string;
    expectedUpdatedAt: string | null;
  }): Promise<HouseEvent | false> {
    return withErrorHandling(async () => {
      const { house_ids, academic_year_end: _end, ...fields } = input.formData;
      const { data, error } = await supabase.rpc('admin_save_house_event', {
        p_event_id: input.eventId,
        p_event: fields as unknown as Json,
        p_host_ids: house_ids ?? [],
        p_request_id: input.eventId ? null : input.requestId,
        p_expected_updated_at: input.expectedUpdatedAt,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') return false;
        throw error;
      }
      return data as unknown as HouseEvent;
    }, 'Failed to save house event');
  }

  async deleteEvent(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('house_events').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete house event');
  }

  /**
   * Hosts for public reads: only published (active) House profiles, primary
   * host first. Profiles the embed could not return (anon cannot read
   * house_page_assets) are read from published_house_page_assets in one query.
   */
  private async mapPublicRelations(data: PublicHouseEventRow[] | null): Promise<PublicHouseEvent[]> {
    if (!data) return [];
    const hostIds = new Set<string>();
    for (const item of data) {
      for (const link of item.houses ?? []) {
        if (link.house_page_asset_id) hostIds.add(link.house_page_asset_id);
      }
    }
    const published = new Map<string, PublicHouseEventHost>();
    if (hostIds.size > 0) {
      const { data: assets, error } = await supabase
        .from('published_house_page_assets')
        .select(PUBLIC_HOUSE_EVENT_HOST_FIELDS)
        .in('id', Array.from(hostIds));
      if (error) throw error;
      for (const asset of (assets ?? []) as PublicHouseEventHost[]) {
        const { id, house, house_key, display_name, accent_color, is_active } = asset;
        published.set(id, { id, house, house_key, display_name, accent_color, is_active });
      }
    }
    return data.map((item) => {
      const hosts = (item.houses ?? [])
        .map((link) => published.get(link.house_page_asset_id))
        .filter((house): house is PublicHouseEventHost => !!house && house.is_active)
        .sort((a, b) => Number(b.id === item.house_profile_id) - Number(a.id === item.house_profile_id));
      return { ...item, houses: hosts };
    });
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
