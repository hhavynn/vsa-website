import { UVSA_SOCAL } from '../config/uvsaSocal';
import { Event, ExternalEvent, ExternalEventStatus, ExternalHostType, UVSASchool } from '../types';

/**
 * Admin -> Events owns the external workflow: an `external_event` Event keeps
 * exactly one `external_events` row (matched on `source_event_id`) in step with
 * it. Everything here is pure so the rules are testable without a database.
 */

/** The Host / Organizer select value for UVSA SoCal; any other value is a school id. */
export const UVSA_SOCAL_HOST_VALUE = 'uvsa_socal';

export const isExternalEventType = (eventType: Event['event_type'] | undefined) =>
  eventType === 'external_event';

export interface ExternalDetailsForm {
  /** '' (unchosen), UVSA_SOCAL_HOST_VALUE, or a uvsa_schools id. */
  host: string;
  rsvp_url: string;
  host_info_url: string;
  instagram_url: string;
  ride_form_url: string;
  ride_info: string;
  show_on_network: boolean;
}

export const EMPTY_EXTERNAL_DETAILS: ExternalDetailsForm = {
  host: '',
  rsvp_url: '',
  host_info_url: '',
  instagram_url: '',
  ride_form_url: '',
  ride_info: '',
  show_on_network: true,
};

export function detailsFromListing(
  listing: ExternalEvent | null | undefined,
): ExternalDetailsForm {
  if (!listing) return EMPTY_EXTERNAL_DETAILS;
  return {
    host: listing.host_type === 'uvsa_socal' ? UVSA_SOCAL_HOST_VALUE : (listing.uvsa_school_id ?? ''),
    rsvp_url: listing.rsvp_url ?? '',
    host_info_url: listing.host_info_url ?? '',
    instagram_url: listing.instagram_url ?? '',
    ride_form_url: listing.ride_form_url ?? '',
    ride_info: listing.ride_info ?? '',
    show_on_network: listing.show_on_network ?? true,
  };
}

/** The two columns a host choice writes. UVSA SoCal always clears the school. */
export function hostColumns(host: string): {
  host_type: ExternalHostType;
  uvsa_school_id: string | null;
} {
  return host === UVSA_SOCAL_HOST_VALUE
    ? { host_type: 'uvsa_socal', uvsa_school_id: null }
    : { host_type: 'school', uvsa_school_id: host || null };
}

export interface HostOption {
  value: string;
  label: string;
}

/**
 * UVSA SoCal first, then the active schools in directory order. A school that
 * is no longer active stays selectable only while an existing event still uses
 * it, so editing that event does not silently drop its host.
 */
export function buildHostOptions(
  schools: UVSASchool[],
  currentHost?: string,
): { socal: HostOption; schools: HostOption[] } {
  const options = schools
    .filter((school) => school.is_active)
    .map((school) => ({
      value: school.id,
      label: `${school.short_name} — ${school.vsa_name || school.school_name}`,
    }));

  const current = currentHost && currentHost !== UVSA_SOCAL_HOST_VALUE ? currentHost : null;
  if (current && !options.some((option) => option.value === current)) {
    const inactive = schools.find((school) => school.id === current);
    if (inactive) {
      options.push({
        value: inactive.id,
        label: `${inactive.short_name} — ${inactive.vsa_name || inactive.school_name} (inactive)`,
      });
    }
  }

  return {
    socal: { value: UVSA_SOCAL_HOST_VALUE, label: UVSA_SOCAL.shortName },
    schools: options,
  };
}

const URL_FIELDS: Array<[keyof ExternalDetailsForm, string]> = [
  ['rsvp_url', 'RSVP / Tickets'],
  ['host_info_url', 'Event Info'],
  ['instagram_url', 'Instagram Post'],
  ['ride_form_url', 'UCSD Ride Form'],
];

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** First problem that blocks saving the external fields, or null. */
export function validateExternalDetails(
  details: ExternalDetailsForm,
  hostOptions: { socal: HostOption; schools: HostOption[] },
): string | null {
  if (!details.host) return 'Choose a Host / Organizer for this external event.';
  if (
    details.host !== UVSA_SOCAL_HOST_VALUE &&
    !hostOptions.schools.some((option) => option.value === details.host)
  ) {
    return 'Choose a valid school (or UVSA SoCal) as the Host / Organizer.';
  }
  for (const [key, label] of URL_FIELDS) {
    const value = String(details[key]).trim();
    if (value && !isHttpUrl(value)) return `${label} must be a full http(s) link.`;
  }
  return null;
}

