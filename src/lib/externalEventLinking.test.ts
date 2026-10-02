import { UVSA_SOCAL } from '../config/uvsaSocal';
import { makeEvent, makeSchool } from '../test-utils/uvsaFixtures';
import {
  buildExternalPreviewListing,
  buildHostOptions,
  deriveLinkedStatus,
  describeExternalHostLabel,
  detailsFromListing,
  effectiveExternalStatus,
  EMPTY_EXTERNAL_DETAILS,
  ExternalCommonFields,
  ExternalDetailsForm,
  hostColumns,
  planExternalSync,
  resolveExternalHost,
  UVSA_SOCAL_HOST_VALUE,
  validateExternalDetails,
} from './externalEventLinking';

const TODAY = '2026-10-01';

const uci = makeSchool({ id: 'uci-id', slug: 'uci', short_name: 'UCI', vsa_name: 'VSA UCI' });
const ucsd = makeSchool({ id: 'ucsd-id', slug: 'ucsd', short_name: 'UCSD', vsa_name: 'UCSD VSA' });
const retired = makeSchool({ id: 'old-id', slug: 'old', short_name: 'OLD', vsa_name: 'OLD VSA', is_active: false });
const schools = [ucsd, uci, retired];

const common: ExternalCommonFields = {
  title: 'UVSA SoCal Fall Social',
  date: '2026-10-24',
  academic_term_id: 'term-1',
  location: 'Irvine',
  description: 'A social.',
  points: 4,
};
const details = (over: Partial<ExternalDetailsForm> = {}): ExternalDetailsForm => ({
  ...EMPTY_EXTERNAL_DETAILS,
  host: uci.id,
  ...over,
});
const plan = (over: Partial<Parameters<typeof planExternalSync>[0]> = {}) =>
  planExternalSync({
    eventType: 'external_event',
    isPublished: true,
    details: details(),
    common,
    existing: null,
    today: TODAY,
    ...over,
  });

describe('host choice', () => {
  it('lists UVSA SoCal first, then only active schools, without inventing a school row', () => {
    const options = buildHostOptions(schools);
    expect(options.socal).toEqual({ value: UVSA_SOCAL_HOST_VALUE, label: 'UVSA SoCal' });
    expect(options.schools.map((o) => o.label)).toEqual(['UCSD — UCSD VSA', 'UCI — VSA UCI']);
    // UVSA SoCal is never one of the school options.
    expect(options.schools.map((o) => o.value)).not.toContain(UVSA_SOCAL_HOST_VALUE);
    expect(options.schools).toHaveLength(schools.filter((s) => s.is_active).length);
  });

  it('keeps a since-deactivated host selectable while an event still uses it', () => {
    const options = buildHostOptions(schools, retired.id);
    expect(options.schools.map((o) => o.label)).toContain('OLD — OLD VSA (inactive)');
  });

  it('clears the school for UVSA SoCal and sets it for a school', () => {
    expect(hostColumns(UVSA_SOCAL_HOST_VALUE)).toEqual({ host_type: 'uvsa_socal', uvsa_school_id: null });
    expect(hostColumns('uci-id')).toEqual({ host_type: 'school', uvsa_school_id: 'uci-id' });
  });

  it('round-trips a listing into the form', () => {
    expect(detailsFromListing(makeEvent({ host_type: 'uvsa_socal', uvsa_school_id: null })).host).toBe(UVSA_SOCAL_HOST_VALUE);
    expect(detailsFromListing(makeEvent({ uvsa_school_id: 'uci-id' })).host).toBe('uci-id');
    expect(detailsFromListing(null)).toEqual(EMPTY_EXTERNAL_DETAILS);
  });
});

describe('validateExternalDetails', () => {
  const options = buildHostOptions(schools);

  it('requires a host', () => {
    expect(validateExternalDetails(details({ host: '' }), options)).toMatch(/Host \/ Organizer/);
  });

  it('requires a real school when the host is not UVSA SoCal', () => {
    expect(validateExternalDetails(details({ host: 'ghost-id' }), options)).toMatch(/valid school/);
    expect(validateExternalDetails(details({ host: uci.id }), options)).toBeNull();
    expect(validateExternalDetails(details({ host: UVSA_SOCAL_HOST_VALUE }), options)).toBeNull();
  });

  it('rejects non-http(s) links but allows blanks', () => {
    expect(validateExternalDetails(details({ rsvp_url: 'javascript:alert(1)' }), options)).toMatch(/RSVP/);
    expect(validateExternalDetails(details({ ride_form_url: 'not a url' }), options)).toMatch(/Ride Form/);
    expect(validateExternalDetails(details({ instagram_url: 'https://instagram.com/p/1' }), options)).toBeNull();
  });
});

