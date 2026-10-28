// Read-only reconciliation of historical ACE pickup years against the live,
// published family tree (#670).
//
// The live tree is the authority for who someone is, which fam they are in and
// who their Big is: some relationships there were corrected directly with
// former members after the source spreadsheets were made. Historical sources
// are used for ONE thing only, the academic year a person was picked up. Nothing
// here proposes a change to a name, fam, parent, photo or canonical member link,
// and nothing here writes to the database.
//
// Evidence kinds, strongest first (issue #670's precedence policy):
//   official_pairing   a completed, official Big→Little pairing sheet for a term
//   repo_added_term    the `added_term` on a link in data/ace-families/*.json
//   master_year_cell   a name placed in a year row of a Master ACE workbook tab
//
// Precedence never silently wins: when two credible sources disagree on the
// year, or a source names a different Big than the live tree, the node is held
// as CONFLICTING_EVIDENCE with every candidate kept for a reviewer.
import { z } from 'zod';
import { foldName, personNameFromFull } from './personName';

// ── Terms and academic years ────────────────────────────────────────────────

export interface ParsedTerm {
  term: string;
  academicYearStart: number;
}

/**
 * FA21 → 2021–22; WI22 and SP22 → 2021–22. FA23 (2023–24) and SP23 (2022–23)
 * are different academic years even though they share a calendar year.
 */
export function parseTerm(raw: string | null | undefined): ParsedTerm | null {
  const match = /^\s*(FA|WI|SP)\s*'?(\d{2}|\d{4})\s*$/i.exec(raw ?? '');
  if (!match) return null;
  const season = match[1].toUpperCase();
  const digits = match[2];
  const calendarYear = digits.length === 4 ? Number(digits) : 2000 + Number(digits);
  const academicYearStart = season === 'FA' ? calendarYear : calendarYear - 1;
  return { term: `${season}${String(calendarYear % 100).padStart(2, '0')}`, academicYearStart };
}

/** "2021", "2021-22", "2021–22", "2021-2022" → 2021. Anything else → null. */
export function parseAcademicYear(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 1990 && raw <= 2100 ? raw : null;
  const match = /^\s*(\d{4})\s*(?:[-–—/]\s*(\d{2}|\d{4}))?\s*$/.exec(raw ?? '');
  if (!match) return null;
  const start = Number(match[1]);
  if (start < 1990 || start > 2100) return null;
  if (match[2]) {
    const end = match[2].length === 2 ? Math.floor(start / 100) * 100 + Number(match[2]) : Number(match[2]);
    if (end !== start + 1) return null;
  }
  return start;
}

export function academicYearLabel(start: number | null | undefined): string {
  if (start == null) return '';
  return `${start}–${String((start + 1) % 100).padStart(2, '0')}`;
}

// ── Names ───────────────────────────────────────────────────────────────────

export interface NameKeys {
  /** Folded full name without parenthetical nicknames. Equal exact keys = same written name. */
  exact: string;
  /** Looser spellings: middle initials dropped, a parenthetical nickname as the first name. */
  loose: string[];
}

export function nameKeys(raw: string | null | undefined): NameKeys {
  const text = raw ?? '';
  const withoutParens = text.replace(/\([^)]*\)/g, ' ');
  const exact = foldName(withoutParens);
  const loose = new Set<string>();
  const core = personNameFromFull(withoutParens).key;
  if (core && core !== exact) loose.add(core);
  const nickname = /\(([^)]+)\)/.exec(text);
  if (nickname) {
    const tokens = personNameFromFull(withoutParens).core;
    const nick = foldName(nickname[1]);
    if (tokens.length >= 2 && nick && !nick.includes(' ')) loose.add([nick, ...tokens.slice(1)].join(' '));
  }
  loose.delete(exact);
  return { exact, loose: Array.from(loose) };
}

// Header cells that leak into extracted rows ("LITTLE", "BIG") are not people.
const NOT_A_NAME = new Set(['little', 'big', 'name', 'little name', 'big name', 'littles', 'bigs', 'tbd', 'n a', 'na']);

export function isUsableName(raw: string | null | undefined): boolean {
  const exact = nameKeys(raw).exact;
  return exact.length > 0 && !NOT_A_NAME.has(exact);
}

function allKeys(keys: NameKeys): string[] {
  return keys.exact ? [keys.exact, ...keys.loose] : keys.loose;
}

// ── Fams ────────────────────────────────────────────────────────────────────

// Source fam labels → canonical fam keys. A canonical key matches a live fam
// whose slug, with any "dead-" graveyard prefix removed, is listed for it.
const FAM_LABELS: Record<string, string> = {
  underwater: 'underwater',
  under: 'underwater',
  down: 'down',
  nsf: 'nsf',
  'no sex': 'nsf',
  cross: 'cross',
  'bang mi': 'bang-mi',
  bangmi: 'bang-mi',
  gbm: 'bang-mi',
  moon: 'moon',
  aaf: 'aaf',
  'attractive af': 'aaf',
  'attractive af aaf': 'aaf',
  sunshine: 'sunshine',
  sun: 'sunshine',
  sweatpants: 'sweatpants',
  swp: 'sweatpants',
  royals: 'royals',
  'bad decisions': 'bad-decisions',
  'cup noodle': 'cup-noodle',
  'cute and cocky': 'cute-and-cocky',
  ho: 'ho',
  sloth: 'sloth',
  snacc: 'snacc',
  vwa: 'vwa',
};

const CANONICAL_SLUG_BASES: Record<string, string[]> = {
  aaf: ['aaf', 'attractive-af', 'attractive-af-aaf'],
};

