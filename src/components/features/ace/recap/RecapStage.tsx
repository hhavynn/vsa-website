import React from 'react';
import type { AceRecapSnapshot, RecapFamily } from '../../../../lib/aceRecap/recapSnapshot';
import type { RecapScene, RecapTimeline } from '../../../../lib/aceRecap/recapTimeline';
import {
  CREAM, GOLD, GOLD_DEEP, INK, NODE_R, STAGE_H, STAGE_W,
  boxOfIds, cameraTransform, clamp, cubicPoint, easeBack, easeInOut, easeOut, fitCamera, hashId,
  labelLines, lerp, lerpCamera, progress, rand, stageFamily,
} from './stageModel';
import type { Box, Camera, StageFamily } from './stageModel';

/**
 * The ACE annual recap, as a pure function of the frame number.
 *
 * No timers, no hooks that keep state, no network: Remotion renders it frame
 * by frame into the MP4, and the in-site AceRecapPlayer drives the same
 * component from a clock. Fixed 1920×1080 canvas; callers scale it.
 */

export interface RecapStageProps {
  snapshot: AceRecapSnapshot;
  timeline: RecapTimeline;
  frame: number;
  /** Defaults to a private-preview banner whenever the snapshot is private. */
  watermark?: string | null;
}

const SERIF = '"Instrument Serif", "DM Serif Display", Georgia, serif';
const SANS = '"DM Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export const displayFamilyName = (name: string) => name.replace(/^\s*\(dead\)\s*/i, '').trim() || name;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ─── shared pieces ───────────────────────────────────────────────────────────

function Backdrop({ frame, tint = '#7a5fc0' }: { frame: number; tint?: string }) {
  const t = frame / 30;
  const stars = Array.from({ length: 90 }, (_, i) => {
    const x = rand(i * 3.1) * STAGE_W;
    const y = (rand(i * 7.7) * STAGE_H + t * (4 + rand(i) * 10)) % STAGE_H;
    const r = 0.6 + rand(i * 5.3) * 1.8;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + rand(i * 2.2)) + i));
    return <circle key={i} cx={x} cy={y} r={r} fill="#e9e4ff" opacity={0.12 + 0.35 * tw * rand(i * 9.1)} />;
  });
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <radialGradient id="bg-core" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#232a66" />
          <stop offset="55%" stopColor="#141a45" />
          <stop offset="100%" stopColor={INK} />
        </radialGradient>
        <radialGradient id="bg-blob" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tint} stopOpacity="0.38" />
          <stop offset="100%" stopColor={tint} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bg-blob2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ebb4da" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ebb4da" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill="url(#bg-core)" />
      <ellipse cx={420 + Math.sin(t * 0.21) * 120} cy={260 + Math.cos(t * 0.17) * 60} rx={720} ry={520} fill="url(#bg-blob)" />
      <ellipse cx={1520 + Math.cos(t * 0.19) * 140} cy={820 + Math.sin(t * 0.23) * 70} rx={760} ry={520} fill="url(#bg-blob2)" />
      {stars}
    </svg>
  );
}

function Watermark({ text, queued }: { text: string; queued: number }) {
  return (
    <div style={{
      position: 'absolute', top: 30, right: 40, textAlign: 'right', fontFamily: MONO, fontSize: 15,
      letterSpacing: '0.14em', color: 'rgba(255,246,230,0.62)', textTransform: 'uppercase', lineHeight: 1.6,
    }}>
      <div>{text}</div>
      {queued > 0 && <div style={{ opacity: 0.75 }}>{queued} pairings awaiting review not shown</div>}
    </div>
  );
}

function Fade({ f, d, children, inFrames = 14, outFrames = 14 }: { f: number; d: number; children: React.ReactNode; inFrames?: number; outFrames?: number }) {
  const a = Math.min(progress(f, 0, inFrames), 1 - progress(f, d - outFrames, outFrames));
  return <div style={{ position: 'absolute', inset: 0, opacity: easeInOut(clamp(a)) }}>{children}</div>;
}

