import { Event } from '../types';

// Define event type labels
export const EVENT_TYPE_LABELS: Record<Event['event_type'], string> = {
  other: 'General Events',
  gbm: 'General Body Meeting',
  mixer: 'Mixer',
  winter_retreat: 'Winter Retreat',
  vcn: 'VCN',
  wildn_culture: 'Wild n\' Culture',
  external_event: 'External Event'
};