describe('deriveLinkedStatus', () => {
  const base = { isExternalType: true, isPublished: true, showOnNetwork: true, today: TODAY };

  it('maps a published future event to upcoming', () => {
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24' })).toBe('upcoming');
    expect(deriveLinkedStatus({ ...base, dateOnly: TODAY })).toBe('upcoming');
  });

  it('maps a published event whose date has passed to past', () => {
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-09-30' })).toBe('past');
  });

  it('hides drafts, unlisted events, and non-external types', () => {
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', isPublished: false })).toBe('draft');
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', showOnNetwork: false })).toBe('draft');
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', isExternalType: false })).toBe('draft');
  });

  it('does not overwrite canceled or historical on a routine edit', () => {
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', current: 'canceled' })).toBe('canceled');
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', current: 'historical' })).toBe('historical');
    // ...but a draft or past record moves with the event.
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', current: 'past' })).toBe('upcoming');
    expect(deriveLinkedStatus({ ...base, dateOnly: '2026-10-24', current: 'draft' })).toBe('upcoming');
  });
});

describe('effectiveExternalStatus', () => {
  it('shows an upcoming listing whose date passed as past', () => {
    expect(effectiveExternalStatus({ status: 'upcoming', date: '2026-09-01' }, TODAY)).toBe('past');
    expect(effectiveExternalStatus({ status: 'upcoming', date: '2026-10-24' }, TODAY)).toBe('upcoming');
    expect(effectiveExternalStatus({ status: 'upcoming', date: null }, TODAY)).toBe('upcoming');
    expect(effectiveExternalStatus({ status: 'historical', date: '2024-01-01' }, TODAY)).toBe('historical');
  });
});

describe('planExternalSync', () => {
  it('creates a listing payload that syncs common fields and keeps external fields separate', () => {
    const result = plan({ details: details({ rsvp_url: ' https://rsvp.example ', ride_info: 'Meet at Gilman' }) });
    expect(result.action).toBe('upsert');
    if (result.action !== 'upsert') return;
    expect(result.payload).toMatchObject({
      title: 'UVSA SoCal Fall Social',
      date: '2026-10-24',
      academic_term_id: 'term-1',
      location: 'Irvine',
      description: 'A social.',
      points: 4,
      host_type: 'school',
      uvsa_school_id: 'uci-id',
      rsvp_url: 'https://rsvp.example',
      ride_info: 'Meet at Gilman',
      ride_form_url: null,
      status: 'upcoming',
      show_on_network: true,
    });
    // Editorial fields are not part of the payload, so a save cannot clobber them.
    expect(result.payload).not.toHaveProperty('is_featured');
    expect(result.payload).not.toHaveProperty('recap');
    expect(result.payload).not.toHaveProperty('photo_album_url');
  });

  it('keeps uvsa_school_id null for a UVSA SoCal host', () => {
    const result = plan({ details: details({ host: UVSA_SOCAL_HOST_VALUE }) });
    expect(result).toMatchObject({ action: 'upsert', payload: { host_type: 'uvsa_socal', uvsa_school_id: null } });
  });

  it.each([
    ['UCI → UVSA SoCal', uci.id, UVSA_SOCAL_HOST_VALUE, { host_type: 'uvsa_socal', uvsa_school_id: null }],
    ['UVSA SoCal → SDSU', UVSA_SOCAL_HOST_VALUE, 'sdsu-id', { host_type: 'school', uvsa_school_id: 'sdsu-id' }],
    ['SDSU → UCSB', 'sdsu-id', 'ucsb-id', { host_type: 'school', uvsa_school_id: 'ucsb-id' }],
  ])('switches organizer %s cleanly', (_label, _from, to, expected) => {
    const result = plan({ details: details({ host: to }), existing: { status: 'upcoming' } });
    expect(result).toMatchObject({ action: 'upsert', payload: expected });
  });

  it('leaves the status of a canceled listing alone while syncing the rest', () => {
    expect(plan({ existing: { status: 'canceled' } })).toMatchObject({ payload: { status: 'canceled' } });
  });

  it('drafts the listing when the event is unpublished', () => {
    expect(plan({ isPublished: false })).toMatchObject({ payload: { status: 'draft' } });
  });

  it('hides a visible listing when the event stops being external, never deleting it', () => {
    expect(plan({ eventType: 'gbm', existing: { status: 'upcoming' } })).toEqual({ action: 'hide' });
  });

  it('does nothing for a normal event with no listing, or one already hidden', () => {
    expect(plan({ eventType: 'gbm', existing: null })).toEqual({ action: 'none' });
    expect(plan({ eventType: 'gbm', existing: { status: 'draft' } })).toEqual({ action: 'none' });
  });

  it('revives the same record when the event becomes external again', () => {
    expect(plan({ existing: { status: 'draft' } })).toMatchObject({ action: 'upsert', payload: { status: 'upcoming' } });
  });
});

