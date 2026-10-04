import { getAcademicTermMeta, parseYearSlug } from './academicTerms';
import { formatYearSpan } from './operationalStatus';
import { getPublicDestination } from './publicDestinations';

// Breadcrumb trails for nested public routes. Labels for ordinary routes come
// from the public route metadata (lib/publicDestinations.ts), so a trail never
// names a page differently from the nav. Flat top-level pages and unknown
// paths get no trail at all -- a breadcrumb is only worth showing where the
// URL actually has a parent.
//
// House year routes are display-only here: the year in the URL is read with
// the same parseYearSlug the House pages use, and "archive" vs "current" is the
// same comparison those pages make (year before the current academic year).
// Nothing here fetches, or decides, who belongs to which House.

export interface Crumb {
  label: string;
  /** Absent on the last crumb: the current page is not a link. */
  to?: string;
  /** Marks a year crumb as the live year. Archive years are marked by the "Archive" crumb before them. */
  badge?: 'Current';
}

export interface BreadcrumbContext {
  /**
   * The academic year the House pages treat as current (the active term's
   * start year). The pages pass theirs so the trail can never disagree with the
   * page's own Archive/Current treatment; without it we fall back to the date.
   */
  currentYear?: number;
  /** The real display name of the House on a House detail page; falls back to the title-cased slug. */
  houseLabel?: string;
}

const HOME: Crumb = { label: 'Home', to: '/' };

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function withCurrentLast(crumbs: Crumb[]): Crumb[] {
  return crumbs.map((crumb, index) => (index === crumbs.length - 1 ? { ...crumb, to: undefined } : crumb));
}

function houseTrail(segments: string[], context: BreadcrumbContext): Crumb[] {
  const house = getPublicDestination('/house');
  if (!house) return [];
  const base: Crumb[] = [HOME, { label: house.crumb, to: '/house' }];
  const [, second, third, fourth, ...extra] = segments;
  if (extra.length > 0) return [];

  // /house/archive
  if (second === 'archive' && !third) {
    const archive = getPublicDestination('/house/archive');
    return archive ? withCurrentLast([...base, { label: archive.crumb, to: '/house/archive' }]) : [];
  }

  // /house/year/:year[/:house] and /house/archive/:year[/:house]
  if (second === 'year' || second === 'archive') {
    const startYear = parseYearSlug(third);
    // An unparseable year is the page's own "year not found" state; no trail to offer.
    if (startYear === null) return [];
    const currentYear = context.currentYear ?? getAcademicTermMeta(new Date())?.academicYearStart;
    const isArchive = currentYear !== undefined && startYear < currentYear;
    const isCurrent = currentYear !== undefined && startYear === currentYear;

    const crumbs = [...base];
    // The URL prefix proves nothing ("/house/archive/<this year>" is not an archive):
    // only the year decides, exactly as the House pages do.
    if (isArchive) crumbs.push({ label: 'Archive', to: '/house/archive' });
    crumbs.push({
      label: formatYearSpan(startYear),
      to: `/house/year/${startYear}-${startYear + 1}`,
      badge: isCurrent ? 'Current' : undefined,
    });
    if (fourth) crumbs.push({ label: context.houseLabel ?? titleCaseSlug(fourth) });
    return withCurrentLast(crumbs);
  }

  // /house/:houseSlug -- the current year's House page.
  if (second && !third) {
    return withCurrentLast([...base, { label: context.houseLabel ?? titleCaseSlug(second) }]);
  }
  return [];
}

/** The trail for `pathname`, or [] when the page is top-level, unknown, or has no meaningful parent. */
export function buildPublicBreadcrumbs(pathname: string, context: BreadcrumbContext = {}): Crumb[] {
  const segments = pathname.toLowerCase().split('/').filter(Boolean);
  if (segments.length < 2) return [];
  if (segments[0] === 'admin') return [];
  if (segments[0] === 'house') return houseTrail(segments, context);

  const crumbs: Crumb[] = [HOME];
  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    const destination = getPublicDestination(path);
    // Only describe paths the site really has; never invent a crumb for a guess.
    if (!destination) return [];
    crumbs.push({ label: destination.crumb, to: path });
  }
  return withCurrentLast(crumbs);
}
