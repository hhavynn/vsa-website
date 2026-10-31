import { comparePickup } from './acePickupYear';
import type { AcePickupYear } from './acePickupYear';
export { comparePickup } from './acePickupYear';

export interface TreeNode {
  id: string;
  initial: string;
  label: string;
  role: string;
  cohort?: string | null;
  pickup?: AcePickupYear;
  parent?: string | null;
  photoUrl?: string | null;
  displayOrder?: number;
}

export type BandKey = number | 'unknown';
export interface YearBand {
  key: BandKey;
  academicYearStart: number | null;
  startRow: number;
  rowCount: number;
  nodeCount: number;
}
export interface LayoutIssue {
  kind: 'cycle' | 'self_parent' | 'duplicate_id' | 'child_before_big' | 'same_term_as_big';
  nodeIds: string[];
}
export interface LayoutResult {
  mode: 'year' | 'generation';
  positions: Record<string, { x: number; y: number }>;
  /** The repair affects layout only, never persisted ACE lineage. */
  parentById: Record<string, string | null>;
  bandKeyById: Record<string, BandKey>;
  yearBands: YearBand[];
  rowCount: number;
  totalWidth: number;
  issues: LayoutIssue[];
}

/** An all-unknown family keeps its proven generation layout, not a fictional year. */
export const ACE_YEAR_LAYOUT_MIN_KNOWN_SHARE = 0.25;
/** Deliberate placement for legacy undated ancestors: above the earliest known year. */
export const UNKNOWN_BAND_FIRST = true;

const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const verifiedYear = (n: TreeNode): number | null =>
  n.pickup?.status === 'verified' ? n.pickup.academicYearStart : null;

export function uniqueTreeNodes(nodes: TreeNode[]): TreeNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