function Kicker({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(255,246,230,0.7)', ...style }}>{children}</div>;
}

interface TreeLook {
  /** 0..1 per existing node: 1 = fully shown. */
  existing?: (id: string, depth: number) => number;
  /** 0..1 reveal progress for each new node; < 0 means hidden. */
  bloom?: (id: string) => number;
  /** 0..1 emphasis for a node (glow ring). */
  highlight?: (id: string) => number;
  dimExisting?: number;
  labelExisting?: boolean;
  frame: number;
}

/** One family tree drawn in world space under a camera. */
function TreeLayer({ sf, cam, look }: { sf: StageFamily; cam: Camera; look: TreeLook }) {
  const { palette } = sf;
  const exist = look.existing ?? (() => 1);
  const bloom = look.bloom ?? (() => 1);
  const hi = look.highlight ?? (() => 0);
  const dim = look.dimExisting ?? 1;
  const depthOf = (id: string) => sf.byId.get(id)?.y ?? 0;
  const labelScale = cam.s;
  const existingLabelAlpha = look.labelExisting === false ? 0 : clamp((labelScale - 0.42) / 0.25);
  const newLabelAlpha = clamp((labelScale - 0.22) / 0.2);
  const gid = `g-${sf.fam.id.slice(0, 8)}`;

  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.85" />
          <stop offset="45%" stopColor={GOLD_DEEP} stopOpacity="0.28" />
          <stop offset="100%" stopColor={GOLD_DEEP} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${gid}-lantern`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#fff3cf" />
          <stop offset="55%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </radialGradient>
        <radialGradient id={`${gid}-hi`}>
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.6" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={cameraTransform(cam)}>
        {/* existing edges */}
        {sf.edges.filter((e) => !e.isNew).map((e) => {
          const p = Math.min(exist(e.to, depthOf(e.to)), exist(e.from, depthOf(e.from)));
          if (p <= 0) return null;
          const lit = Math.max(hi(e.to), 0) * Math.max(hi(e.from), 0);
          return (
            <path key={e.id} d={e.d} fill="none" stroke={lit > 0 ? palette.accent : palette.edge}
              strokeWidth={(lit > 0 ? 5 : 2.6) / Math.max(cam.s, 0.2)} strokeLinecap="round"
              strokeDasharray={e.length} strokeDashoffset={e.length * (1 - easeOut(p))}
              opacity={(0.75 + 0.25 * lit) * dim} />
          );
        })}
        {/* new edges */}
        {sf.edges.filter((e) => e.isNew).map((e) => {
          const p = bloom(e.to);
          if (p <= 0) return null;
          const draw = easeInOut(clamp(p / 0.55));
          const spark = e.cubic && draw < 1 ? cubicPoint(e.cubic, draw) : null;
          return (
            <g key={e.id}>
              <path d={e.d} fill="none" stroke={GOLD} strokeWidth={4.5 / Math.max(cam.s, 0.35)} strokeLinecap="round"
                strokeDasharray={e.length} strokeDashoffset={e.length * (1 - draw)} opacity={0.95} />
              {spark && <circle cx={spark.x} cy={spark.y} r={10 / Math.max(cam.s, 0.4)} fill="#fff3cf" />}
              {spark && <circle cx={spark.x} cy={spark.y} r={34 / Math.max(cam.s, 0.4)} fill={`url(#${gid}-glow)`} />}
            </g>
          );
        })}
        {/* existing nodes */}
        {sf.fam.nodes.filter((n) => !n.isNew).map((n) => {
          const p = exist(n.id, n.y);
          if (p <= 0) return null;
          const pt = sf.pos.get(n.id)!;
          const h = clamp(hi(n.id));
          const s = easeBack(clamp(p * 1.4));
          const [l1, l2] = labelLines(n.label);
          return (
            <g key={n.id} transform={`translate(${pt.x} ${pt.y}) scale(${s})`} opacity={clamp(p * 2) * lerp(dim, 1, h)}>
              {h > 0 && <circle r={NODE_R * (2.2 + 0.4 * Math.sin(look.frame / 6))} fill={`url(#${gid}-hi)`} opacity={h} />}
              <circle r={NODE_R} fill={palette.node} stroke={h > 0 ? CREAM : palette.accent} strokeWidth={(h > 0 ? 4 : 2.6) / Math.max(Math.min(cam.s, 1), 0.4)} />
              <text y={8} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} fill={palette.accent}>
                {n.label.trim().charAt(0).toUpperCase()}
              </text>
              {(existingLabelAlpha > 0 || h > 0) && (
                <text y={NODE_R + 24} textAnchor="middle" fontFamily={SANS} fontWeight={h > 0 ? 700 : 500}
                  fontSize={h > 0 ? 19 : 16} fill={h > 0 ? CREAM : '#d9d4f2'} opacity={Math.max(existingLabelAlpha * 0.85, h)}
                  stroke={INK} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                  <tspan x={0}>{l1}</tspan>
                  {l2 && <tspan x={0} dy={h > 0 ? 21 : 18}>{l2}</tspan>}
                </text>
              )}
            </g>
          );
        })}
        {/* new nodes: lanterns */}
        {sf.fam.nodes.filter((n) => n.isNew).map((n) => {
          const p = bloom(n.id);
          if (p <= 0) return null;
          const pt = sf.pos.get(n.id)!;
          const pop = clamp((p - 0.45) / 0.35);
          if (pop <= 0) return null;
          const s = easeBack(pop);
          const settle = clamp((p - 0.6) / 0.4);
          const breathe = 1 + 0.06 * Math.sin(look.frame / 9 + hashId(n.id) % 7);
          const [l1, l2] = labelLines(n.label);
          const burst = Array.from({ length: 10 }, (_, i) => {
            const k = clamp((p - 0.5) / 0.45);
            if (k <= 0 || k >= 1) return null;
            const ang = (i / 10) * Math.PI * 2 + rand(hashId(n.id) + i) * 0.6;
            const dist = NODE_R + 16 + easeOut(k) * (60 + rand(i + 3) * 40);
            return <circle key={i} cx={Math.cos(ang) * dist} cy={Math.sin(ang) * dist} r={3.2 * (1 - k) + 0.8} fill="#fff3cf" opacity={1 - k} />;
          });
          return (
            <g key={n.id} transform={`translate(${pt.x} ${pt.y})`}>
              <circle r={NODE_R * 3.2 * breathe} fill={`url(#${gid}-glow)`} opacity={0.55 + 0.45 * (1 - settle)} />
              {burst}
              <g transform={`scale(${s})`}>
                <circle r={NODE_R + 2} fill={`url(#${gid}-lantern)`} stroke="#fff3cf" strokeWidth={2.5} />
                <text y={8} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={22} fill="#5a2a12">
                  {n.label.trim().charAt(0).toUpperCase()}
                </text>
              </g>
              <text y={NODE_R + 28} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={20}
                fill={CREAM} opacity={newLabelAlpha * clamp((p - 0.6) / 0.3)}
                stroke={INK} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                <tspan x={0}>{l1}</tspan>
                {l2 && <tspan x={0} dy={22}>{l2}</tspan>}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function Stat({ value, label, color = CREAM }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 0.95, color }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,246,230,0.72)' }}>{label}</div>
    </div>
  );
}

function Scrim({ side }: { side: 'bottom' | 'left' | 'top' }) {
  const bg = side === 'bottom'
    ? 'linear-gradient(to top, rgba(11,16,48,0.92) 0%, rgba(11,16,48,0.6) 45%, rgba(11,16,48,0) 100%)'
    : side === 'top'
      ? 'linear-gradient(to bottom, rgba(11,16,48,0.85) 0%, rgba(11,16,48,0) 100%)'
      : 'linear-gradient(to right, rgba(11,16,48,0.94) 0%, rgba(11,16,48,0.7) 55%, rgba(11,16,48,0) 100%)';
  const box: React.CSSProperties = side === 'bottom' ? { left: 0, right: 0, bottom: 0, height: 430 }
    : side === 'top' ? { left: 0, right: 0, top: 0, height: 300 } : { left: 0, top: 0, bottom: 0, width: 900 };
  return <div style={{ position: 'absolute', ...box, background: bg }} />;
}

// ─── scenes ──────────────────────────────────────────────────────────────────

interface SceneProps { f: number; d: number; snapshot: AceRecapSnapshot; timeline: RecapTimeline }

/** Deterministic decorative "branching" motif for the opening. */
function BranchMotif({ f }: { f: number }) {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number; depth: number; i: number }> = [];
  let idx = 0;
  const grow = (x: number, y: number, ang: number, len: number, depth: number) => {
    if (depth > 5) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    segs.push({ x1: x, y1: y, x2, y2, depth, i: idx++ });
    const spread = 0.42 + rand(idx * 1.7) * 0.2;
    grow(x2, y2, ang - spread, len * 0.74, depth + 1);
    grow(x2, y2, ang + spread, len * 0.74, depth + 1);
  };
  grow(STAGE_W / 2, STAGE_H + 20, -Math.PI / 2, 150, 0);
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {segs.map((s) => {
        const p = easeOut(progress(f, 20 + s.depth * 14 + rand(s.i) * 6, 26));
        if (p <= 0) return null;
        const x = lerp(s.x1, s.x2, p);
        const y = lerp(s.y1, s.y2, p);
        const leaf = s.depth === 5 && p >= 1;
        const glow = leaf ? clamp((f - (20 + 5 * 14 + 26)) / 20) : 0;
        return (
          <g key={s.i}>
            <line x1={s.x1} y1={s.y1} x2={x} y2={y} stroke={s.depth >= 4 ? '#c9b6f0' : '#a3b2ec'} strokeOpacity={0.42 - s.depth * 0.05}
              strokeWidth={Math.max(1.2, 7 - s.depth * 1.2)} strokeLinecap="round" />
            {leaf && <circle cx={s.x2} cy={s.y2} r={5 + 3 * Math.sin(f / 8 + s.i)} fill={GOLD} opacity={0.35 + 0.5 * glow} />}
          </g>
        );
      })}
    </svg>
  );
}

