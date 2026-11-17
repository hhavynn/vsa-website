import type { AceRecapPresentation, RecapPresentationFamily } from './recapSnapshot';

/**
 * Scene plan shared by the recap video (Remotion) and the in-site player.
 * Pure: frame numbers only, no rendering. Durations scale with the real
 * number of families, lineage depth and new Littles, so next year's recap
 * re-plans itself from next year's snapshot.
 *
 * Scenes sit end to end. A scene's `overlapIn` frames are its entrance
 * transition: during them the previous scene keeps rendering underneath
 * (past its own end) while the incoming one is revealed through the named
 * transition, so cuts are motivated instead of fade-to-black.
 */

export type RecapSceneKind = 'hook' | 'hero' | 'family' | 'finale';
/** How a family's moment is staged, chosen from its real graph shape and growth. */
export type FamilyTreatment = 'sweep' | 'dive' | 'rise' | 'portrait';
export type TransitionKind = 'none' | 'match' | 'iris' | 'thread';

export interface HeroPhases {
  /** Frames spent travelling root → Big along the real lineage. */
  lineage: number;
  /** Big introduced, new branches grow to their Littles. */
  reveal: number;
  /** Other Bigs bloom while the camera pulls back to the whole family. */
  expand: number;
}

export interface RecapScene {
  kind: RecapSceneKind;
  familyId: string | null;
  from: number;
  durationInFrames: number;
  overlapIn: number;
  transitionIn: TransitionKind;
  treatment?: FamilyTreatment;
  /** For 'sweep': pan direction. */
  reverse?: boolean;
  /** Position among family scenes (hero is 0). */
  familyIndex?: number;
  phases?: HeroPhases;
}

export interface RecapTimeline {
  fps: number;
  durationInFrames: number;
  heroFamilyId: string | null;
  scenes: RecapScene[];
}

export interface RecapTimelineOptions {
  fps?: number;
  /** Soft cap; family moments shrink (never below their minimum) to fit. */
  maxSeconds?: number;
}

