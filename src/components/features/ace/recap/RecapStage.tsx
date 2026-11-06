import React from 'react';
import type { AceRecapPresentation } from '../../../../lib/aceRecap/recapSnapshot';
import type { RecapScene, RecapTimeline, TransitionKind } from '../../../../lib/aceRecap/recapTimeline';
import { scenesAt } from '../../../../lib/aceRecap/recapTimeline';
import { GOLD, INK, STAGE_H, STAGE_W, stageFamily } from './stageModel';
import { ease, lerp } from './motion/easing';
import { MONO } from './motion/Kinetic';
import { Grain } from './motion/Texture';
import { THREAD_CORE } from './motion/ThreadPath';
import { Finale } from './scenes/Finale';
import { FamilyMoment } from './scenes/FamilyMoment';
import { Hero } from './scenes/Hero';
import { Hook } from './scenes/Hook';
import { displayFamilyName } from './scenes/shared';

export { displayFamilyName };

/**
 * The ACE annual recap as a pure function of the frame number.
 *
 * A compositor: it asks the timeline which scenes are on screen, renders the
 * outgoing scene underneath during an entrance overlap, and reveals the
 * incoming one through its transition (match / iris / thread wipe). No
 * timers, no network: Remotion renders it into the MP4 and AceRecapPlayer
 * drives the same component from a clock. Fixed 1920×1080; callers scale it.
 */

export const PRIVATE_WATERMARK = 'Private preview · not published · pending ACE Chair approval';

export interface RecapStageProps {
  presentation: AceRecapPresentation;
  timeline: RecapTimeline;
  frame: number;
  /**
   * Banner text. A private-preview presentation ALWAYS shows a banner: null
   * or an empty string falls back to the default and cannot remove it.
   * Only a 'published' presentation may hide it (null).
   */
  watermark?: string | null;
}

export function resolveWatermark(presentation: Pick<AceRecapPresentation, 'visibility'>, watermark?: string | null): string | null {
  if (presentation.visibility === 'private-preview') return watermark && watermark.trim() ? watermark : PRIVATE_WATERMARK;
  return watermark ?? null;
}

function Transition({ kind, p, accent, children }: { kind: TransitionKind; p: number; accent: string; children: React.ReactNode }) {
  if (kind === 'iris') {
    const r = Math.hypot(STAGE_W, STAGE_H) * 0.56 * ease.inOutCubic(p);
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: `circle(${r}px at 50% 52%)` }}>{children}</div>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
          <circle cx={STAGE_W / 2} cy={STAGE_H * 0.52} r={r} fill="none" stroke={accent} strokeWidth={4} opacity={1 - p} />
          <circle cx={STAGE_W / 2} cy={STAGE_H * 0.52} r={r + 18} fill="none" stroke={GOLD} strokeWidth={1.5} opacity={(1 - p) * 0.6} />
        </svg>
      </div>
    );
  }
  if (kind === 'thread') {
    // A diagonal wipe whose leading edge is the thread itself.
    const x = lerp(-0.25 * STAGE_W, 1.25 * STAGE_W, ease.inOutCubic(p));
    const slant = 260;
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${x + slant}px 0, ${x - slant}px 100%, 0 100%)` }}>{children}</div>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
          <line x1={x + slant} y1={0} x2={x - slant} y2={STAGE_H} stroke={accent} strokeWidth={14} opacity={0.18} />
          <line x1={x + slant} y1={0} x2={x - slant} y2={STAGE_H} stroke={GOLD} strokeWidth={3} />
          <circle cx={lerp(x + slant, x - slant, 0.5)} cy={STAGE_H / 2} r={7} fill={THREAD_CORE} />
        </svg>
      </div>
    );
  }
  // 'match': the incoming scene carries the continuity itself; a short dissolve.
  return <div style={{ position: 'absolute', inset: 0, opacity: kind === 'none' ? 1 : ease.inOutCubic(p) }}>{children}</div>;
}

function SceneView({ scene, local, presentation, familyTotal }: { scene: RecapScene; local: number; presentation: AceRecapPresentation; familyTotal: number }) {
  const fam = presentation.families.find((x) => x.id === scene.familyId) ?? null;
  switch (scene.kind) {
    case 'hook': return <Hook f={local} d={scene.durationInFrames} cycleLabel={presentation.cycle.label} />;
    case 'hero': return fam ? <Hero f={local} fam={fam} scene={scene} cycleLabel={presentation.cycle.label} /> : null;
    case 'family': return fam ? <FamilyMoment f={local} fam={fam} scene={scene} total={familyTotal} /> : null;
    case 'finale': return <Finale f={local} d={scene.durationInFrames} presentation={presentation} />;
    default: return null;
  }
}

export function RecapStage({ presentation, timeline, frame, watermark }: RecapStageProps) {
  const layers = scenesAt(timeline, frame);
  const familyTotal = timeline.scenes.filter((s) => s.kind === 'hero' || s.kind === 'family').length;
  const mark = resolveWatermark(presentation, watermark);
  return (
    <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: INK }}>
      {layers.map(({ scene, local, enter }) => {
        const fam = presentation.families.find((x) => x.id === scene.familyId);
        const accent = fam ? stageFamily(fam).palette.accent : GOLD;
        const view = <SceneView scene={scene} local={local} presentation={presentation} familyTotal={familyTotal} />;
        return (
          <div key={`${scene.kind}-${scene.from}`} style={{ position: 'absolute', inset: 0 }}>
            {enter === null ? view : <Transition kind={scene.transitionIn} p={enter} accent={accent}>{view}</Transition>}
          </div>
        );
      })}
      <Grain frame={frame} opacity={0.05} />
      {mark && (
        <div style={{
          position: 'absolute', top: 28, right: 36, textAlign: 'right', fontFamily: MONO, fontSize: 14,
          letterSpacing: '0.14em', color: 'rgba(255,246,230,0.66)', textTransform: 'uppercase', lineHeight: 1.6,
          textShadow: '0 1px 6px rgba(0,0,0,0.6)',
        }}>
          <div>{mark}</div>
          {presentation.visibility === 'private-preview' && presentation.totals.queued > 0 && (
            <div style={{ opacity: 0.78 }}>{presentation.totals.queued} pairings held for review · not shown</div>
          )}
        </div>
      )}
    </div>
  );
}