/**
 * The status a linked listing should have. Draft hides it from /uvsa-network
 * (the public RLS policy filters drafts). Canceled and historical are
 * deliberate editorial states, so a routine edit never replaces them.
 */
export function deriveLinkedStatus({
  isExternalType,
  isPublished,
  showOnNetwork,
  dateOnly,
  today,
  current,
}: {
  isExternalType: boolean;
  isPublished: boolean;
  showOnNetwork: boolean;
  dateOnly: string;
  /** San Diego calendar day, YYYY-MM-DD. */
  today: string;
  current?: ExternalEventStatus | null;
}): ExternalEventStatus {
  if (!isExternalType) return 'draft';
  // Preserve editorial decisions made on the listing (e.g. marking it canceled
  // or archiving it as historical) across visibility changes or unpublishing.
  if (current === 'canceled' || current === 'historical') return current;
  if (!isPublished || !showOnNetwork) return 'draft';
  return dateOnly && dateOnly < today ? 'past' : 'upcoming';
}

/**
 * How a listing should be shown right now. Nothing flips `upcoming` to `past`
 * in the database, so a linked event that has since happened is shown as past
 * instead of lingering in Upcoming Externals.
 */
export function effectiveExternalStatus(
  event: Pick<ExternalEvent, 'status' | 'date'>,
  today: string,
): ExternalEventStatus {
  return event.status === 'upcoming' && event.date && event.date < today ? 'past' : event.status;
}

/** Common fields an Event pushes into its listing on every save. */
export interface ExternalCommonFields {
  title: string;
  /** San Diego calendar day, YYYY-MM-DD (external_events.date is a date). */
  date: string;
  academic_term_id: string | null;
  location: string | null;
  description: string | null;
  points: number;
}

export interface LinkedExternalPayload extends ExternalCommonFields {
  host_type: ExternalHostType;
  uvsa_school_id: string | null;
  rsvp_url: string | null;
  host_info_url: string | null;
  instagram_url: string | null;
  ride_form_url: string | null;
  ride_info: string | null;
  show_on_network: boolean;
  status: ExternalEventStatus;
}

export type ExternalSyncPlan =
  | { action: 'none' }
  /** Event is no longer an external: hide the listing, keep its record. */
  | { action: 'hide' }
  | { action: 'upsert'; payload: LinkedExternalPayload };

const orNull = (value: string) => value.trim() || null;

export function planExternalSync({
  eventType,
  isPublished,
  details,
  common,
  existing,
  today,
}: {
  eventType: Event['event_type'];
  isPublished: boolean;
  details: ExternalDetailsForm;
  common: ExternalCommonFields;
  existing: Pick<ExternalEvent, 'status'> | null;
  today: string;
}): ExternalSyncPlan {
  if (!isExternalEventType(eventType)) {
    return existing && existing.status !== 'draft' ? { action: 'hide' } : { action: 'none' };
  }

  return {
    action: 'upsert',
    payload: {
      ...common,
      ...hostColumns(details.host),
      rsvp_url: orNull(details.rsvp_url),
      host_info_url: orNull(details.host_info_url),
      instagram_url: orNull(details.instagram_url),
      ride_form_url: orNull(details.ride_form_url),
      ride_info: orNull(details.ride_info),
      show_on_network: details.show_on_network,
      status: deriveLinkedStatus({
        isExternalType: true,
        isPublished,
        showOnNetwork: details.show_on_network,
        dateOnly: common.date,
        today,
        current: existing?.status,
      }),
    },
  };
}

/**
 * Who hosts a listing, with the links a visitor can follow. School links are
 * inherited from `uvsa_schools` at read time and never copied onto the event.
 */
