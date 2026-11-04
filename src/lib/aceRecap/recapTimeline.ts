import type { AceRecapSnapshot, RecapFamily } from './recapSnapshot';

/**
 * Scene plan shared by the recap video (Remotion) and the in-site recap
 * player. Pure: frame numbers only, no rendering. Durations scale with the
 * real number of families and new Littles, so next year's recap re-plans
 * itself from next year's snapshot.
 */

export type RecapSceneKind = 'opening' | 'origins' | 'lineage' | 'growth' | 'expansion' | 'spotlight' | 'finale';

export interface RecapScene {
  kind: RecapSceneKind;
  familyId: string | null;
  from: number;
  durationInFrames: number;
}

export interface RecapTimeline {
  fps: number;
  durationInFrames: number;
  heroFamilyId: string | null;
  scenes: RecapScene[];
}

export interface RecapTimelineOptions {
  fps?: number;
  /** Soft cap; spotlights shrink (never below their minimum) to fit. */
  maxSeconds?: number;
}

export const RECAP_SECONDS = {
  opening: 6.5,
  origins: 5,
  lineage: 5.5,
  growthPerBig: 1.6,
  growthMin: 6,
  growthMax: 20,
  expansion: 5.5,
  spotlightBase: 4.2,
  spotlightPerLittle: 0.25,
  spotlightMin: 5,
  spotlightMax: 7.5,
  finale: 9,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Active families that gain Littles, biggest growth first. */
export function growingFamilies(snapshot: Pick<AceRecapSnapshot, 'families'>): RecapFamily[] {
  return snapshot.families
    .filter((f) => !f.archived && f.added > 0)
    .sort((a, b) => b.added - a.added || b.after.people - a.after.people || a.name.localeCompare(b.name));
}

export function planRecapTimeline(
  snapshot: Pick<AceRecapSnapshot, 'families'>,
  { fps = 30, maxSeconds = 95 }: RecapTimelineOptions = {},
): RecapTimeline {
  const fams = growingFamilies(snapshot);
  const hero = fams[0] ?? null;
  const others = fams.slice(1);
  const S = RECAP_SECONDS;
  const growthSeconds = hero ? clamp(hero.growth.length * S.growthPerBig + 2, S.growthMin, S.growthMax) : 0;
  const fixed = S.opening + S.finale + (hero ? S.origins + S.lineage + growthSeconds + S.expansion : 0);
  let spotlights = others.map((f) => clamp(S.spotlightBase + f.added * S.spotlightPerLittle, S.spotlightMin, S.spotlightMax));
  const budget = maxSeconds - fixed;
  const total = spotlights.reduce((a, b) => a + b, 0);
  if (total > budget && total > 0) {
    const scale = Math.max(budget, others.length * S.spotlightMin) / total;
    spotlights = spotlights.map((s) => Math.max(S.spotlightMin, s * scale));
  }

  const scenes: RecapScene[] = [];
  let cursor = 0;
  const push = (kind: RecapSceneKind, familyId: string | null, seconds: number) => {
    const durationInFrames = Math.round(seconds * fps);
    scenes.push({ kind, familyId, from: cursor, durationInFrames });
    cursor += durationInFrames;
  };
  push('opening', null, S.opening);
  if (hero) {
    push('origins', hero.id, S.origins);
    push('lineage', hero.id, S.lineage);
    push('growth', hero.id, growthSeconds);
    push('expansion', hero.id, S.expansion);
  }
  others.forEach((f, i) => push('spotlight', f.id, spotlights[i]));
  push('finale', null, S.finale);
  return { fps, durationInFrames: cursor, heroFamilyId: hero?.id ?? null, scenes };
}

export interface CameraBox { x: number; y: number; width: number; height: number }

/** Bounding box (layout units) of the given node ids, padded. */
export function boxOf(family: RecapFamily, ids: ReadonlySet<string> | null, pad = 0.75): CameraBox {
  const pts = family.nodes.filter((n) => !ids || ids.has(n.id));
  const list = pts.length ? pts : family.nodes;
  const xs = list.map((n) => n.x);
  const ys = list.map((n) => n.y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}
