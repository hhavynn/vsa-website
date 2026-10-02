// Quick Search for the admin shell: what gets indexed, how a query is ranked,
// and where a result sends the admin. Pure. The index is built from rows the
// admin-only loader reads (data/repos/adminSearch.ts) after the palette opens;
// nothing here touches the network or any public surface.
//
// Records link by canonical id (a member's uuid, a node id), never by name
// alone, so two people called "Andy Nguyen" can never open each other's page.
import { ADMIN_NAV_GROUPS, adminNavLabelFor } from './adminNavigation';
import { formatYearSpan } from './operationalStatus';

export type SearchResultType = 'page' | 'member' | 'ace' | 'cabinet' | 'intern' | 'event' | 'house';

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  page: 'Admin page',
  member: 'Member',
  ace: 'ACE',
  cabinet: 'Cabinet',
  intern: 'Intern',
  event: 'Event',
  house: 'House',
};

/** The admin surface a record opens, shown as "→ Members". */
const DESTINATION_LABEL: Record<Exclude<SearchResultType, 'page'>, string> = {
  member: 'Members',
  ace: 'ACE',
  cabinet: 'Cabinet',
  intern: 'Interns',
  event: 'Events',
  house: 'Houses',
};

/** Higher wins a tie, so a person outranks a page with an equal match. */
const TYPE_PRIORITY: Record<SearchResultType, number> = {
  member: 7,
  ace: 6,
  cabinet: 5,
  intern: 4,
  house: 3,
  event: 2,
  page: 1,
};

export interface AdminSearchRecord {
  type: SearchResultType;
  /** Canonical id of the underlying record (or the path for a page). */
  id: string;
  title: string;
  /** "Sweatpants", "President · 2026–27", "Toad (draft)" */
  detail?: string;
  /** Admin route that opens it. */
  to: string;
  keywords?: readonly string[];
}

export interface AdminSearchResult extends AdminSearchRecord {
  key: string;
  /** "Member", "ACE · Sweatpants" */
  typeLine: string;
  /** "Members": the admin surface the result opens. */
  destination: string;
  score: number;
}

// ─── Record builders ─────────────────────────────────────────────────────────

export function pageRecords(): AdminSearchRecord[] {
  return ADMIN_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      type: 'page' as const,
      id: item.to,
      title: item.label,
      detail: group.group ?? undefined,
      to: item.to,
      keywords: item.keywords,
    })),
  );
}

const fullName = (first?: string | null, last?: string | null) => [first, last].filter((part) => part && part.trim()).join(' ').trim();

export function memberRecord(row: { id: string; first_name?: string | null; last_name?: string | null; house?: string | null }): AdminSearchRecord | null {
  const title = fullName(row.first_name, row.last_name);
  if (!title) return null;
  return { type: 'member', id: row.id, title, detail: row.house ? `House · ${row.house}` : undefined, to: `/admin/members?member=${encodeURIComponent(row.id)}` };
}

/** A member from the shared member directory (public_members projection: no email). */
export function memberOptionRecord(option: { id: string; fullName: string; college?: string | null; year?: string | null }): AdminSearchRecord | null {
  if (!option.fullName?.trim()) return null;
  const detail = [option.college, option.year].filter(Boolean).join(' · ');
  return {
    type: 'member',
    id: option.id,
    title: option.fullName.trim(),
    detail: detail || undefined,
    to: `/admin/members?member=${encodeURIComponent(option.id)}`,
  };
}

export function aceRecord(
  node: { id: string; name: string; role_label?: string | null; family_id: string; member_id?: string | null },
  family: { name: string; academic_year_start?: number | null } | undefined,
): AdminSearchRecord | null {
  if (!node.name?.trim()) return null;
  const params = new URLSearchParams({ family: node.family_id, node: node.id });
  const parts = [family?.name, node.role_label, typeof family?.academic_year_start === 'number' ? formatYearSpan(family.academic_year_start) : null];
  return {
    type: 'ace',
    id: node.id,
    title: node.name.trim(),
    detail: parts.filter(Boolean).join(' · ') || undefined,
    to: `/admin/ace?${params.toString()}`,
  };
}

export function cabinetRecord(
  row: { id: string; name: string | null; role: string; category?: string | null; cabinet_year_id?: string | null },
  yearLabel?: string | null,
): AdminSearchRecord | null {
  if (!row.name?.trim()) return null;
  const isIntern = row.category === 'Interns';
  return {
    type: isIntern ? 'intern' : 'cabinet',
    id: row.id,
    title: row.name.trim(),
    detail: [row.role, yearLabel].filter(Boolean).join(' · ') || undefined,
    to: `/admin/cabinet?member=${encodeURIComponent(row.id)}`,
  };
}

