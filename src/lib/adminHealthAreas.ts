// The dashboard's site-health areas (Events, Houses, Gallery, ...) as plain data,
// built from the same counts the Overview already loads. Pure: the section that
// renders them adds no requests, and each rule here can be pinned by a unit test.
import { formatAcademicYear } from './academicTerms';
import { warnsWhenNoUpcomingEvents } from './adminAttention';
import { OverviewStats } from './adminOverviewStats';

export type HealthStatus = 'good' | 'warning' | 'error' | 'neutral';

export interface HealthLine {
  label: string;
  value: string | number;
  status: HealthStatus;
}

export interface HealthArea {
  key: string;
  title: string;
  /** The admin tool that resolves this area's issues, when there is one. */
  to?: string;
  lines: HealthLine[];
  /** Lines that are warnings or errors. */
  issues: number;
  /** Worst status across the lines; `good` when nothing needs a look. */
  status: 'good' | 'warning' | 'error';
}

const dateOrNever = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'Never');

function area(key: string, title: string, to: string | undefined, lines: HealthLine[]): HealthArea {
  const issues = lines.filter((line) => line.status === 'warning' || line.status === 'error').length;
  const status = lines.some((line) => line.status === 'error') ? 'error' : issues > 0 ? 'warning' : 'good';
  return { key, title, to, lines, issues, status };
}

export function buildHealthAreas(stats: OverviewStats, now: Date = new Date()): HealthArea[] {
  const warn = (count: number): HealthStatus => (count > 0 ? 'warning' : 'good');
  return [
    area('events', 'Events', '/admin/events', [
      { label: 'Published events', value: stats.eventsPublished, status: 'good' },
      { label: 'Draft events', value: stats.eventsDraft, status: stats.eventsDraft > 0 ? 'warning' : 'neutral' },
      {
        label: 'Upcoming published',
        value: stats.eventsUpcomingPublished,
        status: stats.eventsUpcomingPublished > 0 ? 'good' : warnsWhenNoUpcomingEvents(now) ? 'warning' : 'neutral',
      },
      { label: 'Missing image', value: stats.eventsMissingImage, status: warn(stats.eventsMissingImage) },
      { label: 'Missing location', value: stats.eventsMissingLocation, status: warn(stats.eventsMissingLocation) },
    ]),
    area('houses', 'Houses', '/admin/houses', [
      {
        label: stats.activeTermUnavailable
          ? 'Current House profiles (active term could not be loaded)'
          : `Current House profiles (${stats.housesCurrentYearStart ? formatAcademicYear(stats.housesCurrentYearStart) : 'active year'})`,
        value: stats.activeTermUnavailable ? '—' : stats.housesCurrentCount,
        status: stats.activeTermUnavailable || stats.housesCurrentCount === 0 ? 'warning' : 'good',
      },
      { label: 'Missing House images', value: stats.housesMissingImage, status: warn(stats.housesMissingImage) },
      { label: 'Missing House parents', value: stats.housesMissingParents, status: warn(stats.housesMissingParents) },
    ]),
    area('gallery', 'Gallery', '/admin/gallery', [
      { label: 'Total albums', value: stats.galleryCount, status: 'neutral' },
      { label: 'Missing cover image', value: stats.galleryMissingCover, status: warn(stats.galleryMissingCover) },
      { label: 'Missing Photos URL', value: stats.galleryMissingPhotosUrl, status: warn(stats.galleryMissingPhotosUrl) },
    ]),
    area('cabinet', 'Cabinet', '/admin/cabinet', [
      { label: 'Active cabinet year', value: stats.cabinetActiveYear?.label || 'None', status: stats.cabinetActiveYear ? 'good' : 'error' },
      { label: 'Members in active year', value: stats.cabinetMembersActiveYear, status: stats.cabinetMembersActiveYear > 0 ? 'good' : 'warning' },
      { label: 'Members missing image', value: stats.cabinetMissingImage, status: warn(stats.cabinetMissingImage) },
      { label: 'Members missing role', value: stats.cabinetMissingRole, status: warn(stats.cabinetMissingRole) },
    ]),
    area('vcn', 'VCN', '/admin/vcn', [
      { label: 'Current published exists', value: stats.vcnCurrentPublishedExists ? 'Yes' : 'No', status: stats.vcnCurrentPublishedExists ? 'good' : 'warning' },
      { label: 'Archive count', value: stats.vcnArchiveCount, status: 'neutral' },
      { label: 'Missing cover media', value: stats.vcnMissingMedia, status: warn(stats.vcnMissingMedia) },
    ]),
    area('program-content', 'Program Content', '/admin/content', [
      { label: 'Missing / inactive content', value: stats.programContentMissing, status: warn(stats.programContentMissing) },
      { label: 'Get Involved, ACE, Intern, House, WNC', value: 'Monitored', status: 'neutral' },
    ]),
    area(
      'ask-vsa',
      'Ask VSA AI',
      stats.aiTableExists ? '/admin/ai-knowledge' : '/admin/resources',
      stats.aiTableExists
        ? [
            { label: 'Active snippets', value: stats.aiSnippetsActive, status: 'good' },
            { label: 'Inactive snippets', value: stats.aiSnippetsInactive, status: 'neutral' },
            { label: 'Latest verification', value: dateOrNever(stats.aiLastVerifiedAt), status: stats.aiLastVerifiedAt ? 'good' : 'warning' },
          ]
        : [{ label: 'AI Table exists', value: 'No', status: 'warning' }],
    ),
    area('applications', 'Applications', '/admin/applications', [
      { label: 'Total windows', value: stats.applicationsTotal, status: 'neutral' },
      { label: 'Currently open', value: stats.applicationsOpen, status: stats.applicationsOpen > 0 ? 'good' : 'neutral' },
      { label: 'Scheduled', value: stats.applicationsUpcoming, status: 'neutral' },
      { label: 'Closed', value: stats.applicationsClosed, status: 'neutral' },
    ]),
    area('storage', 'Storage / Egress', undefined, [
      { label: 'Supabase Storage URLs', value: stats.storageUrlsCount, status: stats.storageUrlsCount > 0 ? 'warning' : 'good' },
      { label: 'Images to migrate', value: 'View queries', status: 'neutral' },
    ]),
  ];
}

