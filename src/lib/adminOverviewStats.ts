// Admin Overview numbers, derived from a handful of narrow row reads.
//
// The page used to issue ~45 separate `select('*', { count: 'exact', head: true })`
// probes per load, most of them different filters over the same table (events
// alone was hit 12 times). These tables are tiny (tens to a few hundred rows),
// so one row read per table answers every one of those counts. Tables that are
// not tiny (members) stay a single exact-count request in the repository.
//
// Pure: no I/O, so every number on the dashboard can be pinned by a unit test.
import { AttentionSignals, EMPTY_ATTENTION_SIGNALS } from './adminAttention';
import { getApplicationStatus } from './applicationLinks';
import { ApplicationKey } from '../types';

export interface OverviewStats {
  members: number;
  events: number;
  upcomingEvents: number;
  cabinetMembers: number;
  galleryAlbums: number;
  academicTerms: number;
  cabinetYears: number;
  feedback: number;
  pendingFeedback: number;
  eventsMissingTerms: number;
  upcomingEventsMissingInfo: number;
  galleryAlbumsMissingCover: number;
  // New Health Checks
  eventsPublished: number;
  eventsDraft: number;
  eventsUpcomingPublished: number;
  eventsMissingImage: number;
  eventsMissingLocation: number;
  housesCurrentCount: number;
  housesCurrentYearStart: number | null;
  activeTermUnavailable: boolean;
  housesMissingImage: number;
  housesMissingParents: number;
  galleryCount: number;
  galleryMissingCover: number;
  galleryMissingPhotosUrl: number;
  cabinetActiveYear: { id: string; label: string } | null;
  cabinetMembersActiveYear: number;
  cabinetMissingImage: number;
  cabinetMissingRole: number;
  vcnCurrentPublishedExists: boolean;
  vcnArchiveCount: number;
  vcnMissingMedia: number;
  programContentMissing: number;
  aiTableExists: boolean;
  aiSnippetsActive: number;
  aiSnippetsInactive: number;
  aiLastVerifiedAt: string | null;
  storageUrlsCount: number;
  applicationsTotal: number;
  applicationsOpen: number;
  applicationsUpcoming: number;
  applicationsClosed: number;
}

export const DEFAULT_OVERVIEW_STATS: OverviewStats = {
  members: 0,
  events: 0,
  upcomingEvents: 0,
  cabinetMembers: 0,
  galleryAlbums: 0,
  academicTerms: 0,
  cabinetYears: 0,
  feedback: 0,
  pendingFeedback: 0,
  eventsMissingTerms: 0,
  upcomingEventsMissingInfo: 0,
  galleryAlbumsMissingCover: 0,
  eventsPublished: 0,
  eventsDraft: 0,
  eventsUpcomingPublished: 0,
  eventsMissingImage: 0,
  eventsMissingLocation: 0,
  housesCurrentCount: 0,
  housesCurrentYearStart: null,
  activeTermUnavailable: false,
  housesMissingImage: 0,
  housesMissingParents: 0,
  galleryCount: 0,
  galleryMissingCover: 0,
  galleryMissingPhotosUrl: 0,
  cabinetActiveYear: null,
  cabinetMembersActiveYear: 0,
  cabinetMissingImage: 0,
  cabinetMissingRole: 0,
  vcnCurrentPublishedExists: false,
  vcnArchiveCount: 0,
  vcnMissingMedia: 0,
  programContentMissing: 0,
  aiTableExists: false,
  aiSnippetsActive: 0,
  aiSnippetsInactive: 0,
  aiLastVerifiedAt: null,
  storageUrlsCount: 0,
  applicationsTotal: 0,
  applicationsOpen: 0,
  applicationsUpcoming: 0,
  applicationsClosed: 0,
};

export interface OverviewEventRow {
  date: string;
  is_published: boolean | null;
  image_url: string | null;
  location: string | null;
  check_in_form_url: string | null;
  academic_term_id: string | null;
}
export interface OverviewGalleryRow {
  cover_image_url: string | null;
  google_photos_url: string | null;
}
export interface OverviewCabinetRow {
  cabinet_year_id: string | null;
  image_url: string | null;
  role: string | null;
}
export interface OverviewHouseAssetRow {
  academic_year_start: number | null;
  image_url: string | null;
  house_parent_heading: string | null;
  house_parent_image_url: string | null;
}
export interface OverviewVcnRow {
  is_current: boolean | null;
  is_published: boolean | null;
  cover_image_url: string | null;
}
export interface OverviewProgramContentRow {
  is_published: boolean | null;
  status: string | null;
}
export interface OverviewFeedbackRow {
  status: string | null;
}
export interface OverviewCabinetYearRow {
  id: string;
  label: string;
  is_active: boolean | null;
}
export interface OverviewAiRow {
  is_public: boolean | null;
  is_active: boolean | null;
  last_verified_at: string | null;
}
export interface OverviewApplicationRow {
  application_key: ApplicationKey;
  /** Read only so the attention queue can apply the same window-state rule as /admin/applications; never displayed. */
  target_url: string;
  open_at: string;
  due_at: string;
  is_enabled: boolean;
}
export interface OverviewImageRow {
  image_url?: string | null;
  logo_url?: string | null;
}