export function internDraftRecord(row: { id: string; name: string; cycle_id: string }, yearLabel?: string | null): AdminSearchRecord | null {
  if (!row.name?.trim()) return null;
  const params = new URLSearchParams({ cycle: row.cycle_id, row: row.id });
  return { type: 'intern', id: row.id, title: row.name.trim(), detail: ['Cohort draft', yearLabel].filter(Boolean).join(' · '), to: `/admin/interns?${params.toString()}` };
}

export function eventRecord(row: { id: string; name: string; date?: string | null; is_published?: boolean | null }): AdminSearchRecord | null {
  if (!row.name?.trim()) return null;
  const date = row.date ? new Date(row.date) : null;
  const when = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : null;
  return {
    type: 'event',
    id: row.id,
    title: row.name.trim(),
    detail: [when, row.is_published === false ? 'Draft' : null].filter(Boolean).join(' · ') || undefined,
    to: `/admin/events?event=${encodeURIComponent(row.id)}`,
  };
}

export function houseDraftRecord(
  row: { id: string; source_name: string; batch_id: string },
  context: { memberName?: string | null; houseLabel?: string | null; yearLabel?: string | null },
): AdminSearchRecord | null {
  const title = (context.memberName || row.source_name || '').trim();
  if (!title) return null;
  const params = new URLSearchParams({ batch: row.batch_id, row: row.id });
  return {
    type: 'house',
    id: row.id,
    title,
    detail: [context.houseLabel || 'Unassigned', context.yearLabel, 'draft'].filter(Boolean).join(' · '),
    to: `/admin/houses?${params.toString()}`,
  };
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreText(text: string, query: string, tokens: string[]): number {
  if (!text) return 0;
  if (text === query) return 100;
  if (text.startsWith(query)) return 80;
  const words = text.split(' ');
  if (words.some((word) => word.startsWith(query))) return 65;
  if (tokens.length > 1 && tokens.every((token) => words.some((word) => word.startsWith(token)))) return 60;
  if (text.includes(query)) return 40;
  return 0;
}

function toResult(record: AdminSearchRecord, score: number): AdminSearchResult {
  const base = SEARCH_TYPE_LABEL[record.type];
  return {
    ...record,
    key: `${record.type}:${record.id}`,
    typeLine: record.type === 'page' ? base : record.detail ? `${base} · ${record.detail}` : base,
    destination: record.type === 'page' ? adminNavLabelFor(record.to) ?? record.title : DESTINATION_LABEL[record.type],
    score,
  };
}

export const DEFAULT_RESULT_LIMIT = 12;

/**
 * Ranks records for a query. An empty query returns the admin pages so the
 * palette is useful before typing. Matching ignores case, accents, and
 * punctuation; every token must match somewhere.
 */
export function searchAdmin(
  records: readonly AdminSearchRecord[],
  rawQuery: string,
  limit = DEFAULT_RESULT_LIMIT,
): AdminSearchResult[] {
  const query = normalize(rawQuery);
  if (!query) {
    return records.filter((record) => record.type === 'page').slice(0, limit).map((record) => toResult(record, 0));
  }
  const tokens = query.split(' ');
  const scored: AdminSearchResult[] = [];
  for (const record of records) {
    const title = normalize(record.title);
    let score = scoreText(title, query, tokens);
    if (score === 0 && tokens.length > 1 && tokens.every((token) => title.includes(token))) score = 35;
    if (score === 0) {
      const secondary = [record.detail ?? '', ...(record.keywords ?? [])].map(normalize);
      const secondaryScore = Math.max(0, ...secondary.map((text) => scoreText(text, query, tokens)));
      score = secondaryScore > 0 ? Math.min(30, Math.round(secondaryScore / 3)) : 0;
    }
    if (score > 0) scored.push(toResult(record, score));
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        TYPE_PRIORITY[b.type] - TYPE_PRIORITY[a.type] ||
        a.title.localeCompare(b.title) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

/**
 * People who share a display name are shown separately (each keeps its own
 * canonical link). Surfaces that name-match, such as the palette header, can ask
 * which titles collide so the UI adds the disambiguating detail.
 */
export function collidingTitles(results: readonly AdminSearchResult[]): Set<string> {
  const seen = new Map<string, number>();
  for (const result of results) {
    const key = `${result.type}|${normalize(result.title)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set(Array.from(seen).filter(([, count]) => count > 1).map(([key]) => key.split('|')[1]));
}
