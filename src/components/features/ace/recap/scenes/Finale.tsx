import React from 'react';
import type { AceRecapPresentation, RecapPresentationFamily } from '../../../../../lib/aceRecap/recapSnapshot';
import { finaleFamilies } from '../../../../../lib/aceRecap/recapTimeline';
import { STAGE_H, STAGE_W, CREAM, GOLD, NODE_R, fitCamera, stageFamily } from '../stageModel';
import type { Box } from '../stageModel';
import { clamp01, ease, lerp, seg } from '../motion/easing';
import { Counter, KineticText, MONO, SANS, SERIF } from '../motion/Kinetic';
import { NightSky, Vignette } from '../motion/Texture';
import { ThreadPath } from '../motion/ThreadPath';
import { line } from '../motion/thread';
import { displayFamilyName } from './shared';

/** Grid for N families inside the finale frame; every family gets a cell. */
export function finaleGrid(n: number, area: Box = { x: 100, y: 150, w: 1720, h: 740 }): Box[] {
  if (n <= 0) return [];
  const cols = Math.min(6, Math.max(1, n <= 4 ? n : Math.ceil(Math.sqrt(n * 2.2))));
  const rows = Math.ceil(n / cols);
  const cw = area.w / cols;
  const ch = area.h / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const offset = ((cols - inRow) * cw) / 2; // centre a short last row
    return { x: area.x + offset + (i % cols) * cw, y: area.y + r * ch, w: cw, h: ch };
  });
}

/** One family drawn as its own silhouette: no lines ever cross between cells. */
function MiniTree({ fam, cell, f, delay }: { fam: RecapPresentationFamily; cell: Box; f: number; delay: number }) {
  const sf = stageFamily(fam);
  const inner = { x: cell.x + 16, y: cell.y + 10, w: cell.w - 32, h: cell.h - 80 };
  const cam = fitCamera(sf.bounds, inner, 0.5, 0.94);
  const P = (id: string) => {
    const p = sf.pos.get(id)!;
    return { x: (p.x - cam.cx) * cam.s + STAGE_W / 2, y: (p.y - cam.cy) * cam.s + STAGE_H / 2 };
  };
  const r = Math.max(2.2, NODE_R * cam.s);
  const local = f - delay;
  return (
    <g>
      {sf.edges.map((e) => {
        const depth = sf.byId.get(e.to)?.y ?? 0;
        const k = e.isNew ? ease.outCubic(seg(local, 34, 16)) : ease.outCubic(seg(local, depth * 2.2, 10));
        if (k <= 0) return null;
        const a = P(e.from); const b = P(e.to);
        return <line key={e.id} x1={a.x} y1={a.y} x2={lerp(a.x, b.x, k)} y2={lerp(a.y, b.y, k)}
          stroke={e.isNew ? GOLD : sf.palette.edge} strokeWidth={e.isNew ? 1.8 : 1.1} opacity={e.isNew ? 1 : 0.85} />;
      })}
      {fam.nodes.map((n) => {
        const p = P(n.id);
        if (n.isNew) {
          const k = ease.outBack(seg(local, 44, 12));
          return k > 0 ? <g key={n.id}><circle cx={p.x} cy={p.y} r={r * 3.2} fill={GOLD} opacity={0.14 * k} /><circle cx={p.x} cy={p.y} r={r * 1.15 * k} fill={GOLD} /></g> : null;
        }
        const k = seg(local, n.y * 2.2, 8);
        return k > 0 ? <circle key={n.id} cx={p.x} cy={p.y} r={r} fill={sf.palette.node} stroke={sf.palette.accent} strokeWidth={1} opacity={k} /> : null;
      })}
    </g>
  );
}

