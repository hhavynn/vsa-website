// JSON-import parser for ACE fams. Accepts the "Sweatpants" handoff shape:
// { family, aliases?, members: [{ name, id_hint?, big, littles[], ... }] }
//
// Handles:
//  - implicit members (names referenced only in `littles` arrays)
//  - duplicate names disambiguated by `id_hint`; a member whose big shares a
//    name with someone else points at the right one with `big_id_hint`
//  - role_label derivation: anyone with at least one child → "Big", else "Little"
//  - `added_term` kept as unreviewed pickup-year evidence. It is a source
//    claim, not proof: the repo stores it in the admin-only evidence table
//    as pending, and never as the node's approved pickup year.
//
// The resulting ImportPlan has stable UUIDs so the repo can do a two-pass
// insert (rows first with null parents, then update parent_member_id).

import type { TablesInsert } from '../types/database';
import { ParsedPickup, parsePickupValue, pickupCandidateOf } from './acePickupYear';

export interface SweatpantsMember {
  name: string;
  id_hint?: string;
  big?: string | null;
  big_id_hint?: string | null;
  littles?: string[];
  siblings?: string[];
  generation?: string | null;
  added_term?: string | null;
  sources?: string[];
  confidence?: string;
  notes?: string;
}

export interface SweatpantsJson {
  family: string;
  aliases?: string[];
  members: SweatpantsMember[];
}

export type RoleLabel = 'Big' | 'Little';

/** A source's pickup claim for one person, kept exactly as written. */
export interface PersonPickupEvidence {
  rawValue: string;
  parsed: ParsedPickup;
  /** The source row's own confidence label (e.g. confirmed, inferred-high). */
  sourceConfidence: string | null;
}

export interface PersonRow {
  id: string;
  name: string;
  role_label: RoleLabel;
  parent_id: string | null;
  display_order: number;
  /** Null when the source gave no term (blank/missing) or the node is implicit. */
  pickup: PersonPickupEvidence | null;
}

export interface ImportPlan {
  familyName: string;
  familySlug: string;
  description: string | null;
  people: PersonRow[];
  warnings: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function explicitKey(m: SweatpantsMember): string {
  return m.id_hint ? `explicit:${m.id_hint}` : `explicit:${m.name}`;
}

function implicitKey(name: string, parentName: string): string {
  return `implicit:${name}|under:${parentName}`;
}

export function validateJson(input: unknown): { ok: true; json: SweatpantsJson } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Root must be an object.' };
  const obj = input as Record<string, unknown>;
  if (typeof obj.family !== 'string' || obj.family.trim().length === 0) {
    return { ok: false, error: '`family` must be a non-empty string.' };
  }
  if (!Array.isArray(obj.members) || obj.members.length === 0) {
    return { ok: false, error: '`members` must be a non-empty array.' };
  }
  for (let i = 0; i < obj.members.length; i++) {
    const m = obj.members[i] as Record<string, unknown>;
    if (typeof m.name !== 'string' || m.name.trim().length === 0) {
      return { ok: false, error: `members[${i}].name is missing or empty.` };
    }
  }
  return { ok: true, json: input as SweatpantsJson };
}