// The AAF archive lineage is published under Moon when no AAF fam is live
// (the documented AAF/Moon split). Only then may an AAF-labelled source reach a
// Moon node; with a live AAF fam the two never mix.
const HISTORIC_FALLBACK: Record<string, string> = { aaf: 'moon' };

export function canonicalFamKey(label: string | null | undefined): string | null {
  const folded = foldName((label ?? '').replace(/\([^)]*\)/g, ' '))
    .replace(/\b(dead|fam|family)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!folded) return null;
  if (FAM_LABELS[folded]) return FAM_LABELS[folded];
  const hyphen = folded.replace(/ /g, '-');
  if (FAM_LABELS[hyphen]) return FAM_LABELS[hyphen];
  for (const [key, bases] of Object.entries(CANONICAL_SLUG_BASES)) if (bases.includes(hyphen)) return key;
  return hyphen;
}

function slugBase(slug: string): string {
  return slug.replace(/^dead-/, '');
}

function famMatchesKey(slug: string, key: string): boolean {
  const base = slugBase(slug);
  return base === key || (CANONICAL_SLUG_BASES[key] ?? []).includes(base);
}

export type FamResolution = { familyIds: string[]; via: 'direct' | 'historic_fallback' | 'unresolved' };

export function resolveFam(label: string | null | undefined, families: readonly LiveFamily[]): FamResolution {
  const key = canonicalFamKey(label);
  if (!key) return { familyIds: [], via: 'unresolved' };
  const direct = families.filter((f) => famMatchesKey(f.slug, key)).map((f) => f.id);
  if (direct.length > 0) return { familyIds: direct, via: 'direct' };
  const fallback = HISTORIC_FALLBACK[key];
  if (fallback) {
    const ids = families.filter((f) => famMatchesKey(f.slug, fallback)).map((f) => f.id);
    if (ids.length > 0) return { familyIds: ids, via: 'historic_fallback' };
  }
  return { familyIds: [], via: 'unresolved' };
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface LiveFamily {
  id: string;
  slug: string;
  name: string;
}

export interface LiveNode {
  id: string;
  family_id: string;
  name: string;
  parent_member_id: string | null;
  member_id: string | null;
  /** Present once #669's year columns exist; absent/undefined before. */
  pickup_term?: string | null;
  pickup_academic_year_start?: number | null;
}

export interface LiveSnapshot {
  families: LiveFamily[];
  nodes: LiveNode[];
}

const liveFamilySchema = z.object({ id: z.string().min(1), slug: z.string().min(1), name: z.string() });
const liveNodeSchema = z.object({
  id: z.string().min(1),
  family_id: z.string().min(1),
  name: z.string(),
  parent_member_id: z.string().nullable(),
  member_id: z.string().nullable().optional(),
  pickup_term: z.string().nullable().optional(),
  pickup_academic_year_start: z.number().int().nullable().optional(),
});

/** Validates a published-view snapshot. Throws with the first problem found. */
export function parseLiveSnapshot(families: unknown, nodes: unknown): LiveSnapshot {
  const fams = z.array(liveFamilySchema).safeParse(families);
  if (!fams.success) throw new Error(`Live families snapshot is malformed: ${fams.error.issues[0]?.message ?? 'invalid'}`);
  const rows = z.array(liveNodeSchema).safeParse(nodes);
  if (!rows.success) {
    const issue = rows.error.issues[0];
    throw new Error(`Live members snapshot is malformed at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? 'invalid'}`);
  }
  if (fams.data.length === 0 || rows.data.length === 0) throw new Error('Live snapshot is empty; refusing to reconcile against nothing.');
  const famIds = new Set<string>();
  for (const f of fams.data) {
    if (famIds.has(f.id)) throw new Error(`Live families snapshot repeats family id ${f.id}.`);
    famIds.add(f.id);
  }
  const nodeIds = new Set<string>();
  for (const n of rows.data) {
    if (nodeIds.has(n.id)) throw new Error(`Live members snapshot repeats node id ${n.id}.`);
    if (!famIds.has(n.family_id)) throw new Error(`Node ${n.id} belongs to family ${n.family_id}, which is not in the families snapshot.`);
    nodeIds.add(n.id);
  }
  return {
    families: fams.data,
    nodes: rows.data.map((n) => ({ ...n, member_id: n.member_id ?? null })),
  };
}

export type EvidenceKind = 'official_pairing' | 'repo_added_term' | 'master_year_cell';

export interface EvidenceSource {
  source_id: string;
  kind: EvidenceKind;
  label: string;
  term?: string | null;
  /** False when the source could not be read in full; its rows can never confirm a year. */
  extraction_complete: boolean;
  /**
   * False for a pairing list that looks complete but is not labelled official
   * or final. Its rows can never confirm a year. Defaults to true.
   */
  authoritative?: boolean;
  location?: string;
  notes?: string;
}

export interface EvidenceRecord {
  source_id: string;
  kind: EvidenceKind;
  little: string;
  big?: string | null;
  term?: string | null;
  academic_year_start?: number | null;
  fam_hint?: string | null;
  ref: string;
  variant?: string | null;
  id_hint?: string | null;
  confidence?: string | null;
}

export interface EvidenceBundle {
  sources: EvidenceSource[];
  records: EvidenceRecord[];
}

const evidenceKindSchema = z.enum(['official_pairing', 'repo_added_term', 'master_year_cell']);
const evidenceFileSchema = z.object({
  schema: z.literal('ace-pickup-evidence/v1'),
  sources: z.array(
    z.object({
      source_id: z.string().min(1),
      kind: evidenceKindSchema,
      label: z.string(),
      term: z.string().nullable().optional(),
      extraction_complete: z.boolean(),
      authoritative: z.boolean().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    }).passthrough()
  ),
  records: z.array(
    z.object({
      source_id: z.string().min(1),
      kind: evidenceKindSchema,
      little: z.string(),
      big: z.string().nullable().optional(),
      term: z.string().nullable().optional(),
      academic_year_start: z.number().int().nullable().optional(),
      fam_hint: z.string().nullable().optional(),
      ref: z.string(),
      variant: z.string().nullable().optional(),
      id_hint: z.string().nullable().optional(),
      confidence: z.string().nullable().optional(),
    })
  ),
});

/** Validates an `ace-pickup-evidence/v1` file. Every record must name a declared source of the same kind. */
export function parseEvidenceFile(input: unknown): EvidenceBundle {
  const parsed = evidenceFileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Evidence file is malformed at ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'invalid'}`);
  }
  const kinds = new Map<string, EvidenceKind>();
  for (const s of parsed.data.sources) {
    if (kinds.has(s.source_id)) throw new Error(`Evidence file declares source ${s.source_id} twice.`);
    kinds.set(s.source_id, s.kind);
  }
  parsed.data.records.forEach((r, i) => {
    const kind = kinds.get(r.source_id);
    if (!kind) throw new Error(`Evidence record ${i} names undeclared source ${r.source_id}.`);
    if (kind !== r.kind) throw new Error(`Evidence record ${i} is ${r.kind} but source ${r.source_id} is ${kind}.`);
  });
  return { sources: parsed.data.sources, records: parsed.data.records };
}

export function mergeEvidence(bundles: readonly EvidenceBundle[]): EvidenceBundle {
  const sources: EvidenceSource[] = [];
  const seen = new Set<string>();
  for (const b of bundles) {
    for (const s of b.sources) {
      if (seen.has(s.source_id)) throw new Error(`Two evidence files declare source ${s.source_id}.`);
      seen.add(s.source_id);
      sources.push(s);
    }
  }
  return { sources, records: bundles.flatMap((b) => b.records) };
}

// ── Matching ────────────────────────────────────────────────────────────────

export type IdentityMatch =
  /** Little and live Big both match by exact folded name. */
  | 'exact_pair'
  /** As exact_pair, but only once the source's fam label narrowed duplicate pairs. */
  | 'exact_pair_fam_narrowed'
  /** Little/Big match only via a looser spelling (initials, nickname). */
  | 'loose_pair'
  /** Name matches exactly one node in the fam; the source names no Big (Master cells). */
  | 'name_in_fam'
  | 'loose_name_in_fam'
  /** The Little matches, but the source names a different Big than the live tree. */
  | 'big_differs'
  /** More than one live node fits; never guessed. */
  | 'ambiguous';

export interface MatchedEvidence {
  record: EvidenceRecord;
  source: EvidenceSource;
  identity: IdentityMatch;
  academicYearStart: number | null;
  term: string | null;
  notes: string[];
}

interface IndexedNode {
  node: LiveNode;
  keys: NameKeys;
  parent: LiveNode | null;
  parentKeys: NameKeys | null;
}

interface TreeIndex {
  byId: Map<string, IndexedNode>;
  byExact: Map<string, IndexedNode[]>;
  byAnyKey: Map<string, IndexedNode[]>;
  families: LiveFamily[];
  familyById: Map<string, LiveFamily>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map.set(key, [value]);
}

function buildIndex(snapshot: LiveSnapshot): TreeIndex {
  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n] as const));
  const byId = new Map<string, IndexedNode>();
  const byExact = new Map<string, IndexedNode[]>();
  const byAnyKey = new Map<string, IndexedNode[]>();
  for (const node of snapshot.nodes) {
    const parent = node.parent_member_id ? nodeById.get(node.parent_member_id) ?? null : null;
    const entry: IndexedNode = { node, keys: nameKeys(node.name), parent, parentKeys: parent ? nameKeys(parent.name) : null };
    byId.set(node.id, entry);
    if (entry.keys.exact) push(byExact, entry.keys.exact, entry);
    for (const key of allKeys(entry.keys)) push(byAnyKey, key, entry);
  }
  return { byId, byExact, byAnyKey, families: snapshot.families, familyById: new Map(snapshot.families.map((f) => [f.id, f] as const)) };
}

function bigMatchesExact(entry: IndexedNode, big: NameKeys | null): boolean {
  if (!big || !big.exact) return entry.parent === null && entry.node.parent_member_id === null;
  return entry.parentKeys !== null && entry.parentKeys.exact === big.exact;
}

function bigMatchesLoose(entry: IndexedNode, big: NameKeys | null): boolean {
  if (!big || !big.exact) return entry.parent === null && entry.node.parent_member_id === null;
  if (!entry.parentKeys) return false;
  const parentKeys = allKeys(entry.parentKeys);
  return allKeys(big).some((k) => parentKeys.includes(k));
}

function looseCandidates(index: TreeIndex, keys: NameKeys): IndexedNode[] {
  const found: IndexedNode[] = [];
  for (const key of allKeys(keys)) for (const entry of index.byAnyKey.get(key) ?? []) if (!found.includes(entry)) found.push(entry);
  return found;
}

interface MatchOutcome {
  targets: IndexedNode[];
  identity: IdentityMatch;
  notes: string[];
}

function matchPairRecord(index: TreeIndex, record: EvidenceRecord, scope: 'global' | 'fam'): MatchOutcome | null {
  const little = nameKeys(record.little);
  const big = record.big && record.big.trim() ? nameKeys(record.big) : null;
  if (!little.exact) return null;
  const fam = resolveFam(record.fam_hint, index.families);
  const notes: string[] = [];
  if (fam.via === 'historic_fallback') notes.push('fam label resolved through the documented AAF→Moon archive split');
  const inFam = (e: IndexedNode) => fam.familyIds.includes(e.node.family_id);
  const scoped = (list: IndexedNode[]) => (scope === 'fam' ? list.filter(inFam) : list);

  const exactPairs = scoped(index.byExact.get(little.exact) ?? []).filter((e) => bigMatchesExact(e, big));
  if (exactPairs.length === 1) {
    if (scope === 'global' && fam.familyIds.length > 0 && !inFam(exactPairs[0])) notes.push('source fam label differs from the live fam (kept live)');
    return { targets: exactPairs, identity: 'exact_pair', notes };
  }
  if (exactPairs.length > 1) {
    const narrowed = scope === 'global' ? exactPairs.filter(inFam) : [];
    if (narrowed.length === 1) return { targets: narrowed, identity: 'exact_pair_fam_narrowed', notes };
    return { targets: exactPairs, identity: 'ambiguous', notes: [...notes, `${exactPairs.length} live nodes share this Little and Big name`] };
  }

  const loosePairs = scoped(looseCandidates(index, little)).filter((e) => bigMatchesLoose(e, big));
  if (loosePairs.length === 1) return { targets: loosePairs, identity: 'loose_pair', notes: [...notes, 'matched through a looser spelling'] };
  if (loosePairs.length > 1) return { targets: loosePairs, identity: 'ambiguous', notes: [...notes, `${loosePairs.length} live nodes fit a looser spelling`] };

  // Little found but under another Big. Never reparent: only report it.
  let sameName = index.byExact.get(little.exact) ?? [];
  if (fam.familyIds.length > 0 || scope === 'fam') sameName = sameName.filter(inFam);
  if (sameName.length === 1) return { targets: sameName, identity: 'big_differs', notes: [...notes, 'source Big differs from the live Big (kept live)'] };
  if (sameName.length > 1) return { targets: sameName, identity: 'ambiguous', notes: [...notes, `${sameName.length} same-name live nodes, none under the source Big`] };
  return null;
}

function matchNameInFam(index: TreeIndex, record: EvidenceRecord): MatchOutcome | null {
  const little = nameKeys(record.little);
  if (!little.exact) return null;
  const fam = resolveFam(record.fam_hint, index.families);
  if (fam.familyIds.length === 0) return null;
  const notes = fam.via === 'historic_fallback' ? ['fam label resolved through the documented AAF→Moon archive split'] : [];
  const inFam = (e: IndexedNode) => fam.familyIds.includes(e.node.family_id);
  const exact = (index.byExact.get(little.exact) ?? []).filter(inFam);
  if (exact.length === 1) return { targets: exact, identity: 'name_in_fam', notes };
  if (exact.length > 1) return { targets: exact, identity: 'ambiguous', notes: [...notes, `${exact.length} same-name nodes in this fam`] };
  const loose = looseCandidates(index, little).filter(inFam);
  if (loose.length === 1) return { targets: loose, identity: 'loose_name_in_fam', notes: [...notes, 'matched through a looser spelling'] };
  if (loose.length > 1) return { targets: loose, identity: 'ambiguous', notes: [...notes, `${loose.length} nodes fit a looser spelling`] };
  return null;
}

function recordYear(record: EvidenceRecord, source: EvidenceSource): { year: number | null; term: string | null; legacy: boolean } {
  const rawTerm = (record.term ?? source.term ?? '').trim();
  if (/^legacy$/i.test(rawTerm)) return { year: null, term: null, legacy: true };
  const parsed = parseTerm(rawTerm);
  if (parsed) return { year: parsed.academicYearStart, term: parsed.term, legacy: false };
  return { year: record.academic_year_start ?? null, term: null, legacy: false };
}

// ── Classification ──────────────────────────────────────────────────────────

export type ConfidenceClass = 'CONFIRMED_YEAR' | 'STRONG_CANDIDATE' | 'SUSPECTED_YEAR' | 'CONFLICTING_EVIDENCE' | 'UNKNOWN';

export const CONFIDENCE_CLASSES: ConfidenceClass[] = ['CONFIRMED_YEAR', 'STRONG_CANDIDATE', 'SUSPECTED_YEAR', 'CONFLICTING_EVIDENCE', 'UNKNOWN'];

export type IdentityStatus =
  | 'RESOLVED_BY_LIVE_PAIR'
  | 'RESOLVED_BY_NAME_IN_FAM'
  | 'SAME_NAME_IN_FAM'
  | 'AMBIGUOUS_SOURCE_MATCH'
  | 'SOURCE_BIG_DIFFERS'
  | 'NO_SOURCE_MATCH';

export type ReviewFlag =
  | 'SOURCE_YEARS_DISAGREE'
  | 'MASTER_DISAGREES'
  | 'MASTER_VARIANTS_DISAGREE'
  | 'SOURCE_BIG_DIFFERS'
  | 'AMBIGUOUS_IDENTITY'
  | 'SAME_NAME_IN_FAM'
  | 'FUTURE_OR_UNREVEALED_YEAR'
  | 'CHILD_EARLIER_THAN_BIG'
  | 'SAME_TERM_AS_BIG'
  | 'TERMS_DISAGREE_SAME_YEAR'
  | 'CANONICAL_MEMBER_ON_SEVERAL_NODES'
  | 'PARENT_NOT_IN_SNAPSHOT'
  | 'LEGACY_TERM_ONLY'
  | 'INCOMPLETE_SOURCE'
  | 'EXISTING_YEAR_DIFFERS'
  | 'MASTER_UNRELIABLE_IN_FAM'
  | 'UNLABELLED_PAIRING_SOURCE';

export interface NodeReconciliation {
  ace_node_id: string;
  fam_id: string;
  fam_slug: string;
  fam_name: string;
  member_name: string;
  current_big_node_id: string | null;
  current_big_name: string | null;
  canonical_member_id: string | null;
  existing_pickup_term: string | null;
  existing_pickup_academic_year_start: number | null;
  recommended_pickup_academic_year: number | null;
  recommended_pickup_term: string | null;
  confidence_class: ConfidenceClass;
  identity_resolution_status: IdentityStatus;
  flags: ReviewFlag[];
  review_reason: string;
  supporting: MatchedEvidence[];
  conflicting: MatchedEvidence[];
  /** Every year any matched source put forward, for the reviewer. */
  candidate_years: number[];
}

export interface UnmatchedEvidence {
  record: EvidenceRecord;
  reason: 'no_live_node' | 'unresolved_fam' | 'unusable_name';
}

export interface MasterCalibration {
  /** Nodes with one official/repo year that also have a usable Master cell. */
  compared: number;
  /** ...whose Master year equals that official/repo year. */
  agreed: number;
}

export interface ReconciliationResult {
  rows: NodeReconciliation[];
  /** Per family id: how often Master rows agree with stronger evidence. */
  masterCalibration: Record<string, MasterCalibration>;
  unmatched: UnmatchedEvidence[];
  sources: EvidenceSource[];
  maxAcademicYearStart: number;
}

export interface ReconcileOptions {
  /**
   * Latest academic year whose pickups are public. A candidate after this (for
   * example a 2026–27 Master row before that cycle's Reveal) is never proposed.
   */
  maxAcademicYearStart: number;
}

const OFFICIAL_IDENTITIES: IdentityMatch[] = ['exact_pair', 'exact_pair_fam_narrowed'];
const USABLE: IdentityMatch[] = ['exact_pair', 'exact_pair_fam_narrowed', 'loose_pair', 'name_in_fam', 'loose_name_in_fam'];

const FLAG_TEXT: Record<ReviewFlag, string> = {
  SOURCE_YEARS_DISAGREE: 'official/repo sources give different years',
  MASTER_DISAGREES: 'a Master workbook row gives a different year',
  MASTER_VARIANTS_DISAGREE: 'Master workbook variants place this person in different years',
  SOURCE_BIG_DIFFERS: 'a source names a different Big than the live tree (live kept)',
  AMBIGUOUS_IDENTITY: 'a source row fits more than one live node',
  SAME_NAME_IN_FAM: 'another node in this fam has the same name',
  FUTURE_OR_UNREVEALED_YEAR: 'a source year is after the latest revealed cycle',
  CHILD_EARLIER_THAN_BIG: "year is earlier than the live Big's year",
  SAME_TERM_AS_BIG: 'same pickup term as the live Big',
  TERMS_DISAGREE_SAME_YEAR: 'sources agree on the year but not the term; term left blank',
  CANONICAL_MEMBER_ON_SEVERAL_NODES: 'the linked canonical member appears on several nodes',
  PARENT_NOT_IN_SNAPSHOT: 'live parent is not in the published snapshot',
  LEGACY_TERM_ONLY: "only a 'legacy' term (pre-FA21 sheet), no year",
  INCOMPLETE_SOURCE: 'evidence comes from a source that was not read in full',
  EXISTING_YEAR_DIFFERS: 'the live node already has a different year',
  MASTER_UNRELIABLE_IN_FAM: "this fam's Master year rows mostly disagree with its official/repo years",
  UNLABELLED_PAIRING_SOURCE: 'pairing list is not labelled official/final',
};

function distinct<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isYear(value: number | null): value is number {
  return value !== null;
}

/**
 * One row per live published node. Source rows that reach no node are returned
 * separately so absence from the tree is visible, never silently dropped.
 */
export function reconcilePickupYears(snapshot: LiveSnapshot, evidence: EvidenceBundle, options: ReconcileOptions): ReconciliationResult {
  const index = buildIndex(snapshot);
  const sourceById = new Map(evidence.sources.map((s) => [s.source_id, s] as const));
  const matched = new Map<string, MatchedEvidence[]>();
  const unmatched: UnmatchedEvidence[] = [];

  for (const record of evidence.records) {
    const source = sourceById.get(record.source_id);
    if (!source) throw new Error(`Evidence record names undeclared source ${record.source_id}.`);
    if (!isUsableName(record.little)) {
      unmatched.push({ record, reason: 'unusable_name' });
      continue;
    }
    let outcome: MatchOutcome | null;
    if (record.kind === 'official_pairing') outcome = matchPairRecord(index, record, 'global');
    else if (record.kind === 'repo_added_term') {
      if (resolveFam(record.fam_hint, index.families).familyIds.length === 0) {
        unmatched.push({ record, reason: 'unresolved_fam' });
        continue;
      }
      outcome = matchPairRecord(index, record, 'fam');
    } else {
      if (resolveFam(record.fam_hint, index.families).familyIds.length === 0) {
        unmatched.push({ record, reason: 'unresolved_fam' });
        continue;
      }
      outcome = matchNameInFam(index, record);
    }
    if (!outcome) {
      unmatched.push({ record, reason: 'no_live_node' });
      continue;
    }
    const { year, term, legacy } = recordYear(record, source);
    const notes = [...outcome.notes];
    if (legacy) notes.push('legacy');
    for (const target of outcome.targets) {
      push(matched, target.node.id, { record, source, identity: outcome.identity, academicYearStart: year, term, notes });
    }
  }

  const sameNameCount = new Map<string, number>();
  for (const entry of Array.from(index.byId.values())) {
    const key = `${entry.node.family_id}|${entry.keys.exact}`;
    sameNameCount.set(key, (sameNameCount.get(key) ?? 0) + 1);
  }
  const memberNodeCount = new Map<string, number>();
  for (const node of snapshot.nodes) if (node.member_id) memberNodeCount.set(node.member_id, (memberNodeCount.get(node.member_id) ?? 0) + 1);

  const rows = snapshot.nodes.map((node) => {
    const entry = index.byId.get(node.id) as IndexedNode;
    const evidenceForNode = matched.get(node.id) ?? [];
    return classifyNode(entry, evidenceForNode, index, {
      sameName: (sameNameCount.get(`${node.family_id}|${entry.keys.exact}`) ?? 0) > 1,
      sharedMember: node.member_id ? (memberNodeCount.get(node.member_id) ?? 0) > 1 : false,
      maxYear: options.maxAcademicYearStart,
    });
  });

  const masterCalibration = calibrateMaster(rows, matched);
  for (const row of rows) {
    const cal = masterCalibration[row.fam_id];
    if (row.confidence_class === 'SUSPECTED_YEAR' && cal && cal.compared >= MIN_CALIBRATION && cal.agreed / cal.compared < 0.5) {
      row.flags.push('MASTER_UNRELIABLE_IN_FAM');
    }
  }
  applyChronologyChecks(rows);
  for (const row of rows) row.review_reason = describe(row);
  return { rows, masterCalibration, unmatched, sources: evidence.sources, maxAcademicYearStart: options.maxAcademicYearStart };
}

const MIN_CALIBRATION = 10;

// Master workbook rows sometimes carry generation numerals rather than pickup
// years. Where a fam has enough nodes dated by stronger evidence, measure how
// often its Master rows agree; this is reported, never used to shift a year.
function calibrateMaster(rows: NodeReconciliation[], matched: Map<string, MatchedEvidence[]>): Record<string, MasterCalibration> {
  const out: Record<string, MasterCalibration> = {};
  for (const row of rows) {
    const evidence = matched.get(row.ace_node_id) ?? [];
    const strongYears = distinct(
      evidence
        .filter((e) => e.source.kind !== 'master_year_cell' && USABLE.includes(e.identity) && e.academicYearStart !== null)
        .map((e) => e.academicYearStart as number)
    );
    if (strongYears.length !== 1) continue;
    const masterYears = distinct(
      evidence.filter((e) => e.source.kind === 'master_year_cell' && USABLE.includes(e.identity) && e.academicYearStart !== null).map((e) => e.academicYearStart as number)
    );
    if (masterYears.length === 0) continue;
    const cal = out[row.fam_id] ?? (out[row.fam_id] = { compared: 0, agreed: 0 });
    cal.compared += 1;
    if (masterYears.length === 1 && masterYears[0] === strongYears[0]) cal.agreed += 1;
  }
  return out;
}

interface ClassifyContext {
  sameName: boolean;
  sharedMember: boolean;
  maxYear: number;
}

function classifyNode(entry: IndexedNode, evidence: MatchedEvidence[], index: TreeIndex, ctx: ClassifyContext): NodeReconciliation {
  const { node } = entry;
  const family = index.familyById.get(node.family_id) as LiveFamily;
  const flags = new Set<ReviewFlag>();
  if (ctx.sameName) flags.add('SAME_NAME_IN_FAM');
  if (ctx.sharedMember) flags.add('CANONICAL_MEMBER_ON_SEVERAL_NODES');
  if (node.parent_member_id && !entry.parent) flags.add('PARENT_NOT_IN_SNAPSHOT');

  const future = evidence.filter((e) => isYear(e.academicYearStart) && e.academicYearStart > ctx.maxYear);
  if (future.length > 0) flags.add('FUTURE_OR_UNREVEALED_YEAR');
  const dated = evidence.filter((e) => isYear(e.academicYearStart) && e.academicYearStart <= ctx.maxYear);
  const usable = dated.filter((e) => USABLE.includes(e.identity));
  const bigDiffers = dated.filter((e) => e.identity === 'big_differs');
  const ambiguous = dated.filter((e) => e.identity === 'ambiguous');
  if (evidence.some((e) => e.notes.includes('legacy')) && dated.length === 0) flags.add('LEGACY_TERM_ONLY');

  const confirmed = usable.filter(
    (e) => e.source.kind === 'official_pairing' && OFFICIAL_IDENTITIES.includes(e.identity) && e.source.extraction_complete && e.source.authoritative !== false
  );
  if (usable.some((e) => e.source.kind === 'official_pairing' && e.source.authoritative === false)) flags.add('UNLABELLED_PAIRING_SOURCE');
  const strong = usable.filter((e) => !confirmed.includes(e) && e.source.kind !== 'master_year_cell');
  const master = usable.filter((e) => e.source.kind === 'master_year_cell');
  if (usable.some((e) => !e.source.extraction_complete)) flags.add('INCOMPLETE_SOURCE');

  const highYears = distinct([...confirmed, ...strong].map((e) => e.academicYearStart as number));
  const masterYears = distinct(master.map((e) => e.academicYearStart as number));
  const conflicting: MatchedEvidence[] = [];
  let conflict = false;

  if (highYears.length > 1) {
    flags.add('SOURCE_YEARS_DISAGREE');
    conflict = true;
  }
  if (masterYears.length > 1) {
    flags.add(highYears.length > 0 ? 'MASTER_DISAGREES' : 'MASTER_VARIANTS_DISAGREE');
    conflict = true;
  }
  if (highYears.length === 1 && masterYears.length === 1 && masterYears[0] !== highYears[0]) {
    flags.add('MASTER_DISAGREES');
    conflict = true;
  }
  if (bigDiffers.length > 0) {
    flags.add('SOURCE_BIG_DIFFERS');
    const anchor = highYears.length === 1 ? highYears[0] : null;
    if (anchor === null || bigDiffers.some((e) => e.academicYearStart !== anchor)) conflict = true;
    conflicting.push(...bigDiffers);
  }
  if (ambiguous.length > 0) {
    flags.add('AMBIGUOUS_IDENTITY');
    if (usable.length === 0) conflict = true;
    conflicting.push(...ambiguous);
  }
  if (future.length > 0) {
    conflicting.push(...future);
    conflict = true;
  }

  // Precedence chooses what to SHOW the reviewer; a conflict still holds the row.
  const ranked = confirmed.length > 0 ? confirmed : strong.length > 0 ? strong : master.length > 0 ? master : bigDiffers.length > 0 ? bigDiffers : [];
  const rankedYears = distinct(ranked.map((e) => e.academicYearStart as number));
  const recommendedYear = rankedYears.length === 1 ? rankedYears[0] : null;
  let recommendedTerm: string | null = null;
  if (recommendedYear !== null) {
    const terms = distinct(ranked.filter((e) => e.academicYearStart === recommendedYear && e.term).map((e) => e.term as string));
    if (terms.length === 1) recommendedTerm = terms[0];
    else if (terms.length > 1) flags.add('TERMS_DISAGREE_SAME_YEAR');
  }
  if (conflict) {
    for (const e of usable) if (e.academicYearStart !== recommendedYear && !conflicting.includes(e)) conflicting.push(e);
  }

  let confidence: ConfidenceClass;
  if (conflict) confidence = 'CONFLICTING_EVIDENCE';
  else if (confirmed.length > 0) confidence = 'CONFIRMED_YEAR';
  else if (strong.length > 0) confidence = 'STRONG_CANDIDATE';
  else if (master.length > 0) confidence = 'SUSPECTED_YEAR';
  else confidence = 'UNKNOWN';

  const existingYear = node.pickup_academic_year_start ?? null;
  if (existingYear !== null && recommendedYear !== null && existingYear !== recommendedYear) flags.add('EXISTING_YEAR_DIFFERS');

  let identity: IdentityStatus;
  if (usable.some((e) => e.identity.includes('pair'))) identity = 'RESOLVED_BY_LIVE_PAIR';
  else if (usable.length > 0) identity = ctx.sameName ? 'SAME_NAME_IN_FAM' : 'RESOLVED_BY_NAME_IN_FAM';
  else if (ambiguous.length > 0) identity = 'AMBIGUOUS_SOURCE_MATCH';
  else if (bigDiffers.length > 0) identity = 'SOURCE_BIG_DIFFERS';
  else identity = ctx.sameName ? 'SAME_NAME_IN_FAM' : 'NO_SOURCE_MATCH';

  return {
    ace_node_id: node.id,
    fam_id: node.family_id,
    fam_slug: family.slug,
    fam_name: family.name,
    member_name: node.name,
    current_big_node_id: node.parent_member_id,
    current_big_name: entry.parent?.name ?? null,
    canonical_member_id: node.member_id,
    existing_pickup_term: node.pickup_term ?? null,
    existing_pickup_academic_year_start: existingYear,
    recommended_pickup_academic_year: recommendedYear,
    recommended_pickup_term: recommendedTerm,
    confidence_class: confidence,
    identity_resolution_status: identity,
    flags: Array.from(flags),
    review_reason: '',
    supporting: usable.filter((e) => !conflicting.includes(e)),
    conflicting,
    candidate_years: distinct(evidence.map((e) => e.academicYearStart).filter(isYear)).sort((a, b) => a - b),
  };
}

const CLASS_RANK: Record<ConfidenceClass, number> = {
  CONFIRMED_YEAR: 4,
  STRONG_CANDIDATE: 3,
  SUSPECTED_YEAR: 2,
  CONFLICTING_EVIDENCE: 1,
  UNKNOWN: 0,
};

// A Little cannot be picked up before their Big. When the two disagree, the
// weaker-classed side is held for review (both, when equally strong). Neither
// year is inferred from the other.
function applyChronologyChecks(rows: NodeReconciliation[]) {
  const byId = new Map(rows.map((r) => [r.ace_node_id, r] as const));
  const hold = new Set<NodeReconciliation>();
  for (const child of rows) {
    const big = child.current_big_node_id ? byId.get(child.current_big_node_id) : undefined;
    if (!big || child.recommended_pickup_academic_year === null || big.recommended_pickup_academic_year === null) continue;
    if (child.recommended_pickup_academic_year < big.recommended_pickup_academic_year) {
      child.flags.push('CHILD_EARLIER_THAN_BIG');
      const c = CLASS_RANK[child.confidence_class];
      const b = CLASS_RANK[big.confidence_class];
      if (c <= b) hold.add(child);
      if (b <= c) hold.add(big);
    } else if (child.recommended_pickup_term && child.recommended_pickup_term === big.recommended_pickup_term) {
      child.flags.push('SAME_TERM_AS_BIG');
    }
  }
  for (const row of Array.from(hold)) {
    if (row.confidence_class !== 'UNKNOWN') row.confidence_class = 'CONFLICTING_EVIDENCE';
    if (!row.flags.includes('CHILD_EARLIER_THAN_BIG')) row.flags.push('CHILD_EARLIER_THAN_BIG');
  }
}

function describe(row: NodeReconciliation): string {
  const parts: string[] = [];
  const strongest = row.supporting[0];
  switch (row.confidence_class) {
    case 'CONFIRMED_YEAR':
      parts.push('official pairing names this Little under the live Big');
      break;
    case 'STRONG_CANDIDATE':
      parts.push(strongest?.source.kind === 'official_pairing' ? 'official pairing, identity needs a look' : 'explicit added_term on the matching live link');
      break;
    case 'SUSPECTED_YEAR':
      parts.push('Master workbook year row only');
      break;
    case 'CONFLICTING_EVIDENCE':
      parts.push('held for review');
      break;
    default:
      parts.push('no reliable year evidence');
  }
  for (const flag of row.flags) parts.push(FLAG_TEXT[flag]);
  return parts.join('; ');
}

// ── Reporting ───────────────────────────────────────────────────────────────

export function evidenceLabel(e: MatchedEvidence): string {
  const when = e.term ?? academicYearLabel(e.academicYearStart) ?? '';
  return `${e.source.source_id} ${e.record.ref} (${when || 'no year'}; ${e.identity})`;
}

export interface FamSummary {
  fam_slug: string;
  fam_name: string;
  live_nodes: number;
  with_canonical_member: number;
  roots: number;
  same_name_groups: number;
  source_matched: number;
  verified_term: number;
  legacy_only: number;
  existing_year: number;
  master_compared: number;
  master_agreed: number;
  classes: Record<ConfidenceClass, number>;
}

export interface AggregateSummary {
  generated: string;
  max_academic_year_start: number;
  live_nodes: number;
  families: number;
  classes: Record<ConfidenceClass, number>;
  per_fam: FamSummary[];
  flags: Partial<Record<ReviewFlag, number>>;
  sources: { source_id: string; kind: EvidenceKind; label: string; extraction_complete: boolean; records: number; matched_records: number; unmatched_records: number }[];
  unmatched_by_reason: Record<UnmatchedEvidence['reason'], number>;
}

function emptyClasses(): Record<ConfidenceClass, number> {
  return { CONFIRMED_YEAR: 0, STRONG_CANDIDATE: 0, SUSPECTED_YEAR: 0, CONFLICTING_EVIDENCE: 0, UNKNOWN: 0 };
}

/**
 * Counts only: no names, node ids, member ids or cell references. This is the
 * only output safe for a PR, an issue comment or CI logs.
 */
export function summarize(result: ReconciliationResult, evidence: EvidenceBundle, generated: string): AggregateSummary {
  const perFam = new Map<string, FamSummary>();
  const sameNameKeys = new Map<string, number>();
  for (const row of result.rows) {
    const key = `${row.fam_id}|${nameKeys(row.member_name).exact}`;
    sameNameKeys.set(key, (sameNameKeys.get(key) ?? 0) + 1);
  }
  const classes = emptyClasses();
  const flags: Partial<Record<ReviewFlag, number>> = {};
  for (const row of result.rows) {
    let fam = perFam.get(row.fam_id);
    if (!fam) {
      fam = {
        fam_slug: row.fam_slug,
        fam_name: row.fam_name,
        live_nodes: 0,
        with_canonical_member: 0,
        roots: 0,
        same_name_groups: 0,
        source_matched: 0,
        verified_term: 0,
        legacy_only: 0,
        existing_year: 0,
        master_compared: result.masterCalibration[row.fam_id]?.compared ?? 0,
        master_agreed: result.masterCalibration[row.fam_id]?.agreed ?? 0,
        classes: emptyClasses(),
      };
      perFam.set(row.fam_id, fam);
    }
    fam.live_nodes += 1;
    if (row.canonical_member_id) fam.with_canonical_member += 1;
    if (!row.current_big_node_id) fam.roots += 1;
    if (row.supporting.length + row.conflicting.length > 0) fam.source_matched += 1;
    if (row.recommended_pickup_term && row.confidence_class === 'CONFIRMED_YEAR') fam.verified_term += 1;
    if (row.flags.includes('LEGACY_TERM_ONLY')) fam.legacy_only += 1;
    if (row.existing_pickup_academic_year_start !== null) fam.existing_year += 1;
    fam.classes[row.confidence_class] += 1;
    classes[row.confidence_class] += 1;
    for (const flag of row.flags) flags[flag] = (flags[flag] ?? 0) + 1;
  }
  for (const [key, count] of Array.from(sameNameKeys.entries())) {
    if (count > 1) {
      const fam = perFam.get(key.split('|')[0]);
      if (fam) fam.same_name_groups += 1;
    }
  }
  const unmatchedRecords = new Set(result.unmatched.map((u) => u.record));
  const unmatchedByReason: Record<UnmatchedEvidence['reason'], number> = { no_live_node: 0, unresolved_fam: 0, unusable_name: 0 };
  for (const u of result.unmatched) unmatchedByReason[u.reason] += 1;
  return {
    generated,
    max_academic_year_start: result.maxAcademicYearStart,
    live_nodes: result.rows.length,
    families: perFam.size,
    classes,
    per_fam: Array.from(perFam.values()).sort((a, b) => a.fam_slug.localeCompare(b.fam_slug)),
    flags,
    sources: evidence.sources.map((s) => {
      const records = evidence.records.filter((r) => r.source_id === s.source_id);
      const unmatchedCount = records.filter((r) => unmatchedRecords.has(r)).length;
      return {
        source_id: s.source_id,
        kind: s.kind,
        label: s.label,
        extraction_complete: s.extraction_complete,
        records: records.length,
        matched_records: records.length - unmatchedCount,
        unmatched_records: unmatchedCount,
      };
    }),
    unmatched_by_reason: unmatchedByReason,
  };
}