export function Finale({ f, d, presentation }: { f: number; d: number; presentation: AceRecapPresentation }) {
  const fams = finaleFamilies(presentation);
  const cells = finaleGrid(fams.length);
  const recede = ease.inOutCubic(seg(f, 108, 40));
  const added = presentation.totals.previewed;
  const growing = presentation.totals.familiesGrowing;
  const welcome = 196;
  const forkT = ease.outCubic(seg(f, welcome + 30, 30));
  const end = 1 - ease.inCubic(seg(f, d - 22, 22));
  const branches = [-0.35, -0.1, 0.18, 0.46].map((a, i) => ({ a, i }));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <NightSky frame={f + 900} />
      <div style={{ position: 'absolute', inset: 0, opacity: lerp(1, 0.16, recede), transform: `scale(${lerp(1, 0.93, recede)})`, filter: recede > 0.1 ? `blur(${recede * 3}px)` : undefined }}>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
          {fams.map((fam, i) => <MiniTree key={fam.id} fam={fam} cell={cells[i]} f={f} delay={i * 5} />)}
        </svg>
        {fams.map((fam, i) => {
          const c = cells[i];
          const sf = stageFamily(fam);
          const k = ease.outQuint(seg(f, i * 5 + 18, 16));
          return (
            <div key={fam.id} style={{ position: 'absolute', left: c.x, width: c.w, top: c.y + c.h - 62, textAlign: 'center', opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
              <span style={{ fontFamily: SERIF, fontSize: Math.min(44, c.w / 7), color: sf.palette.accent }}>{displayFamilyName(fam.name)}</span>
              {fam.added > 0 && <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: Math.min(26, c.w / 12), color: GOLD, marginLeft: 12 }}>+{fam.added}</span>}
            </div>
          );
        })}
      </div>
      <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <ThreadPath id="fin-horizon" poly={line({ x: 120, y: 648 }, { x: 1800, y: 648 })} t1={ease.inOutExpo(seg(f, 118, 34))} width={2} opacity={0.5 * (1 - seg(f, welcome, 16))} head={false} />
        <ThreadPath id="fin-ul" poly={line({ x: 660, y: 850 }, { x: 1250, y: 850 })} t1={ease.inOutExpo(seg(f, welcome + 14, 22))} width={3} head={false} />
        {branches.map(({ a, i }) => {
          const start = { x: 1250, y: 850 };
          const end2 = { x: 1250 + 74 * Math.cos(a), y: 850 + 74 * Math.sin(a) };
          return <ThreadPath key={i} id={`fin-fork-${i}`} poly={[start, { x: lerp(start.x, end2.x, 0.5) + 10, y: start.y }, end2]} t1={forkT} width={2.4} head={false} />;
        })}
        {forkT > 0.95 && branches.map(({ a, i }) => (
          <circle key={i} cx={1250 + 74 * Math.cos(a)} cy={850 + 74 * Math.sin(a)} r={7 * ease.outBack(seg(f, welcome + 58 + i * 3, 10))} fill={GOLD} />
        ))}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', opacity: recede }}>
        <div style={{ fontFamily: MONO, fontSize: 20, color: 'rgba(255,246,230,0.72)' }}>
          <KineticText text="THE NEW GENERATION" f={f} start={112} stagger={0.6} dur={12} from={{ opacity: 0 }} tracking={[0.8, 0.34]} trackDur={40} ease={ease.linear} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 250, lineHeight: 1, color: GOLD, marginTop: 4, transform: `scale(${lerp(1.12, 1, ease.outCubic(seg(f, 120, 40)))})` }}>
          <Counter value={added} f={f} start={120} dur={46} prefix="+" />
        </div>
        <div style={{ fontFamily: SANS, fontSize: 40, color: CREAM, marginTop: 2 }}>
          <KineticText text={`new Littles across ${growing} ${growing === 1 ? 'family' : 'families'}`} f={f} start={150} by="word" stagger={3} dur={16} from={{ y: 0.7, opacity: 0 }} ease={ease.outQuint} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.22em', color: 'rgba(255,246,230,0.62)', marginTop: 14, textTransform: 'uppercase', opacity: clamp01((f - 170) / 14) }}>
          {presentation.totals.peopleAfter.toLocaleString('en-US')} names across every ACE family tree
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 120, lineHeight: 1, color: CREAM }}>
          <KineticText text="Welcome to the family." f={f} start={welcome} stagger={1.2} dur={22} mask from={{ y: 1, opacity: 1 }} ease={ease.outQuint} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.3em', color: 'rgba(255,246,230,0.66)', marginTop: 112, opacity: clamp01((f - welcome - 46) / 16) }}>
          VSA AT UCSD · ACE · FIND YOUR BRANCH ON THE VSA WEBSITE
        </div>
      </div>
      <Vignette strength={0.5} />
      <div style={{ position: 'absolute', inset: 0, background: '#05081c', opacity: 1 - end }} />
    </div>
  );
}