export interface ExternalHostIdentity {
  kind: 'school' | 'uvsa_socal' | 'missing';
  /** "UCI VSA" / "UVSA Southern California". */
  name: string;
  /** "UCI" / "UVSA SoCal". */
  shortName: string;
  /** The school whose logo and links apply; null for UVSA SoCal / missing. */
  school: UVSASchool | null;
  markLabel: string;
  instagramUrl: string | null;
  linktreeUrl: string | null;
  websiteUrl: string | null;
}

export function resolveExternalHost(
  listing: Pick<ExternalEvent, 'host_type' | 'uvsa_school'>,
): ExternalHostIdentity {
  if (listing.host_type === 'uvsa_socal') {
    return {
      kind: 'uvsa_socal',
      name: UVSA_SOCAL.name,
      shortName: UVSA_SOCAL.shortName,
      school: null,
      markLabel: UVSA_SOCAL.markLabel,
      instagramUrl: UVSA_SOCAL.instagramUrl,
      linktreeUrl: UVSA_SOCAL.linktreeUrl,
      websiteUrl: UVSA_SOCAL.websiteUrl,
    };
  }

  const school = listing.uvsa_school ?? null;
  if (!school) {
    return {
      kind: 'missing',
      name: 'SoCal VSA',
      shortName: 'SoCal VSA',
      school: null,
      markLabel: 'SoCal VSA',
      instagramUrl: null,
      linktreeUrl: null,
      websiteUrl: null,
    };
  }

  return {
    kind: 'school',
    name: school.vsa_name || school.short_name,
    shortName: school.short_name,
    school,
    markLabel: school.short_name,
    instagramUrl: school.instagram_url,
    linktreeUrl: school.linktree_url,
    websiteUrl: school.website_url,
  };
}

/**
 * The listing an unsaved admin form would produce, for Preview As Public.
 * Reads only its arguments; nothing is persisted.
 */
export function buildExternalPreviewListing({
  event,
  dateOnly,
  details,
  schools,
  existing,
  today,
}: {
  event: Pick<Event, 'id' | 'name' | 'description' | 'location' | 'points' | 'is_published' | 'event_type'>;
  dateOnly: string;
  details: ExternalDetailsForm;
  schools: UVSASchool[];
  existing: Pick<ExternalEvent, 'status'> | null;
  today: string;
}): ExternalEvent | null {
  if (!isExternalEventType(event.event_type) || !details.host) return null;
  const columns = hostColumns(details.host);
  const status = deriveLinkedStatus({
    isExternalType: true,
    isPublished: event.is_published,
    showOnNetwork: details.show_on_network,
    dateOnly,
    today,
    current: existing?.status,
  });

  return {
    id: 'draft-preview-listing',
    source_event_id: event.id,
    ...columns,
    title: event.name || 'Untitled event',
    event_type: null,
    date: dateOnly || null,
    academic_term_id: null,
    location: event.location || null,
    description: event.description || null,
    points: event.points,
    rsvp_url: orNull(details.rsvp_url),
    ride_form_url: orNull(details.ride_form_url),
    instagram_url: orNull(details.instagram_url),
    host_info_url: orNull(details.host_info_url),
    ride_info: orNull(details.ride_info),
    status,
    photo_album_url: null,
    recap: null,
    show_on_network: details.show_on_network,
    is_featured: false,
    created_at: '',
    updated_at: '',
    uvsa_school: columns.uvsa_school_id
      ? schools.find((school) => school.id === columns.uvsa_school_id)
      : undefined,
  };
}

/**
 * The "External · UCI" chip for Admin → Events. `missing` is true when a
 * school-hosted external has no school (or the event has no listing at all),
 * which the list flags as "Host missing".
 */
export function describeExternalHostLabel(
  listing: Pick<ExternalEvent, 'host_type' | 'uvsa_school'> | null | undefined,
): { text: string; missing: boolean } {
  if (!listing) return { text: '⚠ Host missing', missing: true };
  const host = resolveExternalHost(listing);
  if (host.kind === 'missing') return { text: '⚠ Host missing', missing: true };
  return { text: `External · ${host.shortName}`, missing: false };
}