export function layoutTree(rawNodes: TreeNode[]): LayoutResult {
  const nodes = uniqueTreeNodes(rawNodes);
  const issues: LayoutIssue[] = [];
  if (nodes.length < rawNodes.length) {
    const seen = new Set<string>();
    for (const n of rawNodes) {
      if (seen.has(n.id)) issues.push({ kind: 'duplicate_id', nodeIds: [n.id] });
      seen.add(n.id);
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentById: Record<string, string | null> = {};
  for (const node of nodes) {
    if (node.parent === node.id) {
      issues.push({ kind: 'self_parent', nodeIds: [node.id] });
      parentById[node.id] = null;
    } else {
      parentById[node.id] = node.parent && byId.has(node.parent) ? node.parent : null;
    }
  }

  // Each node has at most one parent. Break each closed parent walk once,
  // removing the edge at the smallest id. Every node then reaches a root.
  const completed = new Set<string>();
  for (const start of [...byId.keys()].sort(cmp)) {
    if (completed.has(start)) continue;
    const path: string[] = [];
    const at = new Map<string, number>();
    let id: string | null = start;
    while (id && !completed.has(id) && !at.has(id)) {
      at.set(id, path.length);
      path.push(id);
      id = parentById[id];
    }
    if (id && at.has(id)) {
      const members = path.slice(at.get(id)!).sort(cmp);
      parentById[members[0]] = null;
      issues.push({ kind: 'cycle', nodeIds: members });
    }
    path.forEach((key) => completed.add(key));
  }

  const compareNode = (aId: string, bId: string): number => {
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;
    const aYear = verifiedYear(a);
    const bYear = verifiedYear(b);
    if (aYear === null && bYear !== null) return 1;
    if (bYear === null && aYear !== null) return -1;
    if (aYear !== null && bYear !== null && aYear !== bYear) return aYear - bYear;
    const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
    const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
    return ao - bo || cmp(a.id, b.id);
  };
  const children = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const roots: string[] = [];
  for (const node of nodes) {
    const p = parentById[node.id];
    if (p) {
      children.get(p)!.push(node.id);
      const big = byId.get(p)!;
      const aYear = verifiedYear(big);
      const bYear = verifiedYear(node);
      if (aYear !== null && bYear !== null && bYear < aYear) {
        issues.push({ kind: 'child_before_big', nodeIds: [big.id, node.id] });
      } else if (comparePickup(big.pickup, node.pickup) === 0) {
        issues.push({ kind: 'same_term_as_big', nodeIds: [big.id, node.id] });
      }
    } else roots.push(node.id);
  }
  children.forEach((ids) => ids.sort(compareNode));
  roots.sort(compareNode);

  const known = nodes.map(verifiedYear).filter((year): year is number => year !== null);
  const mode: 'year' | 'generation' = known.length > 0 &&
    known.length / nodes.length >= ACE_YEAR_LAYOUT_MIN_KNOWN_SHARE ? 'year' : 'generation';
  const bandKeyById: Record<string, BandKey> = {};
  const yearBands: YearBand[] = [];
  const rowById: Record<string, number> = {};
  if (mode === 'year') {
    const min = Math.min(...known);
    const max = Math.max(...known);
    const hasUnknown = known.length < nodes.length;
    const keys: BandKey[] = [];
    if (hasUnknown && UNKNOWN_BAND_FIRST) keys.push('unknown');
    for (let year = min; year <= max; year++) keys.push(year);
    if (hasUnknown && !UNKNOWN_BAND_FIRST) keys.push('unknown');
    const maxLane = new Map<BandKey, number>();
    const bandCount = new Map<BandKey, number>();
    // Only ancestors in the SAME band make a second lane. Cousins still share y.
    const visit = (id: string, onPath: Map<BandKey, number>): void => {
      const key: BandKey = verifiedYear(byId.get(id)!) ?? 'unknown';
      bandKeyById[id] = key;
      const previous = onPath.get(key) ?? -1;
      const lane = previous + 1;
      rowById[id] = lane;
      maxLane.set(key, Math.max(maxLane.get(key) ?? -1, lane));
      bandCount.set(key, (bandCount.get(key) ?? 0) + 1);
      onPath.set(key, lane);
      children.get(id)!.forEach((kid) => visit(kid, onPath));
      if (previous < 0) onPath.delete(key);
      else onPath.set(key, previous);
    };
    roots.forEach((id) => visit(id, new Map()));
    let row = 0;
    for (const key of keys) {
      const rowCount = (maxLane.get(key) ?? -1) + 1 || 1;
      yearBands.push({
        key, academicYearStart: key === 'unknown' ? null : key,
        startRow: row, rowCount, nodeCount: bandCount.get(key) ?? 0,
      });
      row += rowCount;
    }
    const starts = new Map(yearBands.map((b) => [b.key, b.startRow]));
    Object.keys(rowById).forEach((id) => {
      rowById[id] += starts.get(bandKeyById[id]) ?? 0;
    });
  } else {
    const visit = (id: string, depth: number): void => {
      rowById[id] = depth;
      children.get(id)!.forEach((kid) => visit(kid, depth + 1));
    };
    roots.forEach((id) => visit(id, 0));
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let cursor = 0;
  const place = (id: string): void => {
    const kids = children.get(id)!;
    if (kids.length === 0) {
      positions[id] = { x: cursor + 0.5, y: rowById[id] };
      cursor += 1;
    } else {
      const start = cursor;
      kids.forEach(place);
      positions[id] = { x: (start + cursor) / 2, y: rowById[id] };
    }
  };
  roots.forEach(place);
  return {
    mode, positions, parentById, bandKeyById, yearBands,
    rowCount: Math.max(1, ...(Object.values(rowById).map((y) => y + 1)),
      ...yearBands.map((b) => b.startRow + b.rowCount)),
    totalWidth: Math.max(cursor, 1), issues,
  };
}

type Point = { x: number; y: number };
export function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  const at = (t: number, a: number, b: number, c: number, d: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const next = { x: at(t, p0.x, p1.x, p2.x, p3.x), y: at(t, p0.y, p1.y, p2.y, p3.y) };
    length += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  return length;
}

export function edgeGeometry(a: Point, b: Point, nodeR: number, unitY: number) {
  const upward = b.y <= a.y;
  const startY = a.y + (upward ? -nodeR : nodeR);
  const endY = b.y + (upward ? nodeR + 40 : -nodeR);
  const kneeY = upward ? endY : Math.min(endY, a.y + unitY - nodeR);
  const my = (startY + kneeY) / 2;
  const p0 = { x: a.x, y: startY }, p1 = { x: a.x, y: my };
  const p2 = { x: b.x, y: my }, p3 = { x: b.x, y: kneeY };
  const straight = !upward && kneeY < endY ? endY - kneeY : 0;
  return {
    d: 'M ' + a.x + ' ' + startY + ' C ' + a.x + ' ' + my + ', ' + b.x + ' ' + my +
      ', ' + b.x + ' ' + kneeY + (straight ? ' L ' + b.x + ' ' + endY : ''),
    length: cubicLength(p0, p1, p2, p3) + straight,
    upward,
  };
}
