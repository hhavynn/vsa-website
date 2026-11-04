import React from 'react';
import type { RecapPresentationFamily } from '../../../../../lib/aceRecap/recapSnapshot';
import type { RecapScene } from '../../../../../lib/aceRecap/recapTimeline';
import { STAGE_H, STAGE_W, GOLD, boxOfIds, familySeed, fitCamera, lineagePoly, stageFamily, toScreen } from '../stageModel';
import type { Box, Camera, StageFamily } from '../stageModel';
import { cameraAt, clamp01, drift, ease, seg } from '../motion/easing';
import type { CameraKey } from '../motion/easing';
import { DashedFrame, KineticText, MONO, SERIF } from '../motion/Kinetic';
import { NightSky, PAPER, Paper, Vignette } from '../motion/Texture';
import { ThreadPath } from '../motion/ThreadPath';
import { pointAt, samplePath } from '../motion/thread';
import { TreeLayer, LOD_SCALE } from '../TreeLayer';
import { Callouts, FamilyTitle, Metrics, Scrim, displayFamilyName } from './shared';

const FIT_REGION: Box = { x: 70, y: 210, w: 1780, h: 540 };
/** Portrait: the paper typographic card holds for most of the moment. */
const portraitPaperEnd = (d: number) => Math.round(d * 0.62);

interface MomentPlan {
  sf: StageFamily;
  cams: CameraKey[];
  bloomStart: Map<string, number>;
  /** Real lineage drawn as the thread for this treatment (root first), if any. */
  thread?: { poly: ReturnType<typeof lineagePoly>; from: number; to: number; reverse?: boolean };
  titleAt: number;
  metricsAt: number;
  fitAt: number;
}

const biggest = (sf: StageFamily) =>
  [...sf.fam.growth].sort((a, b) => b.littleIds.length - a.littleIds.length || b.lineage.length - a.lineage.length || a.bigLabel.localeCompare(b.bigLabel))[0];

/** Other groups bloom outward from a focal point, so growth reads as spreading. */
function ripple(sf: StageFamily, from: { x: number; y: number }, start: number, span: number, skip?: string): Map<string, number> {
  const out = new Map<string, number>();
  const rest = sf.fam.growth.filter((g) => g.bigNodeId !== skip)
    .map((g) => ({ g, d: Math.hypot(sf.pos.get(g.bigNodeId)!.x - from.x, sf.pos.get(g.bigNodeId)!.y - from.y) }))
    .sort((a, b) => a.d - b.d);
  const step = rest.length ? Math.min(8, span / rest.length) : 0;
  rest.forEach(({ g }, i) => g.littleIds.forEach((id, j) => out.set(id, start + i * step + j * 3)));
  return out;
}

