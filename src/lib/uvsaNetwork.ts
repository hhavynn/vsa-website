import { ExternalEvent, UVSASchool, UVSASystemType } from "../types";
import { parseDateOnly } from "./dateOnly";
import { effectiveExternalStatus } from "./externalEventLinking";

export type SchoolFilter = "All" | UVSASystemType;

export const SCHOOL_FILTERS: SchoolFilter[] = ["All", "UC", "CSU", "Private"];

export function filterSchoolsBySystem(
  schools: UVSASchool[],
  filter: SchoolFilter,
) {
  return filter === "All"
    ? schools
    : schools.filter((school) => school.system_type === filter);
}

export function countSchoolsBySystem(
  schools: UVSASchool[],
): Record<SchoolFilter, number> {
  return {
    All: schools.length,
    UC: schools.filter((school) => school.system_type === "UC").length,
    CSU: schools.filter((school) => school.system_type === "CSU").length,
    Private: schools.filter((school) => school.system_type === "Private")
      .length,
  };
}

export const isHomeBaseSchool = (school: Pick<UVSASchool, "slug">) =>
  school.slug === "ucsd";

/**
 * The large spotlight is reserved for a genuinely upcoming featured event. An
 * archived event is never promoted as a fallback; nearest date wins.
 */
export function pickFeaturedUpcomingEvent(
  upcomingEvents: ExternalEvent[],
): ExternalEvent | undefined {
  return upcomingEvents
    .filter((event) => event.is_featured && event.status === "upcoming")
    .sort((a, b) => dateValue(a) - dateValue(b))[0];
}

/**
 * Nothing flips `upcoming` to `past` in the database, so a listing whose date
 * has gone by (typically a linked event nobody re-edited) moves to the archive
 * here instead of lingering in Upcoming Externals.
 */
export function splitLapsedUpcoming(
  events: ExternalEvent[],
  today: string,
): { upcoming: ExternalEvent[]; lapsed: ExternalEvent[] } {
  const upcoming: ExternalEvent[] = [];
  const lapsed: ExternalEvent[] = [];
  for (const event of events) {
    (effectiveExternalStatus(event, today) === "upcoming"
      ? upcoming
      : lapsed
    ).push(event);
  }
  return { upcoming, lapsed };
}

function dateValue(event: ExternalEvent) {
  const parsed = parseDateOnly(event.date);
  return parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
}

export interface ArchiveGroup {
  key: string;
  label: string;
  events: ExternalEvent[];
}

const UNDATED_KEY = "undated";

/** Academic year starts in August: Sep 2025 and Mar 2026 are both "2025–26". */
export function getAcademicYearStart(
  date: string | null | undefined,
): number | null {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;
  return parsed.getMonth() >= 7
    ? parsed.getFullYear()
    : parsed.getFullYear() - 1;
}

export function formatAcademicYear(startYear: number) {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}

const isHomeHosted = (event: ExternalEvent) =>
  event.uvsa_school?.slug === "ucsd";

/**
 * Newest academic year first; undated last. Within a year, UCSD-hosted events
 * lead (the page copy calls Wild N' Culture out as the home-hosted event), then
 * newest first.
 */
export function groupArchiveByAcademicYear(
  events: ExternalEvent[],
): ArchiveGroup[] {
  const groups = new Map<string, ArchiveGroup>();

  for (const event of events) {
    const startYear = getAcademicYearStart(event.date);
    const key = startYear === null ? UNDATED_KEY : String(startYear);
    const group = groups.get(key) ?? {
      key,
      label:
        startYear === null
          ? "Earlier highlights"
          : formatAcademicYear(startYear),
      events: [],
    };
    group.events.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: [...group.events].sort(
        (a, b) =>
          Number(isHomeHosted(b)) - Number(isHomeHosted(a)) ||
          dateValue(b) - dateValue(a),
      ),
    }))
    .sort((a, b) => {
      if (a.key === UNDATED_KEY) return 1;
      if (b.key === UNDATED_KEY) return -1;
      return Number(b.key) - Number(a.key);
    });
}