describe('resolveExternalHost', () => {
  it('uses the school logo source and inherits its links', () => {
    const host = resolveExternalHost(makeEvent({ uvsa_school: makeSchool({ ...uci, linktree_url: 'https://linktr.ee/uci', website_url: 'https://uci.example' }) }));
    expect(host).toMatchObject({
      kind: 'school',
      name: 'VSA UCI',
      shortName: 'UCI',
      linktreeUrl: 'https://linktr.ee/uci',
      websiteUrl: 'https://uci.example',
    });
    expect(host.school?.id).toBe('uci-id');
  });

  it('presents UVSA SoCal with its configured identity and no school', () => {
    const host = resolveExternalHost(makeEvent({ host_type: 'uvsa_socal', uvsa_school_id: null, uvsa_school: undefined }));
    expect(host).toMatchObject({
      kind: 'uvsa_socal',
      name: 'UVSA Southern California',
      shortName: 'UVSA SoCal',
      school: null,
      instagramUrl: UVSA_SOCAL.instagramUrl,
    });
  });

  it('flags a school host that lost its school', () => {
    expect(resolveExternalHost(makeEvent({ uvsa_school: undefined, uvsa_school_id: null })).kind).toBe('missing');
  });
});

describe('describeExternalHostLabel', () => {
  it('labels school, UVSA SoCal, and missing hosts for the admin list', () => {
    expect(describeExternalHostLabel(makeEvent())).toEqual({ text: 'External · UCI', missing: false });
    expect(describeExternalHostLabel(makeEvent({ host_type: 'uvsa_socal', uvsa_school: undefined }))).toEqual({ text: 'External · UVSA SoCal', missing: false });
    expect(describeExternalHostLabel(makeEvent({ uvsa_school: undefined })).text).toBe('⚠ Host missing');
    expect(describeExternalHostLabel(null).missing).toBe(true);
  });
});

describe('buildExternalPreviewListing', () => {
  const event = { id: 'e1', name: 'Fall Social', description: 'd', location: 'l', points: 3, is_published: true, event_type: 'external_event' as const };

  it('builds the listing the form would save without touching its inputs', () => {
    const input = details({ host: UVSA_SOCAL_HOST_VALUE, rsvp_url: 'https://rsvp.example' });
    const frozen = Object.freeze({ ...input });
    const listing = buildExternalPreviewListing({ event, dateOnly: '2026-10-24', details: frozen, schools, existing: null, today: TODAY });
    expect(listing).toMatchObject({
      host_type: 'uvsa_socal',
      uvsa_school_id: null,
      title: 'Fall Social',
      rsvp_url: 'https://rsvp.example',
      status: 'upcoming',
    });
  });

  it('resolves the chosen school for logo and links', () => {
    const listing = buildExternalPreviewListing({ event, dateOnly: '2026-10-24', details: details({ host: uci.id }), schools, existing: null, today: TODAY });
    expect(listing?.uvsa_school?.short_name).toBe('UCI');
  });

  it('returns nothing for normal events or before a host is chosen', () => {
    expect(buildExternalPreviewListing({ event: { ...event, event_type: 'gbm' }, dateOnly: '2026-10-24', details: details(), schools, existing: null, today: TODAY })).toBeNull();
    expect(buildExternalPreviewListing({ event, dateOnly: '2026-10-24', details: details({ host: '' }), schools, existing: null, today: TODAY })).toBeNull();
  });
});