export function planMoment(fam: RecapPresentationFamily, scene: RecapScene): MomentPlan {
  const sf = stageFamily(fam);
  const d = scene.durationInFrames;
  const fit = fitCamera(sf.bounds, FIT_REGION, 1, 0.96);
  const g = biggest(sf);
  const bigPos = sf.pos.get(g.bigNodeId)!;
  const groupBox = boxOfIds(sf, [g.bigNodeId, ...g.littleIds], 190);
  const groupCam = fitCamera(groupBox, { x: 560, y: 160, w: 1240, h: 640 }, 1.15, 0.9);
  const at = (t: number) => Math.round(d * t);
  switch (scene.treatment) {
    case 'sweep': {
      const xs = [...sf.newIds].map((id) => sf.pos.get(id)!.x);
      const ys = [...sf.newIds].map((id) => sf.pos.get(id)!.y);
      const minX = Math.min(...xs) - 140;
      const maxX = Math.max(...xs) + 140;
      const bandY = ys.reduce((a, b) => a + b, 0) / ys.length - 70;
      const s = Math.max(0.46, Math.min(0.8, 4600 / Math.max(1, maxX - minX)));
      const [x0, x1] = scene.reverse ? [maxX, minX] : [minX, maxX];
      const sweepEnd = at(0.68);
      const cams: CameraKey[] = [
        { f: 0, cx: x0 + (scene.reverse ? -1 : 1) * 700 / s, cy: bandY, s: s * 0.92, r: scene.reverse ? 1.2 : -1.2 },
        { f: at(0.08), cx: x0 + (scene.reverse ? -1 : 1) * 520 / s, cy: bandY, s, r: 0, ease: ease.outCubic },
        { f: sweepEnd, cx: x1 - (scene.reverse ? -1 : 1) * 520 / s, cy: bandY, s, ease: ease.inOutCubic },
        { f: at(0.84), ...fit, ease: ease.inOutExpo },
        { f: d, ...fit, s: fit.s * 1.02, ease: ease.linear },
      ];
      const bloomStart = new Map<string, number>();
      for (const id of sf.newIds) {
        const x = sf.pos.get(id)!.x;
        const t = clamp01((x - Math.min(x0, x1)) / Math.max(1, Math.abs(x1 - x0)));
        bloomStart.set(id, Math.round(at(0.05) + (scene.reverse ? 1 - t : t) * (sweepEnd - at(0.12))));
      }
      return { sf, cams, bloomStart, titleAt: 2, metricsAt: Math.min(at(0.76), d - 44), fitAt: at(0.84) };
    }
    case 'dive': {
      const poly = lineagePoly(sf, g.lineage);
      const rootPos = sf.pos.get(g.lineage[0])!;
      const whip0 = at(0.2);
      const whip1 = at(0.42);
      const cams: CameraKey[] = [
        { f: 0, cx: rootPos.x - 260, cy: rootPos.y + 120, s: 1.05 },
        { f: whip0, cx: rootPos.x - 230, cy: rootPos.y + 150, s: 1.1, ease: ease.linear },
        { f: whip1, ...groupCam, ease: ease.inOutExpo },
        { f: at(0.6), ...groupCam, s: groupCam.s * 1.05, ease: ease.linear },
        { f: at(0.82), ...fit, ease: ease.inOutCubic },
        { f: d, ...fit, s: fit.s * 1.02, ease: ease.linear },
      ];
      const bloomStart = ripple(sf, bigPos, at(0.6), at(0.22), g.bigNodeId);
      g.littleIds.forEach((id, i) => bloomStart.set(id, whip1 - 4 + i * 10));
      return { sf, cams, bloomStart, thread: { poly, from: whip0 - 4, to: whip1 }, titleAt: 4, metricsAt: Math.min(at(0.74), d - 44), fitAt: at(0.82) };
    }
    case 'rise': {
      const poly = lineagePoly(sf, g.lineage);
      const rootPos = sf.pos.get(g.lineage[0])!;
      const rise0 = at(0.3);
      const rise1 = at(0.58);
      const top: Camera = { cx: rootPos.x, cy: rootPos.y + 140, s: 0.82 };
      const cams: CameraKey[] = [
        { f: 0, ...groupCam, s: groupCam.s * 1.12 },
        { f: rise0, ...groupCam, ease: ease.outCubic },
        { f: rise1, ...top, ease: ease.inOutExpo },
        { f: at(0.82), ...fit, ease: ease.inOutCubic },
        { f: d, ...fit, s: fit.s * 1.02, ease: ease.linear },
      ];
      const bloomStart = ripple(sf, rootPos, at(0.6), at(0.22), g.bigNodeId);
      g.littleIds.forEach((id, i) => bloomStart.set(id, 6 + i * 10));
      return { sf, cams, bloomStart, thread: { poly, from: rise0, to: rise1, reverse: true }, titleAt: 4, metricsAt: Math.min(at(0.74), d - 44), fitAt: at(0.82) };
    }
    default: { // portrait
      const paperEnd = portraitPaperEnd(d);
      const cams: CameraKey[] = [
        { f: 0, ...groupCam, s: groupCam.s * 1.08 },
        { f: paperEnd + 6, ...groupCam, ease: ease.linear },
        { f: at(0.8), ...groupCam, s: groupCam.s * 1.04, ease: ease.linear },
        { f: at(0.93), ...fit, ease: ease.inOutCubic },
        { f: d, ...fit, s: fit.s * 1.02, ease: ease.linear },
      ];
      const bloomStart = ripple(sf, bigPos, at(0.8), at(0.08), g.bigNodeId);
      g.littleIds.forEach((id, i) => bloomStart.set(id, paperEnd - 6 + i * 8));
      return { sf, cams, bloomStart, titleAt: 0, metricsAt: Math.min(at(0.84), d - 40), fitAt: at(0.93) };
    }
  }
}