/** What the repository read. A `null` source failed to load (and is reported, never silently zeroed). */
export interface OverviewSources {
  members: number | null;
  events: OverviewEventRow[] | null;
  gallery: OverviewGalleryRow[] | null;
  cabinetMembers: OverviewCabinetRow[] | null;
  cabinetYears: OverviewCabinetYearRow[] | null;
  houseAssets: OverviewHouseAssetRow[] | null;
  houseEventImages: OverviewImageRow[] | null;
  siteSettings: OverviewImageRow[] | null;
  vcn: OverviewVcnRow[] | null;
  programContent: OverviewProgramContentRow[] | null;
  feedback: OverviewFeedbackRow[] | null;
  academicTermCount: number | null;
  /** Head counts for the attention queue; `null` = that count failed. */
  photoRequestsPending: number | null;
  dataRightsOpen: number | null;
  aiFeedbackUnresolved: number | null;
  /** `loaded: false` = the lookup failed; `academicYearStart: null` with `loaded: true` = no active term. */
  activeTerm: { loaded: boolean; academicYearStart: number | null };
  /** `null` = the table is missing / unreadable (pre-migration). */
  ai: OverviewAiRow[] | null;
  applications: OverviewApplicationRow[] | null;
}

export interface OverviewSnapshot {
  stats: OverviewStats;
  /** Count-only signals for the "what needs attention" queue. */
  attention: AttentionSignals;
  /** Labels of sources that failed, so the page can say its numbers may be incomplete. */
  unavailable: string[];
}

const STORAGE_URL_MARKER = 'supabase.co/storage';
const DAY_MS = 24 * 60 * 60 * 1000;

const isNull = (value: string | null | undefined) => value === null || value === undefined;
const isNullOrEmpty = (value: string | null | undefined) => isNull(value) || value === '';
const hasStorageUrl = (value: string | null | undefined) => !!value && value.toLowerCase().indexOf(STORAGE_URL_MARKER) !== -1;

/**
 * `fallbackYearStart` is the browser-derived academic year, used only when the
 * active term lookup succeeded but found no active term (matches the old page).
 */
