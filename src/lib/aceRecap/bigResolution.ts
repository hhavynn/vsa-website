import type { AceNodeRef } from '../aceAssignments';
import { normalizeMemberName } from '../memberLinkMatching';

/**
 * Resolves each Big on an official pairing sheet to an EXISTING published ACE
 * node, or explains why it cannot. Name similarity is evidence, never proof:
 *
 * - Only a single candidate node across every active family can be previewed.
 * - Two or more candidates (same family or not) always go to the review queue.
 * - Nothing here creates a Big, a family or a link; it only reports.
 * - The ACE Chair's approval is recorded separately (see `approvals` in
 *   recapSnapshot.ts) and is the only thing that marks a pairing publishable.
 */

/** 'selected' = the ACE Chair named this node explicitly in the approvals file. */
export type BigMatchKind = 'exact' | 'variant' | 'selected';

export interface BigCandidate {
  nodeId: string;
  nodeName: string;
  familyId: string;
  familyName: string;
  familyArchived: boolean;
  matchKind: BigMatchKind;
  /** Canonical members.id already linked to this ACE node, if any. */
  memberId: string | null;
  childCount: number;
  /** 0 = family root. */
  depth: number;
  /** Term the historical repo import recorded for this node's own pickup (unreviewed). */
  importTerm: string | null;
}

export type BigResolutionStatus =
  | 'resolved_exact'
  | 'resolved_variant'
  | 'ambiguous'
  | 'not_found'
  | 'co_big'
  | 'stale_candidate'
  | 'archived_family';

export interface BigResolution {
  bigName: string;
  status: BigResolutionStatus;
  candidates: BigCandidate[];
  /** Set only for resolved_* statuses. */
  chosen: BigCandidate | null;
  notes: string[];
}

export const PREVIEWABLE_BIG_STATUSES: readonly BigResolutionStatus[] = ['resolved_exact', 'resolved_variant'];

/** Archived ("(Dead) …") families take no new Littles. */
export function isArchivedFamilyName(name: string | null | undefined): boolean {
  return /^\s*\(dead\)/i.test(name ?? '');
}

export function nameTokens(name: string): string[] {
  return normalizeMemberName(name.replace(/,/g, ' '))
    .split(' ')
    .map((t) => t.replace(/\.+$/g, ''))
    .filter(Boolean);
}

const isInitial = (t: string) => t.length === 1;
const middleCompatible = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || b.length === 0) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    if (x === y) return true;
    if (isInitial(x) || isInitial(y)) return x.charAt(0) === y.charAt(0);
    return false;
  });
};

/** 'exact' for identical tokens; 'variant' when only middle names/initials differ compatibly. */
export function compareNames(sheetName: string, nodeName: string): BigMatchKind | null {
  const a = nameTokens(sheetName);
  const b = nameTokens(nodeName);
  if (a.length === 0 || b.length === 0) return null;
  if (a.join(' ') === b.join(' ')) return 'exact';
  if (a.length < 2 || b.length < 2) return null;
  if (a[0] !== b[0] || a[a.length - 1] !== b[b.length - 1]) return null;
  return middleCompatible(a.slice(1, -1), b.slice(1, -1)) ? 'variant' : null;
}

export interface BigResolutionContext {
  nodes: readonly AceNodeRef[];
  /** Optional: node id → unreviewed historical import term (e.g. "legacy", "FA24"). */
  importTermByNodeId?: ReadonlyMap<string, string>;
}

export function indexNodes(nodes: readonly AceNodeRef[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childCount = new Map<string, number>();
  for (const n of nodes) if (n.parentId) childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
  const depthMemo = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depthMemo.get(id);
    if (known !== undefined) return known;
    let depth = 0;
    const seen = new Set<string>([id]);
    let current = byId.get(id);
    while (current?.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
      seen.add(current.parentId);
      depth += 1;
      current = byId.get(current.parentId);
    }
    depthMemo.set(id, depth);
    return depth;
  };
  return { byId, childCount, depthOf };
}

export function candidateFromNode(node: AceNodeRef, matchKind: BigMatchKind, ctx: BigResolutionContext,
  index = indexNodes(ctx.nodes)): BigCandidate {
  return {
    nodeId: node.id, nodeName: node.name, familyId: node.familyId,
    familyName: node.familyName ?? node.familyId,
    familyArchived: isArchivedFamilyName(node.familyName),
    matchKind, memberId: node.memberId,
    childCount: index.childCount.get(node.id) ?? 0,
    depth: index.depthOf(node.id),
    importTerm: ctx.importTermByNodeId?.get(node.id) ?? null,
  };
}

export function resolveBig(bigName: string, bigNames: readonly string[], ctx: BigResolutionContext,
  index = indexNodes(ctx.nodes)): BigResolution {
  if (bigNames.length > 1) {
    return {
      bigName, status: 'co_big', candidates: [], chosen: null,
      notes: ['The row lists more than one Big; the ACE Chair must name the single Big node.'],
    };
  }
  const candidates: BigCandidate[] = [];
  for (const node of ctx.nodes) {
    const matchKind = compareNames(bigName, node.name);
    if (!matchKind) continue;
    candidates.push(candidateFromNode(node, matchKind, ctx, index));
  }
  candidates.sort((a, b) =>
    (a.matchKind === b.matchKind ? 0 : a.matchKind === 'exact' ? -1 : 1)
    || a.familyName.localeCompare(b.familyName) || a.nodeId.localeCompare(b.nodeId));

  const notes: string[] = [];
  const active = candidates.filter((c) => !c.familyArchived);
  const archived = candidates.filter((c) => c.familyArchived);
  if (active.length && archived.length) {
    notes.push(`${archived.length} namesake(s) in archived families ignored: ${archived.map((c) => c.familyName).join(', ')}.`);
  }
  const pool = active.length ? active : archived;
  if (pool.length === 0) {
    return { bigName, status: 'not_found', candidates, chosen: null,
      notes: [...notes, 'No published ACE node has this name or a middle-initial variant of it.'] };
  }
  if (pool.length > 1) {
    const families = Array.from(new Set(pool.map((c) => c.familyName)));
    notes.push(families.length > 1
      ? `Candidates in ${families.length} families: ${families.join(', ')}.`
      : `${pool.length} nodes in ${families[0]} match this name.`);
    return { bigName, status: 'ambiguous', candidates, chosen: null, notes };
  }
  const only = pool[0];
  if (only.familyArchived) {
    return { bigName, status: 'archived_family', candidates, chosen: null,
      notes: [...notes, `Only match is in archived family ${only.familyName}.`] };
  }
  if (only.importTerm === 'legacy') {
    return { bigName, status: 'stale_candidate', candidates, chosen: null,
      notes: [...notes, 'Only match was recorded on the legacy (pre-FA21) sheet, so it is unlikely to be a current Big.'] };
  }
  if (only.matchKind === 'variant') notes.push(`Matched by middle-name variant: "${only.nodeName}".`);
  if (!only.memberId) notes.push('Big node has no verified member link.');
  return {
    bigName, status: only.matchKind === 'exact' ? 'resolved_exact' : 'resolved_variant',
    candidates, chosen: only, notes,
  };
}
