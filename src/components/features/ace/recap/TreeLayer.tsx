import React from 'react';
import { STAGE_H, STAGE_W, NODE_R, CREAM, GOLD, GOLD_DEEP, INK, cameraTransform, clamp, labelLines } from './stageModel';
import type { Camera, StageFamily } from './stageModel';
import { ease, hashId } from './motion/easing';
import { SANS } from './motion/Kinetic';
import { ThreadPath } from './motion/ThreadPath';

/** Below this camera scale the tree switches to its simplified dot form. */
export const LOD_SCALE = 0.3;

export interface TreeLook {
  frame: number;
  /** 0..1 visibility for each existing node (default 1). */
  existing?: (id: string, depth: number) => number;
  /** Reveal progress of each new node's branch: <=0 hidden, 1 fully grown. */
  bloom?: (id: string) => number;
  /** 0..1 emphasis (glow ring + label) for existing nodes. */
  highlight?: (id: string) => number;
  /** Opacity multiplier for un-highlighted existing nodes. */
  dim?: number;
  /** Which existing labels to show: all (when zoom allows), none, or only emphasised ones. */
  labels?: 'auto' | 'emphasis' | 'none';
  /** Hide new-node name labels (e.g. when a callout carries them). */
  newLabels?: boolean;
}

/**
 * One family tree drawn in world space under a camera. New Littles grow as
 * real edges (thread with a moving head) from their real Big, then the node
 * settles with a single ring — no particle noise.
 */