export const RECAP_SECONDS = {
  hook: 7,
  lineageBase: 1.4,
  lineagePerGeneration: 0.32,
  lineageMin: 3.6,
  lineageMax: 6.2,
  revealBase: 3.6,
  revealPerLittle: 0.75,
  revealMin: 5,
  revealMax: 7,
  expandBase: 4.2,
  expandPerLittle: 0.08,
  expandMax: 6.8,
  familyBase: 4.6,
  familyPerLittle: 0.1,
  familyMin: 4.8,
  familyMax: 6.8,
  portrait: 5,
  finaleBase: 8.5,
  finalePerFamily: 0.25,
  finaleMax: 12,
  overlap: 0.6,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Active families that gain Littles, biggest growth first. */
export function growingFamilies(snapshot: Pick<AceRecapPresentation, 'families'>): RecapPresentationFamily[] {
  return snapshot.families
    .filter((f) => !f.archived && f.added > 0)
    .sort((a, b) => b.added - a.added || b.after.people - a.after.people || a.name.localeCompare(b.name));
}

/** Every active family, for the finale. Nothing is dropped, whatever the count. */
export function finaleFamilies(snapshot: Pick<AceRecapPresentation, 'families'>): RecapPresentationFamily[] {
  return snapshot.families
    .filter((f) => !f.archived)
    .sort((a, b) => b.added - a.added || b.after.people - a.after.people || a.name.localeCompare(b.name));
}

/** The Big the hero sequence follows: most new Littles, then the longest real lineage. */
export function heroGrowth(family: RecapPresentationFamily) {
  return [...family.growth].sort((a, b) =>
    b.littleIds.length - a.littleIds.length || b.lineage.length - a.lineage.length || a.bigLabel.localeCompare(b.bigLabel))[0] ?? null;
}

/**
 * Treatments rotate so neighbouring families never repeat a staging.
 * Tiny growth (≤ 2 Littles) gets an intimate portrait; the rest cycle through
 * sweep / dive / rise.
 */
export function assignTreatments(families: readonly RecapPresentationFamily[]): FamilyTreatment[] {
  const cycle: FamilyTreatment[] = ['sweep', 'dive', 'rise'];
  const out: FamilyTreatment[] = [];
  let next = 0;
  for (const fam of families) {
    let t: FamilyTreatment = fam.added <= 2 ? 'portrait' : cycle[next % cycle.length];
    if (t !== 'portrait') {
      if (out.length && out[out.length - 1] === t) { next += 1; t = cycle[next % cycle.length]; }
      next += 1;
    }
    out.push(t);
  }
  return out;
}

export function planRecapTimeline(
  snapshot: Pick<AceRecapPresentation, 'families'>,
  { fps = 30, maxSeconds = 95 }: RecapTimelineOptions = {},
): RecapTimeline {
  const S = RECAP_SECONDS;
  const fams = growingFamilies(snapshot);
  const hero = fams[0] ?? null;
  const others = fams.slice(1);
  const f = (s: number) => Math.round(s * fps);

  let phases: HeroPhases | undefined;
  if (hero) {
    const g = heroGrowth(hero);
    phases = {
      lineage: f(clamp(S.lineageBase + (g?.lineage.length ?? 1) * S.lineagePerGeneration, S.lineageMin, S.lineageMax)),
      reveal: f(clamp(S.revealBase + (g?.littleIds.length ?? 1) * S.revealPerLittle, S.revealMin, S.revealMax)),
      expand: f(clamp(S.expandBase + hero.added * S.expandPerLittle, S.expandBase, S.expandMax)),
    };
  }
  const treatments = assignTreatments(others);
  let familySeconds = others.map((fam, i) => treatments[i] === 'portrait'
    ? S.portrait
    : clamp(S.familyBase + fam.added * S.familyPerLittle, S.familyMin, S.familyMax));
  const finaleSeconds = clamp(S.finaleBase + finaleFamilies(snapshot).length * S.finalePerFamily, S.finaleBase, S.finaleMax);
  const heroSeconds = phases ? (phases.lineage + phases.reveal + phases.expand) / fps : 0;
  const budget = maxSeconds - S.hook - heroSeconds - finaleSeconds;
  const total = familySeconds.reduce((a, b) => a + b, 0);
  if (total > budget && total > 0) {
    const scale = Math.max(budget, others.length * S.familyMin) / total;
    familySeconds = familySeconds.map((s) => Math.max(S.familyMin, s * scale));
  }

  const scenes: RecapScene[] = [];
  let cursor = 0;
  const overlap = f(S.overlap);
  const push = (scene: Omit<RecapScene, 'from' | 'overlapIn'> & { overlapIn?: number }) => {
    const overlapIn = scenes.length === 0 || scene.transitionIn === 'none' ? 0 : scene.overlapIn ?? overlap;
    scenes.push({ ...scene, from: cursor, overlapIn });
    cursor += scene.durationInFrames;
  };
  push({ kind: 'hook', familyId: null, durationInFrames: f(S.hook), transitionIn: 'none' });
  if (hero && phases) {
    push({
      kind: 'hero', familyId: hero.id, familyIndex: 0, transitionIn: 'match', overlapIn: f(0.8),
      durationInFrames: phases.lineage + phases.reveal + phases.expand, phases,
    });
  }
  let sweeps = 0;
  others.forEach((fam, i) => {
    const treatment = treatments[i];
    push({
      kind: 'family', familyId: fam.id, familyIndex: i + 1, treatment,
      reverse: treatment === 'sweep' ? sweeps++ % 2 === 1 : undefined,
      transitionIn: i % 2 === 0 ? 'iris' : 'thread',
      durationInFrames: f(familySeconds[i]),
    });
  });
  push({ kind: 'finale', familyId: null, durationInFrames: f(finaleSeconds), transitionIn: 'thread', overlapIn: f(0.8) });
  return { fps, durationInFrames: cursor, heroFamilyId: hero?.id ?? null, scenes };
}

/** Scenes visible at `frame`: the current one, plus the outgoing one during an entrance overlap. */
export function scenesAt(timeline: RecapTimeline, frame: number): Array<{ scene: RecapScene; local: number; enter: number | null }> {
  const i = timeline.scenes.findIndex((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  const idx = i >= 0 ? i : frame < 0 ? 0 : timeline.scenes.length - 1;
  const current = timeline.scenes[idx];
  if (!current) return [];
  const local = frame - current.from;
  const out: Array<{ scene: RecapScene; local: number; enter: number | null }> = [];
  const entering = current.overlapIn > 0 && local < current.overlapIn;
  if (entering && idx > 0) {
    const prev = timeline.scenes[idx - 1];
    out.push({ scene: prev, local: frame - prev.from, enter: null });
  }
  out.push({ scene: current, local, enter: entering ? local / current.overlapIn : null });
  return out;
}