function Opening({ f, d, snapshot }: SceneProps) {
  const words = ['A', 'New', 'Generation'];
  const push = 1 + 0.06 * easeInOut(progress(f, d - 40, 40));
  return (
    <Fade f={f} d={d} inFrames={18} outFrames={22}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})` }}>
        <BranchMotif f={f} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center' }}>
          <Kicker style={{ opacity: easeOut(progress(f, 6, 24)), transform: `translateY(${(1 - easeOut(progress(f, 6, 24))) * 20}px)` }}>
            VSA at UCSD · ACE presents
          </Kicker>
          <div style={{ marginTop: 34, display: 'flex', justifyContent: 'center', gap: 34 }}>
            {words.map((w, i) => {
              const p = easeOut(progress(f, 26 + i * 9, 30));
              return (
                <div key={w} style={{ overflow: 'hidden', paddingBottom: 18 }}>
                  <div style={{
                    fontFamily: SERIF, fontStyle: 'italic', fontSize: 168, lineHeight: 1, color: i === 2 ? GOLD : CREAM,
                    transform: `translateY(${(1 - p) * 110}%)`, textShadow: '0 8px 50px rgba(0,0,0,0.35)',
                  }}>{w}</div>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 26, fontFamily: SANS, fontSize: 36, color: 'rgba(255,246,230,0.86)',
            opacity: easeOut(progress(f, 78, 30)), transform: `translateY(${(1 - easeOut(progress(f, 78, 30))) * 16}px)`,
          }}>
            {snapshot.cycle.label} · every Big/Little pairing grows another branch.
          </div>
        </div>
      </div>
    </Fade>
  );
}

function familyById(snapshot: AceRecapSnapshot, id: string | null): RecapFamily | null {
  return snapshot.families.find((x) => x.id === id) ?? null;
}

/** The camera used at the end of Origins and the start of Lineage. */
const originsCamera = (sf: StageFamily, end = false) => {
  const base = fitCamera(sf.beforeBounds, { x: 800, y: 80, w: 1080, h: 920 }, 0.9);
  return end ? { ...base, s: base.s * 1.05 } : base;
};

function Origins({ f, d, snapshot, scene }: SceneProps & { scene: RecapScene }) {
  const fam = familyById(snapshot, scene.familyId);
  if (!fam) return null;
  const sf = stageFamily(fam);
  const cam = lerpCamera(originsCamera(sf), originsCamera(sf, true), easeInOut(progress(f, 0, d)));
  const maxDepth = Math.max(1, fam.before.generations - 1);
  const per = Math.min(7, 70 / maxDepth);
  return (
    <Fade f={f} d={d} outFrames={6}>
      <TreeLayer sf={sf} cam={cam} look={{
        frame: f, bloom: () => -1, labelExisting: false,
        existing: (_id, depth) => progress(f, 6 + depth * per, 16),
      }} />
      <Scrim side="left" />
      <div style={{ position: 'absolute', left: 120, top: 330, width: 640 }}>
        <Kicker style={{ opacity: easeOut(progress(f, 4, 20)) }}>Family 01 · origins</Kicker>
        <div style={{
          fontFamily: SERIF, fontSize: 150, lineHeight: 1, color: sf.palette.accent, marginTop: 18,
          opacity: easeOut(progress(f, 10, 24)), transform: `translateX(${(1 - easeOut(progress(f, 10, 24))) * -40}px)`,
        }}>{displayFamilyName(fam.name)}</div>
        <div style={{ marginTop: 34, display: 'flex', gap: 56, opacity: easeOut(progress(f, 30, 24)) }}>
          <Stat value={fmt(fam.before.people * easeOut(progress(f, 30, 50)))} label="members so far" />
          <Stat value={fmt(fam.before.generations)} label="generations" />
        </div>
      </div>
    </Fade>
  );
}

function Lineage({ f, d, snapshot, scene }: SceneProps & { scene: RecapScene }) {
  const fam = familyById(snapshot, scene.familyId);
  if (!fam || !fam.growth.length) return null;
  const sf = stageFamily(fam);
  const path = fam.growth[0].lineage;
  const pts = path.map((id) => sf.pos.get(id)!);
  // Arc-length parameterisation so the camera glides at an even pace.
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  const travel = easeInOut(progress(f, 34, d - 60));
  let dist = travel * total;
  let i = 0;
  while (i < seg.length && dist > seg[i]) { dist -= seg[i]; i++; }
  const at = i >= seg.length ? pts[pts.length - 1] : {
    x: lerp(pts[i].x, pts[i + 1].x, dist / (seg[i] || 1)), y: lerp(pts[i].y, pts[i + 1].y, dist / (seg[i] || 1)),
  };
  const reachedIndex = i >= seg.length ? pts.length - 1 : i + (dist / (seg[i] || 1) > 0.6 ? 1 : 0);
  const follow: Camera = { cx: at.x + 140, cy: at.y + 110, s: 1.05 };
  const start = originsCamera(sf, true);
  const cam = lerpCamera(start, follow, easeInOut(progress(f, 0, 40)));
  const lit = new Set(path.slice(0, reachedIndex + 1));
  const current = sf.byId.get(path[Math.min(reachedIndex, path.length - 1)]);
  return (
    <Fade f={f} d={d} inFrames={4} outFrames={8}>
      <TreeLayer sf={sf} cam={cam} look={{
        frame: f, bloom: () => -1, dimExisting: 0.32,
        highlight: (id) => (lit.has(id) ? 1 : 0),
      }} />
      <Scrim side="bottom" />
      <div style={{ position: 'absolute', left: 120, bottom: 96 }}>
        <Kicker>Follow the lineage · {displayFamilyName(fam.name)}</Kicker>
        <div style={{ marginTop: 14, fontFamily: SERIF, fontSize: 76, color: CREAM }}>
          Generation <span style={{ color: sf.palette.accent }}>{reachedIndex + 1}</span>
          <span style={{ color: 'rgba(255,246,230,0.45)' }}> of {path.length}</span>
        </div>
        <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 30, color: 'rgba(255,246,230,0.8)' }}>{current?.label}</div>
      </div>
    </Fade>
  );
}

/**
 * Growth "stops": neighbouring Bigs whose branches fit in one shot are
 * visited together, so the camera never outruns the names on screen.
 */
const STOP_REGION: Box = { x: 80, y: 150, w: 1760, h: 600 };
const MAX_GROUPS_PER_STOP = 4;
function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
function growthPlan(sf: StageFamily, d: number) {
  const groups = [...sf.fam.growth].sort((a, b) => sf.pos.get(a.bigNodeId)!.x - sf.pos.get(b.bigNodeId)!.x);
  const stops: Array<{ groups: typeof groups; box: Box }> = [];
  for (const g of groups) {
    const box = boxOfIds(sf, [g.bigNodeId, ...g.littleIds], 150);
    const last = stops[stops.length - 1];
    const merged = last ? union(last.box, box) : null;
    if (last && merged && merged.w <= STOP_REGION.w * 0.95 && merged.h <= STOP_REGION.h * 0.8 && last.groups.length < MAX_GROUPS_PER_STOP) {
      last.groups.push(g);
      last.box = merged;
    } else stops.push({ groups: [g], box });
  }
  const lead = 26;
  const tail = 50;
  const weights = stops.map((st) => 1 + st.groups.reduce((n, g) => n + g.littleIds.length, 0) * 0.35);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = lead;
  return stops.map((st, i) => {
    const step = ((d - lead - tail) * weights[i]) / total;
    const start = cursor;
    cursor += step;
    const per = Math.min(22, (step * 0.7) / Math.max(st.groups.length, 1));
    return { ...st, start, step, cam: fitCamera(st.box, STOP_REGION, 1.2, 0.95), groupStart: st.groups.map((_, k) => start + 10 + k * per) };
  });
}

function Growth({ f, d, snapshot, scene }: SceneProps & { scene: RecapScene }) {
  const fam = familyById(snapshot, scene.familyId);
  if (!fam) return null;
  const sf = stageFamily(fam);
  const plan = growthPlan(sf, d);
  const lineageEnd = sf.pos.get(fam.growth[0].bigNodeId)!;
  let cam: Camera = { cx: lineageEnd.x + 140, cy: lineageEnd.y + 110, s: 1.05 };
  for (let i = 0; i < plan.length; i++) {
    const prev = i === 0 ? cam : plan[i - 1].cam;
    const travel = Math.min(26, plan[i].step * 0.45);
    const t = easeInOut(progress(f, plan[i].start - travel * 0.6, travel));
    if (t > 0) cam = lerpCamera(prev, plan[i].cam, t);
  }
  const bloomStart = new Map<string, number>();
  const bigStart = new Map<string, number>();
  plan.forEach((stop) => stop.groups.forEach((g, k) => {
    bigStart.set(g.bigNodeId, stop.groupStart[k]);
    g.littleIds.forEach((id, j) => bloomStart.set(id, stop.groupStart[k] + 4 + j * 6));
  }));
  const bloomed = Array.from(bloomStart.values()).filter((s) => f >= s + 14).length;
  const active = [...plan].reverse().find((p) => f >= p.start - 6) ?? null;
  const lower = active ? clamp(Math.min(progress(f, active.start - 2, 12), 1 - progress(f, active.start + active.step - 8, 8))) : 0;
  return (
    <Fade f={f} d={d} inFrames={4} outFrames={10}>
      <TreeLayer sf={sf} cam={cam} look={{
        frame: f, dimExisting: 0.55,
        bloom: (id) => { const s = bloomStart.get(id); return s === undefined ? -1 : progress(f, s, 34); },
        highlight: (id) => { const s = bigStart.get(id); return s === undefined ? 0 : clamp(progress(f, s - 6, 10) * (1 - progress(f, s + 40, 30) * 0.6)); },
      }} />
      <Scrim side="bottom" />
      <div style={{ position: 'absolute', left: 120, top: 92 }}>
        <Kicker>New branches · {displayFamilyName(fam.name)}</Kicker>
      </div>
      <div style={{ position: 'absolute', right: 120, bottom: 96, textAlign: 'right' }}>
        <div style={{ fontFamily: SERIF, fontSize: 120, lineHeight: 1, color: GOLD }}>+{bloomed}</div>
        <Kicker style={{ fontSize: 17 }}>new Littles</Kicker>
      </div>
      {active && (
        <div style={{ position: 'absolute', left: 120, bottom: 92, opacity: lower, transform: `translateY(${(1 - lower) * 18}px)`, maxWidth: 1300 }}>
          <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: '0.26em', textTransform: 'uppercase', color: sf.palette.accent, marginBottom: 8 }}>
            Big → new Littles
          </div>
          {active.groups.map((g, k) => {
            const a = easeOut(progress(f, active.groupStart[k] - 2, 12));
            return (
              <div key={g.bigNodeId} style={{ opacity: a, transform: `translateX(${(1 - a) * -16}px)`, lineHeight: 1.18, marginTop: 4 }}>
                <span style={{ fontFamily: SERIF, fontSize: active.groups.length > 2 ? 40 : 52, color: CREAM }}>{g.bigLabel}</span>
                <span style={{ fontFamily: SANS, fontSize: active.groups.length > 2 ? 26 : 32, color: GOLD, fontWeight: 600 }}>
                  {'  →  '}{g.littleIds.map((id) => sf.byId.get(id)?.label).join(' · ')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Fade>
  );
}

function Expansion({ f, d, snapshot, scene }: SceneProps & { scene: RecapScene }) {
  const fam = familyById(snapshot, scene.familyId);
  if (!fam) return null;
  const sf = stageFamily(fam);
  const plan = growthPlan(sf, 100);
  const from: Camera = plan[plan.length - 1]?.cam ?? fitCamera(sf.bounds);
  const to = fitCamera(sf.bounds, { x: 60, y: 60, w: 1800, h: 700 }, 1);
  const cam = lerpCamera(from, to, easeInOut(progress(f, 0, 56)));
  const k = easeOut(progress(f, 40, 50));
  return (
    <Fade f={f} d={d} inFrames={2}>
      <TreeLayer sf={sf} cam={cam} look={{ frame: f, dimExisting: 0.7, labelExisting: false }} />
      <Scrim side="bottom" />
      <div style={{ position: 'absolute', left: 120, right: 120, bottom: 86, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', opacity: k }}>
        <div>
          <Kicker>{snapshot.cycle.label} · {displayFamilyName(fam.name)}</Kicker>
          <div style={{ fontFamily: SERIF, fontSize: 96, color: sf.palette.accent, lineHeight: 1 }}>{displayFamilyName(fam.name)}, grown</div>
        </div>
        <div style={{ display: 'flex', gap: 64 }}>
          <Stat value={`+${fmt(fam.added * k)}`} label="new Littles" color={GOLD} />
          <Stat value={`${fam.growth.length}`} label="Bigs" />
          <Stat value={`${fmt(fam.before.people)}→${fmt(lerp(fam.before.people, fam.after.people, k))}`} label="members" />
          <Stat value={`${fam.before.generations}→${fam.after.generations}`} label="generations" />
        </div>
      </div>
    </Fade>
  );
}

function Spotlight({ f, d, snapshot, scene, index }: SceneProps & { scene: RecapScene; index: number }) {
  const fam = familyById(snapshot, scene.familyId);
  if (!fam) return null;
  const sf = stageFamily(fam);
  const aspect = sf.bounds.w / sf.bounds.h;
  const wide = aspect > 2.1;
  const region = wide ? { x: 60, y: 300, w: 1800, h: 700 } : { x: 760, y: 70, w: 1120, h: 940 };
  const fitAll = fitCamera(sf.bounds, region, 1);
  const newBox = boxOfIds(sf, sf.newIds, 160);
  const intimate = fam.added <= 2;
  const close = intimate
    ? fitCamera(newBox, region, 1.15, 0.7)
    : lerpCamera(fitAll, fitCamera(newBox, region, 1, 0.95), 0.25);
  const cam = lerpCamera(fitAll, close, easeInOut(progress(f, 16, d - 30)));
  const order = [...sf.newIds].sort((a, b) => sf.pos.get(a)!.x - sf.pos.get(b)!.x);
  const sweep = Math.max(1, d * 0.5);
  const startOf = new Map(order.map((id, i) => [id, 24 + (order.length > 1 ? (i / (order.length - 1)) * sweep : 0)]));
  const t = easeOut(progress(f, 4, 22));
  const bloomedNow = order.filter((id) => f >= (startOf.get(id) ?? 0) + 14).length;
  const titleStyle: React.CSSProperties = wide
    ? { position: 'absolute', left: 120, top: 96, transform: `translateY(${(1 - t) * 24}px)`, opacity: t }
    : { position: 'absolute', left: 120, top: 360, width: 600, transform: `translateX(${(1 - t) * -30}px)`, opacity: t };
  return (
    <Fade f={f} d={d}>
      <TreeLayer sf={sf} cam={cam} look={{
        frame: f, dimExisting: 0.62, labelExisting: false,
        existing: () => progress(f, 0, 14),
        bloom: (id) => { const s = startOf.get(id); return s === undefined ? -1 : progress(f, s, 32); },
      }} />
      <Scrim side={wide ? 'top' : 'left'} />
      <div style={titleStyle}>
        <Kicker>Family {String(index + 2).padStart(2, '0')}</Kicker>
        <div style={{ fontFamily: SERIF, fontSize: wide ? 120 : 138, lineHeight: 1, color: sf.palette.accent, marginTop: 10 }}>{displayFamilyName(fam.name)}</div>
        <div style={{ marginTop: 22, fontFamily: SANS, fontSize: 30, color: 'rgba(255,246,230,0.86)' }}>
          <span style={{ color: GOLD, fontWeight: 700 }}>+{bloomedNow}</span> new Little{fam.added === 1 ? '' : 's'} · {fam.growth.length} Big{fam.growth.length === 1 ? '' : 's'}
        </div>
        <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 26, color: 'rgba(255,246,230,0.62)' }}>
          {fmt(fam.before.people)} → {fmt(fam.after.people)} members · {fam.after.generations} generations
        </div>
        {intimate && fam.growth.map((g) => (
          <div key={g.bigNodeId} style={{ marginTop: 26, fontFamily: SANS, fontSize: 30, color: CREAM, opacity: easeOut(progress(f, 40, 20)) }}>
            {g.bigLabel} <span style={{ color: GOLD }}>→ {g.littleIds.map((id) => sf.byId.get(id)?.label).join(' · ')}</span>
          </div>
        ))}
      </div>
    </Fade>
  );
}

function MiniTree({ fam, box, f, delay }: { fam: RecapFamily; box: Box; f: number; delay: number }) {
  const sf = stageFamily(fam);
  const cam = fitCamera(sf.bounds, box, 0.5, 0.92);
  const k = easeOut(progress(f, delay, 34));
  const r = Math.max(2.4, NODE_R * cam.s);
  const P = (id: string) => {
    const p = sf.pos.get(id)!;
    return { x: (p.x - cam.cx) * cam.s + STAGE_W / 2, y: (p.y - cam.cy) * cam.s + STAGE_H / 2 };
  };
  return (
    <g opacity={k}>
      {sf.edges.map((e) => {
        const a = P(e.from); const b = P(e.to);
        const show = e.isNew ? clamp((f - delay - 20) / 20) : 1;
        if (show <= 0) return null;
        return <line key={e.id} x1={a.x} y1={a.y} x2={lerp(a.x, b.x, show)} y2={lerp(a.y, b.y, show)}
          stroke={e.isNew ? GOLD : sf.palette.edge} strokeWidth={e.isNew ? 1.8 : 1.1} opacity={e.isNew ? 0.95 : 0.8} />;
      })}
      {fam.nodes.map((n) => {
        const p = P(n.id);
        if (n.isNew) {
          const s = easeBack(clamp((f - delay - 30) / 18));
          return s > 0 ? <g key={n.id}><circle cx={p.x} cy={p.y} r={r * 3.4} fill={GOLD} opacity={0.16 * s} /><circle cx={p.x} cy={p.y} r={r * 1.15 * s} fill={GOLD} /></g> : null;
        }
        return <circle key={n.id} cx={p.x} cy={p.y} r={r} fill={sf.palette.node} stroke={sf.palette.accent} strokeWidth={1} />;
      })}
    </g>
  );
}

function Finale({ f, d, snapshot }: SceneProps) {
  const fams = snapshot.families.filter((x) => !x.archived).slice(0, 8);
  const cols = fams.length > 4 ? 4 : Math.max(fams.length, 1);
  const rows = Math.ceil(fams.length / cols);
  const cellW = 1680 / cols;
  const cellH = (rows > 1 ? 760 : 560) / rows;
  const grid = easeInOut(progress(f, 120, 50));
  const added = snapshot.families.reduce((s, x) => s + x.added, 0);
  const growing = snapshot.families.filter((x) => x.added > 0 && !x.archived).length;
  const outro = easeOut(progress(f, 176, 34));
  return (
    <Fade f={f} d={d} outFrames={30}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - grid * 0.9, transform: `scale(${1 - grid * 0.06})` }}>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
          {fams.map((fam, i) => {
            const c = i % cols; const r = Math.floor(i / cols);
            const box = { x: 120 + c * cellW, y: 150 + r * (cellH + 40), w: cellW - 40, h: cellH - 60 };
            return <MiniTree key={fam.id} fam={fam} box={box} f={f} delay={i * 7} />;
          })}
        </svg>
        {fams.map((fam, i) => {
          const c = i % cols; const r = Math.floor(i / cols);
          const sf = stageFamily(fam);
          return (
            <div key={fam.id} style={{
              position: 'absolute', left: 120 + c * cellW, width: cellW - 40, top: 150 + r * (cellH + 40) + cellH - 50,
              textAlign: 'center', opacity: easeOut(progress(f, i * 7 + 14, 20)),
            }}>
              <span style={{ fontFamily: SERIF, fontSize: 40, color: sf.palette.accent }}>{displayFamilyName(fam.name)}</span>
              {fam.added > 0 && <span style={{ fontFamily: SANS, fontSize: 26, color: GOLD, fontWeight: 700, marginLeft: 14 }}>+{fam.added}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', opacity: grid }}>
        <Kicker>{snapshot.cycle.label} · the new generation</Kicker>
        <div style={{ fontFamily: SERIF, fontSize: 230, lineHeight: 1, color: GOLD, marginTop: 10 }}>+{fmt(added * easeOut(progress(f, 128, 50)))}</div>
        <div style={{ fontFamily: SANS, fontSize: 40, color: CREAM, marginTop: 4 }}>new Littles across {growing} families</div>
        <div style={{ marginTop: 60, opacity: outro, transform: `translateY(${(1 - outro) * 20}px)` }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 92, color: CREAM }}>Welcome to the family.</div>
          <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 20, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,246,230,0.7)' }}>
            Find your branch on the VSA website · ACE
          </div>
        </div>
      </div>
    </Fade>
  );
}

// ─── stage ───────────────────────────────────────────────────────────────────

export function RecapStage({ snapshot, timeline, frame, watermark }: RecapStageProps) {
  const scene = [...timeline.scenes].reverse().find((s) => frame >= s.from) ?? timeline.scenes[0];
  const f = frame - (scene?.from ?? 0);
  const d = scene?.durationInFrames ?? 1;
  const hero = familyById(snapshot, timeline.heroFamilyId);
  const sceneFam = familyById(snapshot, scene?.familyId ?? null);
  const tint = sceneFam ? stageFamily(sceneFam).palette.accent : hero ? stageFamily(hero).palette.accent : '#7a5fc0';
  const mark = watermark === undefined
    ? (snapshot.visibility === 'private-preview' ? 'Private preview · not published · pending ACE Chair approval' : null)
    : watermark;
  const props: SceneProps = { f, d, snapshot, timeline };
  const spotlightIndex = timeline.scenes.filter((s) => s.kind === 'spotlight').indexOf(scene!);
  return (
    <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden', background: INK }}>
      <Backdrop frame={frame} tint={tint} />
      {scene?.kind === 'opening' && <Opening {...props} />}
      {scene?.kind === 'origins' && <Origins {...props} scene={scene} />}
      {scene?.kind === 'lineage' && <Lineage {...props} scene={scene} />}
      {scene?.kind === 'growth' && <Growth {...props} scene={scene} />}
      {scene?.kind === 'expansion' && <Expansion {...props} scene={scene} />}
      {scene?.kind === 'spotlight' && <Spotlight {...props} scene={scene} index={spotlightIndex} />}
      {scene?.kind === 'finale' && <Finale {...props} />}
      {mark && <Watermark text={mark} queued={snapshot.totals.queued} />}
    </div>
  );
}