export function TreeLayer({ sf, cam, look, id }: { sf: StageFamily; cam: Camera; look: TreeLook; id: string }) {
  const { palette } = sf;
  const exist = look.existing ?? (() => 1);
  const bloom = look.bloom ?? (() => 1);
  const hi = look.highlight ?? (() => 0);
  const dim = look.dim ?? 1;
  const lod = cam.s < LOD_SCALE;
  const k = 1 / Math.max(cam.s, 0.05);
  const labelsOn = look.labels ?? 'auto';
  const labelAlpha = labelsOn === 'auto' ? clamp((cam.s - 0.5) / 0.2) : 0;
  const newLabelAlpha = look.newLabels === false ? 0 : clamp((cam.s - 0.38) / 0.15);
  const gid = `tl-${id}`;
  const depthOf = (nid: string) => sf.byId.get(nid)?.y ?? 0;
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <radialGradient id={`${gid}-lantern`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#fff3cf" />
          <stop offset="55%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </radialGradient>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GOLD_DEEP} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${gid}-hi`}>
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={cameraTransform(cam)}>
        {sf.edges.filter((e) => !e.isNew).map((e) => {
          const p = Math.min(exist(e.to, depthOf(e.to)), exist(e.from, depthOf(e.from)));
          if (p <= 0) return null;
          const lit = Math.min(hi(e.to), hi(e.from));
          return (
            <path key={e.id} d={e.d} fill="none" stroke={lit > 0 ? palette.accent : palette.edge}
              strokeWidth={(lit > 0 ? 3.2 : lod ? 1.3 : 2) * k} strokeLinecap="round"
              strokeDasharray={e.length} strokeDashoffset={e.length * (1 - ease.outCubic(p))}
              opacity={(lod ? 0.85 : 0.7) * Math.max(dim, lit)} />
          );
        })}
        {sf.edges.filter((e) => e.isNew).map((e) => {
          const p = bloom(e.to);
          if (p <= 0) return null;
          const draw = ease.inOutCubic(clamp(p / 0.55));
          return <ThreadPath key={e.id} id={`${gid}-${e.to}`} poly={e.poly} t1={draw} width={lod ? 2 : 3.2} scale={cam.s} head={!lod} />;
        })}
        {sf.fam.nodes.filter((n) => !n.isNew).map((n) => {
          const p = exist(n.id, n.y);
          if (p <= 0) return null;
          const pt = sf.pos.get(n.id)!;
          const h = clamp(hi(n.id));
          if (lod && h === 0) {
            return <circle key={n.id} cx={pt.x} cy={pt.y} r={Math.max(NODE_R * 0.55, 3.2 * k)} fill={palette.accent} opacity={0.75 * dim * clamp(p * 2)} />;
          }
          const s = ease.outBack(clamp(p * 1.4));
          const [l1, l2] = labelLines(n.label);
          const showLabel = h > 0 || labelAlpha > 0;
          return (
            <g key={n.id} transform={`translate(${pt.x} ${pt.y}) scale(${s})`} opacity={clamp(p * 2) * Math.max(dim, h)}>
              {h > 0 && <circle r={NODE_R * (2.3 + 0.25 * Math.sin(look.frame / 7))} fill={`url(#${gid}-hi)`} opacity={h} />}
              <circle r={NODE_R} fill={palette.node} stroke={h > 0 ? CREAM : palette.accent} strokeWidth={(h > 0 ? 3.5 : 2.4) * Math.min(k, 2.5)} />
              <text y={8} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} fill={h > 0 ? CREAM : palette.accent}>
                {n.label.trim().charAt(0).toUpperCase()}
              </text>
              {showLabel && (
                <text y={NODE_R + 24} textAnchor="middle" fontFamily={SANS} fontWeight={h > 0 ? 700 : 500}
                  fontSize={h > 0 ? 19 : 16} fill={h > 0 ? CREAM : '#d9d4f2'} opacity={Math.max(labelAlpha * 0.85, labelsOn === 'none' ? 0 : h)}
                  stroke={INK} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                  <tspan x={0}>{l1}</tspan>
                  {l2 && <tspan x={0} dy={h > 0 ? 21 : 18}>{l2}</tspan>}
                </text>
              )}
            </g>
          );
        })}
        {sf.fam.nodes.filter((n) => n.isNew).map((n) => {
          const p = bloom(n.id);
          const pop = clamp((p - 0.5) / 0.3);
          if (pop <= 0) return null;
          const pt = sf.pos.get(n.id)!;
          const ring = clamp((p - 0.5) / 0.5);
          const breathe = 1 + 0.05 * Math.sin(look.frame / 9 + (hashId(n.id) % 7));
          if (lod) {
            return (
              <g key={n.id} transform={`translate(${pt.x} ${pt.y})`}>
                <circle r={NODE_R * 2.6 * breathe} fill={`url(#${gid}-glow)`} />
                <circle r={Math.max(NODE_R * 0.8, 5 * k) * ease.outBack(pop)} fill={GOLD} />
              </g>
            );
          }
          const [l1, l2] = labelLines(n.label);
          return (
            <g key={n.id} transform={`translate(${pt.x} ${pt.y})`}>
              <circle r={NODE_R * 2.8 * breathe} fill={`url(#${gid}-glow)`} opacity={0.6 + 0.4 * (1 - ring)} />
              {ring < 1 && <circle r={NODE_R * (1 + ring * 1.8)} fill="none" stroke="#fff3cf" strokeWidth={2.2 * Math.min(k, 2)} opacity={1 - ring} />}
              <g transform={`scale(${ease.spring(pop)})`}>
                <circle r={NODE_R + 2} fill={`url(#${gid}-lantern)`} stroke="#fff3cf" strokeWidth={2.4} />
                <text y={8} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={22} fill="#5a2a12">
                  {n.label.trim().charAt(0).toUpperCase()}
                </text>
              </g>
              <g opacity={newLabelAlpha * clamp((p - 0.62) / 0.25)} transform={`translate(0 ${(1 - clamp((p - 0.62) / 0.25)) * 10})`}>
                <text y={NODE_R + 28} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={20}
                  fill={CREAM} stroke={INK} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                  <tspan x={0}>{l1}</tspan>
                  {l2 && <tspan x={0} dy={22}>{l2}</tspan>}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
