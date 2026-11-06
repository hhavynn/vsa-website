import React from 'react';
import type { RecapPresentationFamily } from '../../../../../lib/aceRecap/recapSnapshot';
import type { RecapScene } from '../../../../../lib/aceRecap/recapTimeline';
import { heroGrowth } from '../../../../../lib/aceRecap/recapTimeline';
import { STAGE_H, STAGE_W, CREAM, GOLD, boxOfIds, familySeed, fitCamera, lineagePoly, stageFamily, toScreen } from '../stageModel';
import type { Box, Camera, StageFamily } from '../stageModel';
import { cameraAt, clamp01, drift, ease, lerp, seg } from '../motion/easing';
import type { CameraKey } from '../motion/easing';
import { DashedFrame, KineticText, MONO, SANS, SERIF } from '../motion/Kinetic';
import { NightSky, Vignette } from '../motion/Texture';
import { ThreadPath } from '../motion/ThreadPath';
import { line, mapPoly, morph, pointAt } from '../motion/thread';
import { TreeLayer, LOD_SCALE } from '../TreeLayer';
import { HOOK_UNDERLINE } from './Hook';
import { Callouts, FamilyTitle, Metrics, Scrim, displayFamilyName } from './shared';

const FULL: Box = { x: 70, y: 150, w: 1780, h: 600 };

/** Path progress: a gentle start, a quick run through the early generations, a long soft landing. */
const travel = (t: number) => 0.55 * ease.inOutExpo(t) + 0.45 * ease.inOutCubic(t);

export interface HeroPlan {
  sf: StageFamily;
  lineage: string[];
  bigId: string;
  littleIds: string[];
  pathPoly: ReturnType<typeof lineagePoly>;
  cams: CameraKey[];
  revealBox: Box;
  bloomStart: Map<string, number>;
  L: number; R: number; E: number;
}

/** Everything frame-independent for the hero sequence. */
export function planHero(fam: RecapPresentationFamily, scene: RecapScene): HeroPlan | null {
  const g = heroGrowth(fam);
  if (!g || !scene.phases) return null;
  const sf = stageFamily(fam);
  const { lineage: L, reveal: R, expand: E } = scene.phases;
  const pathPoly = lineagePoly(sf, g.lineage);
  const bigPos = sf.pos.get(g.bigNodeId)!;
  const revealBox = boxOfIds(sf, [g.bigNodeId, ...g.littleIds], 170);
  const revealCam = fitCamera(revealBox, { x: 760, y: 120, w: 1080, h: 720 }, 1.2, 0.9);
  const full = fitCamera(sf.bounds, FULL, 1, 0.96);
  // Lineage camera: chase the thread head, zooming out mid-journey to show the branching.
  const cams: CameraKey[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const head = pathPoly.length > 1 ? pointAt(pathPoly, travel(t)) : bigPos;
    const s = lerp(1.25, 0.62, Math.sin(Math.PI * Math.min(t, 0.85) / 0.85) * 0.9) * (t > 0.85 ? lerp(1, 1.7, (t - 0.85) / 0.15) : 1);
    cams.push({ f: Math.round(t * L), cx: head.x + 160 / s * 0.6, cy: head.y + 40, s: Math.min(1.12, s), ease: ease.linear });
  }
  const arrive: Camera = { cx: bigPos.x + 90, cy: bigPos.y + 30, s: 1.12 };
  cams.push({ f: L + 4, ...arrive, ease: ease.outCubic });
  cams.push({ f: L + Math.round(R * 0.42), cx: arrive.cx + 10, cy: arrive.cy, s: 1.24, ease: ease.inOutCubic }); // slow push: the moment
  cams.push({ f: L + Math.round(R * 0.62), ...revealCam, ease: ease.inOutCubic });
  cams.push({ f: L + R, ...revealCam, s: revealCam.s * 0.97, ease: ease.linear });
  cams.push({ f: L + R + Math.round(E * 0.55), ...full, ease: ease.inOutCubic }); // the pull-out
  cams.push({ f: L + R + E, ...full, s: full.s * 1.03, ease: ease.linear });

  const bloomStart = new Map<string, number>();
  const revealAt = L + Math.round(R * 0.48);
  g.littleIds.forEach((id, i) => bloomStart.set(id, revealAt + i * 14));
  // The rest of the family blooms as a ripple outward from the hero Big.
  const rest = fam.growth.filter((x) => x.bigNodeId !== g.bigNodeId)
    .map((x) => ({ x, d: Math.hypot(sf.pos.get(x.bigNodeId)!.x - bigPos.x, sf.pos.get(x.bigNodeId)!.y - bigPos.y) }))
    .sort((a, b) => a.d - b.d);
  const rippleStart = L + R + Math.round(E * 0.12);
  const step = rest.length ? Math.min(7, (E * 0.42) / rest.length) : 0;
  rest.forEach(({ x }, i) => x.littleIds.forEach((id, j) => bloomStart.set(id, rippleStart + i * step + j * 3)));
  return { sf, lineage: g.lineage, bigId: g.bigNodeId, littleIds: g.littleIds, pathPoly, cams, revealBox, bloomStart, L, R, E };
}