export function buildImportPlan(json: SweatpantsJson): ImportPlan {
  const warnings: string[] = [];

  // Index explicit members by display name.
  const explicitsByName = new Map<string, SweatpantsMember[]>();
  json.members.forEach((m) => {
    const list = explicitsByName.get(m.name) ?? [];
    list.push(m);
    explicitsByName.set(m.name, list);
  });

  // Sanity: duplicate explicit names must use id_hint.
  explicitsByName.forEach((list, name) => {
    if (list.length > 1) {
      const missing = list.filter((m) => !m.id_hint).length;
      if (missing > 0) {
        warnings.push(
          `Duplicate name "${name}" with ${missing} entries missing id_hint. Disambiguation may be wrong.`,
        );
      }
    }
  });

  // For a `littles` listing under `parentName`, find the matching explicit
  // entry (one whose `big === parentName`); otherwise this is an implicit.
  function findExplicitChildOf(littleName: string, parentName: string): SweatpantsMember | null {
    const candidates = explicitsByName.get(littleName) ?? [];
    for (const c of candidates) {
      if (c.big === parentName) return c;
    }
    return null;
  }

  // Map from internal-key → { name, parentKey }
  type Node = { key: string; name: string; parentKey: string | null };
  const pickupByKey = new Map<string, PersonPickupEvidence>();
  const nodes = new Map<string, Node>();
  const idByKey = new Map<string, string>();

  function ensureNode(key: string, name: string): Node {
    let n = nodes.get(key);
    if (!n) {
      n = { key, name, parentKey: null };
      nodes.set(key, n);
      idByKey.set(key, crypto.randomUUID());
    }
    return n;
  }

  // Step 1: register every explicit entry.
  json.members.forEach((m) => ensureNode(explicitKey(m), m.name));

  // Pickup evidence comes only from explicit entries; an implicit little has
  // no row of its own, so no term.
  json.members.forEach((m) => {
    const evidence = pickupEvidenceOf(m);
    if (!evidence) return;
    pickupByKey.set(explicitKey(m), evidence);
    if (evidence.parsed.kind === 'needs_review') {
      warnings.push(
        `"${m.name}" has added_term "${evidence.rawValue}" that cannot be placed (${evidence.parsed.issue.replace(/_/g, ' ')}). It is kept for review, not as a year.`,
      );
    }
  });

  // Step 2: register implicit littles (names in any `littles` array with no
  // matching explicit entry under the same parent).
  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return; // already explicit
      ensureNode(implicitKey(littleName, parent.name), littleName);
    });
  });

  // Step 3: resolve parentKey for every node.
  // Explicit entries: parent = the explicit entry with name === m.big.
  json.members.forEach((m) => {
    const self = nodes.get(explicitKey(m));
    if (!self) return;
    if (!m.big) {
      self.parentKey = null;
      return;
    }
    const allCandidates = explicitsByName.get(m.big) ?? [];
    const parentCandidates = m.big_id_hint
      ? allCandidates.filter((c) => c.id_hint === m.big_id_hint)
      : allCandidates;
    if (m.big_id_hint && parentCandidates.length === 0) {
      warnings.push(
        `"${m.name}" lists big "${m.big}" with id_hint "${m.big_id_hint}", but no entry has that id_hint. Treating as root.`,
      );
      self.parentKey = null;
      return;
    }
    if (parentCandidates.length === 0) {
      warnings.push(
        `"${m.name}" lists big "${m.big}" but no explicit entry exists for that name. Treating as root.`,
      );
      self.parentKey = null;
      return;
    }
    if (parentCandidates.length > 1) {
      warnings.push(
        `"${m.name}" lists big "${m.big}" which is ambiguous (${parentCandidates.length} explicit entries). Using the first match.`,
      );
    }
    self.parentKey = explicitKey(parentCandidates[0]);
  });

  // Implicit littles: parent = the explicit member that listed them.
  json.members.forEach((parent) => {
    (parent.littles ?? []).forEach((littleName) => {
      if (findExplicitChildOf(littleName, parent.name)) return; // already explicit
      const k = implicitKey(littleName, parent.name);
      const n = nodes.get(k);
      if (n) n.parentKey = explicitKey(parent);
    });
  });

  // A Little picked up before their own Big is an impossible lineage; flag it
  // for review instead of trusting either term.
  nodes.forEach((n) => {
    if (!n.parentKey) return;
    const own = pickupByKey.get(n.key);
    const big = pickupByKey.get(n.parentKey);
    if (own && big && pickupPrecedes(own.parsed, big.parsed)) {
      const bigName = nodes.get(n.parentKey)?.name ?? '?';
      warnings.push(
        `"${n.name}" (${own.rawValue}) is dated before their big "${bigName}" (${big.rawValue}). Check both terms.`,
      );
    }
  });

  // Step 4: who has at least one child?
  const hasChild = new Set<string>();
  nodes.forEach((n) => {
    if (n.parentKey) hasChild.add(n.parentKey);
  });

  // Step 5: topo-sort (parents before children) so the DB insert order is FK-safe.
  const visited = new Set<string>();
  const ordered: Node[] = [];
  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const n = nodes.get(key);
    if (!n) return;
    if (n.parentKey) visit(n.parentKey);
    ordered.push(n);
  }
  nodes.forEach((n) => visit(n.key));

  // Step 6: emit PersonRow[].
  const people: PersonRow[] = ordered.map((n, i) => ({
    id: idByKey.get(n.key)!,
    name: n.name,
    role_label: hasChild.has(n.key) ? 'Big' : 'Little',
    parent_id: n.parentKey ? idByKey.get(n.parentKey)! : null,
    display_order: i,
    pickup: pickupByKey.get(n.key) ?? null,
  }));

  const description = json.aliases && json.aliases.length > 0
    ? `Also known as: ${json.aliases.join(', ')}.`
    : null;

  return {
    familyName: json.family.trim(),
    familySlug: slugify(json.family),
    description,
    people,
    warnings,
  };
}