export interface HealthWarning {
  id: string;
  count: number;
  label: string;
  to: string;
  critical: boolean;
}

/** The three data-health warnings the Overview has always surfaced, with the pages that fix them. */
export function buildHealthWarnings(stats: OverviewStats): HealthWarning[] {
  const warnings: HealthWarning[] = [
    { id: 'events-missing-terms', count: stats.eventsMissingTerms, label: 'events missing terms', to: '/admin/events', critical: true },
    { id: 'events-need-info', count: stats.upcomingEventsMissingInfo, label: 'upcoming events need info', to: '/admin/events', critical: false },
    { id: 'albums-missing-covers', count: stats.galleryAlbumsMissingCover, label: 'albums missing covers', to: '/admin/gallery', critical: false },
  ];
  return warnings.filter((warning) => warning.count > 0);
}

export type OverallHealth =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'partial'; unavailable: string[]; issues: number }
  | { state: 'issues'; issues: number }
  | { state: 'clear' };

/**
 * One honest headline for the section. "Clear" is only ever returned when the
 * scan loaded in full and found nothing: a failed or partial load can never
 * read as all-clear.
 */
export function summarizeHealth(input: {
  loading: boolean;
  failed: boolean;
  unavailable: readonly string[];
  stats: OverviewStats | null;
  /** Operations preflight lines to review, or the state of that separate scan. */
  preflight: number | 'loading' | 'failed';
}): OverallHealth {
  if (input.failed) return { state: 'failed' };
  if (input.loading || !input.stats || input.preflight === 'loading') return { state: 'loading' };
  const preflightIssues = typeof input.preflight === 'number' ? input.preflight : 0;
  const issues =
    buildHealthWarnings(input.stats).length +
    buildHealthAreas(input.stats).reduce((sum, healthArea) => sum + healthArea.issues, 0) +
    preflightIssues;
  // Counts for a source that failed are placeholders, so a partial load always reads as partial.
  const unavailable = [...input.unavailable, ...(input.preflight === 'failed' ? ['operations status'] : [])];
  if (unavailable.length > 0) return { state: 'partial', unavailable, issues };
  return issues > 0 ? { state: 'issues', issues } : { state: 'clear' };
}