export function Hero({ f, fam, scene, cycleLabel }: { f: number; fam: RecapPresentationFamily; scene: RecapScene; cycleLabel: string }) {
  const plan = React.useMemo(() => planHero(fam, scene), [fam, scene]);
  if (!plan) return null;
  const { sf, lineage, bigId, littleIds, pathPoly, cams, bloomStart, L, R, E } = plan;
  const seed = familySeed(fam);
  const dr = drift(f, seed, 5);
  const base = cameraAt(cams, f);
  const cam: Camera = { ...base, cx: base.cx + dr.x / base.s, cy: base.cy + dr.y / base.s };
  const pathT = f < L ? travel(clamp01(f / L)) : 1;
  const big = sf.byId.get(bigId)!;
  const reached = Math.min(lineage.length - 1, Math.floor(pathT * (lineage.length - 1) + 0.25));
  const lit = new Set(lineage.slice(0, reached + 1));
  const r = f - L; // reveal-local
  const e = f - L - R; // expand-local
  const bigScreen = toScreen(cam, sf.pos.get(bigId)!);
  const rightSide = bigScreen.x < STAGE_W * 0.55;
  const nameSize = Math.min(132, Math.max(76, 1500 / Math.max(big.label.length, 8)));
  const nameX = rightSide ? bigScreen.x + 110 : bigScreen.x - 110;
  const nameY = bigScreen.y - nameSize * 0.75;
  const nameW = big.label.length * nameSize * 0.42;
  // The last real edge into the Big peels off and becomes the name's underline.
  const lastEdge = sf.edgeTo.get(bigId);
  const underlineTarget = rightSide
    ? line({ x: nameX, y: nameY + nameSize + 18 }, { x: nameX + nameW, y: nameY + nameSize + 18 })
    : line({ x: nameX, y: nameY + nameSize + 18 }, { x: nameX - nameW, y: nameY + nameSize + 18 });
  const morphT = ease.inOutCubic(seg(r, 4, 22));
  const unmorph = ease.inCubic(seg(r, Math.round(R * 0.4), 12));
  const nameIn = r >= 0 && r < Math.round(R * 0.5);
  const growing = littleIds.filter((id) => f >= (bloomStart.get(id) ?? 1e9) + 20).length;
  const entering = f < scene.overlapIn; // the match transition out of the hook
  const matchT = ease.inOutCubic(clamp01(f / Math.max(1, scene.overlapIn)));
  const firstEdge = pathPoly.length > 1 ? pathPoly.slice(0, Math.max(2, Math.round(pathPoly.length * 0.1))) : [];

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <NightSky frame={f + 400} cam={cam} tint={sf.palette.accent} />
      {/* Parallax depth: the family name as a giant ghost plane behind the tree. */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', fontFamily: SERIF, fontSize: 520, lineHeight: 1,
        color: sf.palette.accent, opacity: 0.04,
        transform: `translate(${-cam.cx * cam.s * 0.18 + 120}px, ${-cam.cy * cam.s * 0.12 + 300}px)`,
      }}>{displayFamilyName(fam.name)}</div>
      <TreeLayer id="hero" sf={sf} cam={cam} look={{
        frame: f,
        existing: (_id, depth) => (e > 0 ? 1 : clamp01(1.4 - depth * 0.05 + f / 40)),
        dim: e > 0 ? lerp(0.4, 0.8, seg(e, 0, 30)) : 0.42,
        highlight: (id) => (lit.has(id) ? (id === bigId && f >= L ? 1 : e > 0 ? 0 : 0.85) : 0),
        labels: f < L ? 'emphasis' : 'auto',
        bloom: (id) => { const s = bloomStart.get(id); return s === undefined ? -1 : seg(f, s, 40); },
        newLabels: cam.s > LOD_SCALE,
      }} />
      <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {f < L + 30 && pathPoly.length > 1 && (
          <g transform={`translate(${STAGE_W / 2} ${STAGE_H / 2}) scale(${cam.s}) translate(${-cam.cx} ${-cam.cy})`}>
            <ThreadPath id="hero-lineage" poly={pathPoly} t1={pathT} scale={cam.s} width={3.6}
              opacity={1 - seg(f, L + 6, 20)} head={f < L} />
          </g>
        )}
        {entering && firstEdge.length > 1 && (
          <ThreadPath id="hero-match" width={3}
            poly={morph(line({ x: HOOK_UNDERLINE.x1, y: HOOK_UNDERLINE.y }, { x: HOOK_UNDERLINE.x2, y: HOOK_UNDERLINE.y }),
              mapPoly(firstEdge, (p) => toScreen(cam, p)), matchT)} t1={1} head={false} />
        )}
        {r >= 0 && r < R * 0.6 && lastEdge && (
          <ThreadPath id="hero-underline" width={3.2}
            poly={morph(mapPoly(lastEdge.poly, (p) => toScreen(cam, p)), underlineTarget, morphT * (1 - unmorph))}
            t1={1} head={false} opacity={1 - seg(r, R * 0.5, 8)} />
        )}
      </svg>
      {f < L + 10 && (
        <>
          <Scrim side="bottom" />
          <div style={{ position: 'absolute', left: 120, bottom: 96, opacity: 1 - seg(f, L - 6, 14) }}>
            <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.3em', color: 'rgba(255,246,230,0.7)' }}>
              FOLLOW THE LINE · {displayFamilyName(fam.name).toUpperCase()}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 6 }}>
              <span style={{ fontFamily: SERIF, fontSize: 92, color: CREAM, lineHeight: 1 }}>Generation</span>
              <span style={{ fontFamily: SERIF, fontSize: 92, color: sf.palette.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{reached + 1}</span>
              <span style={{ fontFamily: SERIF, fontSize: 56, color: 'rgba(255,246,230,0.4)' }}>of {lineage.length}</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 30, color: 'rgba(255,246,230,0.82)', marginTop: 4 }}>
              <KineticText key={reached} text={sf.byId.get(lineage[reached])?.label ?? ''} f={f} start={Math.floor((reached / Math.max(lineage.length - 1, 1)) * L * 0.9)} by="char" stagger={0.6} dur={10} from={{ y: 0.6, opacity: 0 }} ease={ease.outCubic} />
            </div>
          </div>
        </>
      )}
      {nameIn && (
        <>
          <DashedFrame x={bigScreen.x - 62} y={bigScreen.y - 62} w={124} h={124} f={r} start={2} dur={14}
            label={`big · gen ${lineage.length}`} color="rgba(255,246,230,0.8)" exitAt={Math.round(R * 0.45)} />
          {/* A soft plate keeps the name legible over neighbouring nodes. */}
          <div aria-hidden style={{
            position: 'absolute', top: nameY - 90, height: nameSize + 170, width: nameW + 220,
            ...(rightSide ? { left: nameX - 70 } : { right: STAGE_W - nameX - 70 }),
            background: 'radial-gradient(ellipse at 50% 50%, rgba(11,16,48,0.82) 0%, rgba(11,16,48,0.55) 55%, rgba(11,16,48,0) 75%)',
            opacity: 1 - seg(r, Math.round(R * 0.4), 12),
          }} />
          <div style={{
            position: 'absolute', top: nameY - 46, ...(rightSide ? { left: nameX } : { right: STAGE_W - nameX }),
            textAlign: rightSide ? 'left' : 'right',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.32em', color: sf.palette.accent }}>
              <KineticText text={`THE BIG · ${cycleLabel.toUpperCase()}`} f={r} start={6} stagger={0.5} dur={10} from={{ opacity: 0 }} ease={ease.linear}
                exit={{ at: Math.round(R * 0.38), dur: 8, to: { opacity: 0 } }} />
            </div>
            <div style={{ fontFamily: SERIF, fontSize: nameSize, lineHeight: 1.05, color: CREAM, marginTop: 6, whiteSpace: 'nowrap' }}>
              <KineticText text={big.label} f={r} start={10} stagger={1.3} dur={18} mask from={{ y: 1, opacity: 1 }} ease={ease.outQuint}
                tracking={[0.14, 0]} trackDur={40}
                exit={{ at: Math.round(R * 0.38), dur: 12, stagger: 0.6, to: { x: rightSide ? -0.9 : 0.9, y: 0.5, scale: 0.3, opacity: 0 }, ease: ease.inCubic }} />
            </div>
          </div>
        </>
      )}
      {r >= R * 0.48 && e < E * 0.2 && (
        <div style={{ position: 'absolute', left: 120, bottom: 92, opacity: 1 - seg(e, 0, 14) }}>
          <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.3em', color: GOLD }}>
            {big.label.toUpperCase()} WELCOMES
          </div>
          <div style={{ fontFamily: SERIF, fontSize: littleIds.length > 2 ? 64 : 76, color: CREAM, lineHeight: 1.1, marginTop: 6 }}>
            {littleIds.map((id, i) => (
              <span key={id} style={{ marginRight: 28, display: 'inline-block' }}>
                <KineticText text={sf.byId.get(id)?.label ?? ''} f={f} start={(bloomStart.get(id) ?? 0) + 18} by="char" stagger={0.9} dur={14} mask from={{ y: 1, opacity: 1 }} ease={ease.outQuint} />
                {i < littleIds.length - 1 && <span style={{ color: 'rgba(255,246,230,0.35)', marginLeft: 20 }}>·</span>}
              </span>
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.26em', color: 'rgba(255,246,230,0.6)', marginTop: 10 }}>
            +{growing} NEW LITTLE{littleIds.length === 1 ? '' : 'S'}
          </div>
        </div>
      )}
      {e >= 0 && (
        <>
          <Scrim side="bottom" />
          <Callouts sf={sf} cam={cam} f={e} start={Math.round(E * 0.5)} max={3} />
          <FamilyTitle f={e} start={Math.round(E * 0.35)} fam={fam} index={1} accent={sf.palette.accent} position="top-left" />
          <Metrics f={e} start={Math.round(E * 0.42)} fam={fam} />
        </>
      )}
      <Vignette strength={0.5} />
      {entering && <div style={{ position: 'absolute', inset: 0, background: '#0b1030', opacity: 1 - matchT }} />}
    </div>
  );
}
