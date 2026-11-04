import { edgeGeometry, treeMetrics } from '../../../../lib/aceTreeLayout';
import type { RecapNode, RecapPresentationFamily } from '../../../../lib/aceRecap/recapSnapshot';
import { concatPolys, samplePath } from './motion/thread';
import type { Poly } from './motion/thread';

/**
 * Frame-independent geometry for the recap stage: world positions, edge
 * paths, palettes and camera math. Computed once per family and cached, so
 * each rendered frame (Remotion or the in-site player) is cheap.
 */

export const STAGE_W = 1920;
export const STAGE_H = 1080;
const M = treeMetrics(false);
export const UNIT_X = M.unitX;
export const UNIT_Y = M.unitY;
export const NODE_R = M.nodeR;
const PAD = 80;

export interface Pt { x: number; y: number }
export interface StageEdge { id: string; from: string; to: string; d: string; length: number; isNew: boolean; cubic: number[] | null; poly: Poly }
export interface StageFamily {
  fam: RecapPresentationFamily;
  pos: Map<string, Pt>;
  byId: Map<string, RecapNode>;
  edges: StageEdge[];
  edgeTo: Map<string, StageEdge>;
  children: Map<string, string[]>;
  newIds: Set<string>;
  bounds: Box;
  beforeBounds: Box;
  palette: FamilyPalette;
}
export interface Box { x: number; y: number; w: number; h: number }
export interface Camera { cx: number; cy: number; s: number; r?: number }

export interface FamilyPalette { accent: string; soft: string; edge: string; node: string }

// ─── math ────────────────────────────────────────────────────────────────────
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const progress = (f: number, start: number, dur: number) => clamp((f - start) / Math.max(dur, 1));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** Gentle overshoot for node "pop" reveals. */
export const easeBack = (t: number) => {
  const c1 = 1.55;
  const c3 = c1 + 1;
  const x = clamp(t);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
/** Deterministic pseudo-random in [0,1) — same value every render of a frame. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
export const hashId = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  // Interpolate zoom in log space so pushes feel linear to the eye.
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), t)) };
}

/** Camera that frames `box` inside the given screen region. */
export function fitCamera(box: Box, region: Box = { x: 0, y: 0, w: STAGE_W, h: STAGE_H }, maxScale = 1.25, fill = 0.88): Camera {
  const s = Math.min(maxScale, (region.w * fill) / box.w, (region.h * fill) / box.h);
  // Centre the box in the region, expressed as a camera on the full stage.
  const regionCx = region.x + region.w / 2;
  const regionCy = region.y + region.h / 2;
  return {
    cx: box.x + box.w / 2 - (regionCx - STAGE_W / 2) / s,
    cy: box.y + box.h / 2 - (regionCy - STAGE_H / 2) / s,
    s,
  };
}

export const cameraTransform = (c: Camera) =>
  `translate(${STAGE_W / 2} ${STAGE_H / 2}) rotate(${c.r ?? 0}) scale(${c.s}) translate(${-c.cx} ${-c.cy})`;

/** World point → screen point under a camera (roll included). */
export function toScreen(c: Camera, p: Pt): Pt {
  const x = (p.x - c.cx) * c.s;
  const y = (p.y - c.cy) * c.s;
  const r = ((c.r ?? 0) * Math.PI) / 180;
  return { x: STAGE_W / 2 + x * Math.cos(r) - y * Math.sin(r), y: STAGE_H / 2 + x * Math.sin(r) + y * Math.cos(r) };
}

// ─── colour ──────────────────────────────────────────────────────────────────
const FALLBACK = ['#a3b2ec', '#ebb4da', '#c9b6f0', '#8fd3e8', '#f2c48d', '#b9e3c6'];
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t));
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Family theme colour pulled into the VSA blue-purple night palette, legible on dark. */
export function familyPalette(themeColor: string | null, seed: string): FamilyPalette {
  let rgb: number[] = hexToRgb(themeColor ?? '') ?? hexToRgb(FALLBACK[hashId(seed) % FALLBACK.length])!;
  rgb = mix(rgb, [233, 228, 255], 0.28);
  for (let i = 0; i < 6 && luminance(rgb) < 0.55; i++) rgb = mix(rgb, [255, 255, 255], 0.18);
  const accent = toHex(rgb);
  return {
    accent,
    soft: toHex(mix(rgb, [20, 24, 60], 0.55)),
    edge: toHex(mix(rgb, [40, 46, 96], 0.45)),
    node: toHex(mix(rgb, [18, 22, 52], 0.78)),
  };
}