/** The typographic paper card for an intimate (1–2 Littles) family. */
function PortraitCard({ f, sf, fam, d, index, total }: { f: number; sf: StageFamily; fam: RecapPresentationFamily; d: number; index: number; total: number }) {
  const g = biggest(sf);
  const littles = g.littleIds.map((id) => sf.byId.get(id)?.label ?? '');
  const end = portraitPaperEnd(d);
  const iris = ease.inOutCubic(seg(f, end - 14, 20));
  if (iris >= 1) return null;
  const ink = PAPER.ink;
  const bigSize = Math.min(180, 2400 / Math.max(10, g.bigLabel.length));
  const nameEnd = Math.min(1500, 200 + g.bigLabel.length * bigSize * 0.44);
  const ul = 230 + bigSize * 1.12;
  const littleAt = { x: Math.min(1300, nameEnd - 60), y: ul + 190 };
  // Big → Little: the underline under the Big's name bends down into the Little.
  const connector = samplePath(`M200 ${ul} L${littleAt.x - 160} ${ul} C${littleAt.x - 40} ${ul} ${littleAt.x} ${ul + 30} ${littleAt.x} ${littleAt.y - 14}`, 24);
  const draw = ease.inOutCubic(seg(f, 24, 26));
  const littleSize = littles.length > 1 ? 84 : 104;
  const radius = Math.hypot(STAGE_W, STAGE_H) * (1 - iris);
  return (
    <div style={{ position: 'absolute', inset: 0, clipPath: iris > 0 ? `circle(${radius}px at ${littleAt.x}px ${littleAt.y}px)` : undefined }}>
      <Paper frame={f} />
      <div style={{ position: 'absolute', left: 200, top: 170, fontFamily: MONO, fontSize: 20, color: 'rgba(27,31,63,0.62)' }}>
        <KineticText text={`FAMILY ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${displayFamilyName(fam.name).toUpperCase()}`} f={f} start={2} stagger={0.5} dur={10}
          from={{ opacity: 0 }} tracking={[0.7, 0.3]} trackDur={30} ease={ease.linear} />
      </div>
      <div style={{ position: 'absolute', left: 196, top: 222, fontFamily: SERIF, fontSize: bigSize, lineHeight: 1.02, color: ink, whiteSpace: 'nowrap' }}>
        <KineticText text={g.bigLabel} f={f} start={6} stagger={1.4} dur={20} jitter={4} from={{ y: 0.7, rot: -6, scale: 1.2, opacity: 0 }} ease={ease.outBack} />
      </div>
      <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <ThreadPath id={`pc-${fam.id}`} poly={connector} t1={draw} color={ink} width={4} head={false} />
        {draw >= 1 && <circle cx={littleAt.x} cy={littleAt.y} r={14 * ease.outBack(seg(f, 50, 10))} fill="#7a5fc0" />}
      </svg>
      <div style={{ position: 'absolute', left: littleAt.x + 46, top: littleAt.y - littleSize * 0.62, fontFamily: SERIF, fontStyle: 'italic', fontSize: littleSize, lineHeight: 1.05, color: '#7a5fc0', whiteSpace: 'nowrap' }}>
        {littles.map((l, i) => (
          <div key={l}><KineticText text={l} f={f} start={52 + i * 10} stagger={1.2} dur={16} mask from={{ y: 1, opacity: 1 }} ease={ease.outQuint} /></div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: littleAt.x + 50, top: littleAt.y - littleSize * 0.62 - 34, fontFamily: MONO, fontSize: 16, letterSpacing: '0.24em', color: 'rgba(27,31,63,0.6)', opacity: seg(f, 60, 10) }}>
        NEW LITTLE{littles.length > 1 ? 'S' : ''} · {fam.name.toUpperCase()}
      </div>
      <DashedFrame x={littleAt.x + 30} y={littleAt.y - littleSize * 0.62 - 8} w={Math.max(...littles.map((l) => l.length)) * littleSize * 0.42 + 40}
        h={littles.length * littleSize * 1.05 + 18} f={f} start={64} dur={14} color="rgba(27,31,63,0.5)" />
    </div>
  );
}

export function FamilyMoment({ f, fam, scene, total }: { f: number; fam: RecapPresentationFamily; scene: RecapScene; total: number }) {
  const plan = React.useMemo(() => planMoment(fam, scene), [fam, scene]);
  const { sf, cams, bloomStart, thread, titleAt, metricsAt, fitAt } = plan;
  const d = scene.durationInFrames;
  const seed = familySeed(fam);
  const dr = drift(f, seed, 5);
  const base = cameraAt(cams, f);
  const cam: Camera = { ...base, cx: base.cx + dr.x / base.s, cy: base.cy + dr.y / base.s };
  const index = (scene.familyIndex ?? 0) + 1;
  const threadT = thread ? ease.inOutExpo(seg(f, thread.from, thread.to - thread.from)) : 0;
  const threadPoly = thread ? (thread.reverse ? [...thread.poly].reverse() : thread.poly) : [];
  const lit = new Set<string>();
  if (thread && threadT > 0) {
    const g = biggest(sf);
    const ids = thread.reverse ? [...g.lineage].reverse() : g.lineage;
    ids.forEach((id, i) => { if (i / Math.max(1, ids.length - 1) <= threadT + 0.02) lit.add(id); });
  }
  const titlePos = scene.treatment === 'dive' ? 'left-middle' : scene.treatment === 'rise' ? 'top-right' : 'top-left';
  const head = threadPoly.length > 1 && threadT > 0 && threadT < 1 ? pointAt(threadPoly, threadT) : null;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <NightSky frame={f + (seed % 300)} cam={cam} tint={sf.palette.accent} />
      <TreeLayer id={`fm-${scene.familyIndex}`} sf={sf} cam={cam} look={{
        frame: f, dim: f >= fitAt ? 0.75 : 0.5,
        existing: () => seg(f, 0, 10),
        highlight: (id) => (lit.has(id) ? 0.9 : 0),
        bloom: (id) => { const s = bloomStart.get(id); return s === undefined ? -1 : seg(f, s, 34); },
        labels: f < fitAt ? 'auto' : 'none',
        newLabels: cam.s > LOD_SCALE,
      }} />
      {thread && threadPoly.length > 1 && threadT > 0 && (
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
          <g transform={`translate(${STAGE_W / 2} ${STAGE_H / 2}) rotate(${cam.r ?? 0}) scale(${cam.s}) translate(${-cam.cx} ${-cam.cy})`}>
            <ThreadPath id={`fmt-${scene.familyIndex}`} poly={threadPoly} t1={threadT} scale={cam.s} width={3.4} opacity={1 - seg(f, thread.to + 10, 14)} />
          </g>
        </svg>
      )}
      {head && scene.treatment === 'rise' && (
        <div style={{ position: 'absolute', left: toScreen(cam, head).x + 40, top: toScreen(cam, head).y - 70, fontFamily: MONO, fontSize: 18, letterSpacing: '0.24em', color: GOLD }}>
          {biggest(sf).lineage.length - 1} GENERATIONS ABOVE
        </div>
      )}
      <Scrim side="bottom" strength={f >= metricsAt - 10 ? 1 : 0.6} />
      {scene.treatment !== 'portrait' && (
        <>
          <Scrim side={titlePos === 'left-middle' ? 'left' : 'top'} strength={titlePos === 'left-middle' ? 1 - seg(f, Math.round(d * 0.2), 12) : 1} />
          {titlePos === 'left-middle' && f < Math.round(d * 0.24) && (
            <FamilyTitle f={f} start={titleAt} fam={fam} index={index} total={total} accent={sf.palette.accent} position="left-middle" size={150} />
          )}
          {(titlePos !== 'left-middle' || f >= Math.round(d * 0.24)) && (
            <FamilyTitle f={titlePos === 'left-middle' ? f - Math.round(d * 0.24) : f} start={titleAt} fam={fam} index={index} total={total}
              accent={sf.palette.accent} position={titlePos === 'left-middle' ? 'top-left' : titlePos} size={110} />
          )}
        </>
      )}
      {scene.treatment === 'portrait' && f >= portraitPaperEnd(d) && (
        <>
          <Scrim side="top" />
          <FamilyTitle f={f - portraitPaperEnd(d)} start={0} fam={fam} index={index} total={total} accent={sf.palette.accent} position="top-left" size={110} />
        </>
      )}
      <Callouts sf={sf} cam={cam} f={f} start={fitAt + 6} max={scene.treatment === 'sweep' ? 3 : 2} />
      {f >= metricsAt && <Metrics f={f} start={metricsAt} fam={fam} compact />}
      <Vignette strength={0.5} />
      {scene.treatment === 'portrait' && <PortraitCard f={f} sf={sf} fam={fam} d={d} index={index} total={total} />}
      {/* Readable count while the camera is moving, before the metrics land. */}
      {f < metricsAt && scene.treatment !== 'portrait' && [...bloomStart.values()].some((s) => f >= s + 18) && (
        <div style={{ position: 'absolute', right: 120, bottom: 96, textAlign: 'right' }}>
          <div style={{ fontFamily: SERIF, fontSize: 104, lineHeight: 1, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
            +{[...bloomStart.values()].filter((s) => f >= s + 18).length}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.26em', color: 'rgba(255,246,230,0.7)' }}>NEW LITTLES · {displayFamilyName(fam.name).toUpperCase()}</div>
        </div>
      )}
    </div>
  );
}