export function buildOverviewSnapshot(sources: OverviewSources, now: Date, fallbackYearStart: number | null): OverviewSnapshot {
  const stats: OverviewStats = { ...DEFAULT_OVERVIEW_STATS };
  const unavailable: string[] = [];
  // One-day grace so an event happening today still counts as upcoming.
  const sinceMs = now.getTime() - DAY_MS;
  // Compare instants, not strings: PostgREST may return `+00:00` where we'd write `Z`.
  const isUpcoming = (date: string) => {
    const at = Date.parse(date);
    return !Number.isNaN(at) && at >= sinceMs;
  };

  if (sources.members === null) unavailable.push('members');
  else stats.members = sources.members;

  const events = sources.events;
  if (!events) unavailable.push('events');
  else {
    stats.events = events.length;
    stats.upcomingEvents = events.filter((e) => isUpcoming(e.date)).length;
    stats.eventsMissingTerms = events.filter((e) => isNull(e.academic_term_id)).length;
    // Same predicate the page always used: empty-string location / check-in URL, or no image.
    stats.upcomingEventsMissingInfo = events.filter(
      (e) => isUpcoming(e.date) && (e.location === '' || e.check_in_form_url === '' || isNull(e.image_url)),
    ).length;
    stats.eventsPublished = events.filter((e) => e.is_published === true).length;
    stats.eventsDraft = events.filter((e) => e.is_published === false).length;
    stats.eventsUpcomingPublished = events.filter((e) => e.is_published === true && isUpcoming(e.date)).length;
    stats.eventsMissingImage = events.filter((e) => isNull(e.image_url)).length;
    stats.eventsMissingLocation = events.filter((e) => isNullOrEmpty(e.location)).length;
  }

  const gallery = sources.gallery;
  if (!gallery) unavailable.push('gallery');
  else {
    stats.galleryAlbums = gallery.length;
    stats.galleryCount = gallery.length;
    stats.galleryAlbumsMissingCover = gallery.filter((g) => isNull(g.cover_image_url)).length;
    stats.galleryMissingCover = stats.galleryAlbumsMissingCover;
    stats.galleryMissingPhotosUrl = gallery.filter((g) => isNullOrEmpty(g.google_photos_url)).length;
  }

  if (!sources.cabinetYears) unavailable.push('cabinet years');
  else {
    stats.cabinetYears = sources.cabinetYears.length;
    const active = sources.cabinetYears.find((year) => year.is_active) ?? null;
    stats.cabinetActiveYear = active ? { id: active.id, label: active.label } : null;
  }

  const cabinet = sources.cabinetMembers;
  if (!cabinet) unavailable.push('cabinet');
  else {
    stats.cabinetMembers = cabinet.length;
    stats.cabinetMissingImage = cabinet.filter((c) => isNull(c.image_url)).length;
    stats.cabinetMissingRole = cabinet.filter((c) => isNullOrEmpty(c.role)).length;
    if (stats.cabinetActiveYear) {
      const activeId = stats.cabinetActiveYear.id;
      stats.cabinetMembersActiveYear = cabinet.filter((c) => c.cabinet_year_id === activeId).length;
    }
  }

  if (sources.academicTermCount === null) unavailable.push('academic terms');
  else stats.academicTerms = sources.academicTermCount;

  if (!sources.feedback) unavailable.push('feedback');
  else {
    stats.feedback = sources.feedback.length;
    stats.pendingFeedback = sources.feedback.filter((f) => f.status === 'pending' || f.status === 'in_progress').length;
  }


  // A failed lookup must not silently fall back to the browser-derived year:
  // the House count would look plausible but could be for the wrong year.
  stats.activeTermUnavailable = !sources.activeTerm.loaded;
  stats.housesCurrentYearStart = !sources.activeTerm.loaded ? null : sources.activeTerm.academicYearStart ?? fallbackYearStart;
  const houses = sources.houseAssets;
  if (!houses) unavailable.push('houses');
  else {
    stats.housesCurrentCount = houses.filter((h) => h.academic_year_start === (stats.housesCurrentYearStart ?? -1)).length;
    stats.housesMissingImage = houses.filter((h) => isNull(h.image_url)).length;
    stats.housesMissingParents = houses.filter((h) => isNull(h.house_parent_heading) || isNull(h.house_parent_image_url)).length;
  }

  if (!sources.vcn) unavailable.push('VCN');
  else {
    stats.vcnCurrentPublishedExists = sources.vcn.some((v) => v.is_current === true && v.is_published === true);
    stats.vcnArchiveCount = sources.vcn.length;
    stats.vcnMissingMedia = sources.vcn.filter((v) => isNull(v.cover_image_url)).length;
  }

  if (!sources.programContent) unavailable.push('program content');
  else {
    stats.programContentMissing = sources.programContent.filter((p) => p.is_published === false || p.status === 'hidden').length;
  }

  // The AI table may not exist yet (pre-migration); that is a state, not a failure.
  stats.aiTableExists = sources.ai !== null;
  if (sources.ai) {
    const publicRows = sources.ai.filter((row) => row.is_public === true);
    stats.aiSnippetsActive = publicRows.filter((row) => row.is_active === true).length;
    stats.aiSnippetsInactive = publicRows.filter((row) => row.is_active === false).length;
    stats.aiLastVerifiedAt = publicRows.reduce<string | null>(
      (latest, row) => (row.last_verified_at && (!latest || row.last_verified_at > latest) ? row.last_verified_at : latest),
      null,
    );
  }

  // Legacy Storage URLs left to migrate, across every surface that can hold one.
  const storageSources: Array<[string, Array<string | null | undefined> | null]> = [
    ['events', events ? events.map((e) => e.image_url) : null],
    ['house events', sources.houseEventImages ? sources.houseEventImages.map((r) => r.image_url) : null],
    ['houses', houses ? houses.map((h) => h.image_url) : null],
    ['gallery', gallery ? gallery.map((g) => g.cover_image_url) : null],
    ['cabinet', cabinet ? cabinet.map((c) => c.image_url) : null],
    ['site settings', sources.siteSettings ? sources.siteSettings.map((r) => r.logo_url) : null],
  ];
  stats.storageUrlsCount = storageSources.reduce((sum, [label, urls]) => {
    if (!urls) {
      if (label === 'house events' || label === 'site settings') unavailable.push(label);
      return sum;
    }
    return sum + urls.filter(hasStorageUrl).length;
  }, 0);

  // Application windows (admin RLS allows direct select). Resilient if the
  // table does not exist yet (pre-migration), so a missing table is not "unavailable".
  if (sources.applications) {
    stats.applicationsTotal = sources.applications.length;
    sources.applications.forEach((row) => {
      const status = getApplicationStatus(row.open_at, row.due_at, row.is_enabled, now);
      if (status === 'open') stats.applicationsOpen += 1;
      else if (status === 'not_open') stats.applicationsUpcoming += 1;
      else if (status === 'closed') stats.applicationsClosed += 1;
    });
  }

  // The attention queue reuses rows already read above (events, feedback,
  // application windows) plus three head counts; it adds no table reads of its own.
  if (sources.photoRequestsPending === null) unavailable.push('photo requests');
  if (sources.dataRightsOpen === null) unavailable.push('data rights requests');
  if (sources.aiFeedbackUnresolved === null) unavailable.push('Ask VSA feedback');
  const attention: AttentionSignals = {
    ...EMPTY_ATTENTION_SIGNALS,
    applications: sources.applications,
    draftEventDates: events ? events.filter((e) => e.is_published === false).map((e) => e.date) : null,
    photoRequestsPending: sources.photoRequestsPending,
    dataRightsOpen: sources.dataRightsOpen,
    aiFeedbackUnresolved: sources.aiFeedbackUnresolved,
    feedbackPending: sources.feedback ? sources.feedback.filter((f) => f.status === 'pending').length : null,
  };

  return { stats, attention, unavailable };
}