export const GOLD = '#ffd27a';
export const GOLD_DEEP = '#f39a4a';
export const INK = '#0b1030';
export const CREAM = '#fff6e6';

// ─── geometry ────────────────────────────────────────────────────────────────
function boxOfPoints(points: Pt[], pad: number): Box {
  if (!points.length) return { x: 0, y: 0, w: STAGE_W, h: STAGE_H };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad + 40 };
}

export function boxOfIds(sf: StageFamily, ids: Iterable<string>, pad = NODE_R + 70): Box {
  const pts: Pt[] = [];
  for (const id of ids) { const p = sf.pos.get(id); if (p) pts.push(p); }
  return boxOfPoints(pts, pad);
}

function parseCubic(d: string): number[] | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return /^M[^C]*C[^MCL]*$/.test(d.trim()) && nums.length === 8 ? nums : null;
}

/** Point at t along a single-cubic edge (for travelling sparks). */
export function cubicPoint(c: number[], t: number): Pt {
  const u = 1 - t;
  const b = (a: number, p: number, q: number, d: number) => u * u * u * a + 3 * u * u * t * p + 3 * u * t * t * q + t * t * t * d;
  return { x: b(c[0], c[2], c[4], c[6]), y: b(c[1], c[3], c[5], c[7]) };
}

// Keyed by the family object itself: a revised snapshot (even with the same
// id and counts) is a new object, so it never reuses stale geometry.
const cache = new WeakMap<RecapPresentationFamily, StageFamily>();

export function stageFamily(fam: RecapPresentationFamily): StageFamily {
  const hit = cache.get(fam);
  if (hit) return hit;
  const pos = new Map<string, Pt>();
  for (const n of fam.nodes) pos.set(n.id, { x: n.x * UNIT_X + PAD, y: n.y * UNIT_Y + PAD });
  const byId = new Map(fam.nodes.map((n) => [n.id, n]));
  const all = fam.nodes.map((n) => pos.get(n.id)!);
  const edges: StageEdge[] = [];
  for (const n of fam.nodes) {
    if (!n.parent || !pos.has(n.parent)) continue;
    const a = pos.get(n.parent)!;
    const b = pos.get(n.id)!;
    const obstacles = all.filter((p) => p !== a && p !== b);
    const g = edgeGeometry(a, b, NODE_R, UNIT_Y, obstacles);
    edges.push({ id: `${n.parent}-${n.id}`, from: n.parent, to: n.id, d: g.d, length: g.length, isNew: n.isNew, cubic: parseCubic(g.d), poly: samplePath(g.d) });
  }
  const newIds = new Set(fam.nodes.filter((n) => n.isNew).map((n) => n.id));
  const edgeTo = new Map(edges.map((e) => [e.to, e]));
  const children = new Map<string, string[]>();
  for (const e of edges) children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
  const sf: StageFamily = {
    fam, pos, byId, edges, edgeTo, children, newIds,
    bounds: boxOfPoints(all, NODE_R + 60),
    beforeBounds: boxOfPoints(fam.nodes.filter((n) => !n.isNew).map((n) => pos.get(n.id)!), NODE_R + 60),
    palette: familyPalette(fam.themeColor, fam.id),
  };
  cache.set(fam, sf);
  return sf;
}

/** Two short lines for a name label: given name, then the rest. */
export function labelLines(label: string): [string, string] {
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 1) return [label, ''];
  return [parts[0], parts.slice(1).join(' ')];
}

/**
 * The real ancestry path (root first) as one polyline built from the actual
 * edges between consecutive ids. Pairs with no edge are skipped, never drawn.
 */
export function lineagePoly(sf: StageFamily, ids: readonly string[]): Poly {
  const parts: Poly[] = [];
  for (let i = 1; i < ids.length; i++) {
    const e = sf.edgeTo.get(ids[i]);
    if (e && e.from === ids[i - 1]) parts.push(e.poly);
  }
  return concatPolys(parts);
}

/** Family-specific (but deterministic) seed for drift and decoration. */
export const familySeed = (fam: { id: string }) => hashId(fam.id) % 997;