const SEASON_ORDER = { FA: 0, WI: 1, SP: 2 } as const;

function pickupEvidenceOf(m: SweatpantsMember): PersonPickupEvidence | null {
  const raw: unknown = m.added_term;
  if (raw === null || raw === undefined) return null;
  const rawValue = String(raw).trim();
  if (rawValue === '') return null;
  return {
    rawValue,
    parsed: parsePickupValue(rawValue),
    sourceConfidence: typeof m.confidence === 'string' && m.confidence.trim() ? m.confidence.trim() : null,
  };
}

/** True only when `a` is certainly earlier than `b`. */
function pickupPrecedes(a: ParsedPickup, b: ParsedPickup): boolean {
  const ca = pickupCandidateOf(a);
  const cb = pickupCandidateOf(b);
  if (!ca || !cb) return false;
  if (ca.academicYearStart !== cb.academicYearStart) return ca.academicYearStart < cb.academicYearStart;
  if (a.kind !== 'term' || b.kind !== 'term') return false;
  return SEASON_ORDER[a.season] < SEASON_ORDER[b.season];
}

export interface PickupEvidenceSummary {
  /** Exact term, e.g. FA23. */
  term: number;
  /** Academic year without a season. */
  academicYear: number;
  /** `legacy` markers. */
  legacy: number;
  /** Written but unplaceable (warned). */
  needsReview: number;
  /** No term in the source. */
  none: number;
}

export function summarizePickupEvidence(plan: Pick<ImportPlan, 'people'>): PickupEvidenceSummary {
  const summary: PickupEvidenceSummary = { term: 0, academicYear: 0, legacy: 0, needsReview: 0, none: 0 };
  plan.people.forEach((p) => {
    const kind = p.pickup?.parsed.kind;
    if (kind === 'term') summary.term += 1;
    else if (kind === 'academic_year') summary.academicYear += 1;
    else if (kind === 'needs_review') summary.needsReview += 1;
    else if (kind === 'unknown') summary.legacy += 1;
    else summary.none += 1;
  });
  return summary;
}

/** One-line import preview: what the source says, and that none of it is approved yet. */
export function describePickupEvidence(plan: Pick<ImportPlan, 'people'>): string {
  const s = summarizePickupEvidence(plan);
  const parts = [
    `${s.term} with a term`,
    s.academicYear > 0 ? `${s.academicYear} year only` : null,
    `${s.legacy} legacy`,
    s.needsReview > 0 ? `${s.needsReview} unreadable` : null,
    `${s.none} none`,
  ].filter((part): part is string => part !== null);
  return `Pickup years: ${parts.join(' · ')}. Saved as unreviewed evidence; no year shows publicly until an admin approves it.`;
}

const MAX_EVIDENCE_TEXT = 64;
const MAX_SOURCE_LABEL = 200;

/**
 * Evidence rows for every person whose source gave a term, all `pending`.
 * Approval is a separate admin review (aceFamiliesRepository.setPickupYear);
 * an import never sets the node's approved pickup year.
 */
export function pickupEvidenceRows(
  plan: Pick<ImportPlan, 'familyName' | 'people'>,
): TablesInsert<'ace_member_pickup_evidence'>[] {
  const sourceLabel = `JSON import: ${plan.familyName}`.slice(0, MAX_SOURCE_LABEL);
  return plan.people.flatMap((p) => {
    if (!p.pickup) return [];
    const candidate = pickupCandidateOf(p.pickup.parsed);
    return [
      {
        ace_member_id: p.id,
        source_kind: 'import_json' as const,
        source_label: sourceLabel,
        raw_value: p.pickup.rawValue.slice(0, MAX_EVIDENCE_TEXT),
        candidate_academic_year_start: candidate?.academicYearStart ?? null,
        candidate_term: candidate?.term ?? null,
        source_confidence: p.pickup.sourceConfidence?.slice(0, MAX_EVIDENCE_TEXT) ?? null,
        review_status: 'pending' as const,
      },
    ];
  });
}
