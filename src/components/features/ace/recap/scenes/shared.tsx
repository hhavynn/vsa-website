import React from 'react';
import type { RecapPresentationFamily } from '../../../../../lib/aceRecap/recapSnapshot';
import { STAGE_W, CREAM, GOLD, INK, boxOfIds, toScreen } from '../stageModel';
import type { Camera, StageFamily } from '../stageModel';
import { clamp01, ease, seg } from '../motion/easing';
import { Counter, KineticText, MONO, SANS, SERIF } from '../motion/Kinetic';

export const displayFamilyName = (name: string) => name.replace(/^\s*\(dead\)\s*/i, '').trim() || name;

export function Scrim({ side, strength = 1 }: { side: 'bottom' | 'left' | 'top'; strength?: number }) {
  const bg = side === 'bottom'
    ? 'linear-gradient(to top, rgba(11,16,48,0.94) 0%, rgba(11,16,48,0.6) 42%, rgba(11,16,48,0) 100%)'
    : side === 'top'
      ? 'linear-gradient(to bottom, rgba(11,16,48,0.88) 0%, rgba(11,16,48,0) 100%)'
      : 'linear-gradient(to right, rgba(11,16,48,0.95) 0%, rgba(11,16,48,0.72) 55%, rgba(11,16,48,0) 100%)';
  const box: React.CSSProperties = side === 'bottom' ? { left: 0, right: 0, bottom: 0, height: 400 }
    : side === 'top' ? { left: 0, right: 0, top: 0, height: 290 } : { left: 0, top: 0, bottom: 0, width: 880 };
  return <div aria-hidden style={{ position: 'absolute', ...box, background: bg, opacity: strength }} />;
}

/** Family title block: index kicker, kinetic name, optional underline thread. */
export function FamilyTitle({ f, start, fam, index, total, accent, position, size = 120 }: {
  f: number; start: number; fam: RecapPresentationFamily; index: number; total?: number; accent: string;
  position: 'top-left' | 'left-middle' | 'bottom-left' | 'top-right'; size?: number;
}) {
  const pos: React.CSSProperties = position === 'top-left' ? { left: 120, top: 92 }
    : position === 'left-middle' ? { left: 120, top: 330, width: 660 }
      : position === 'bottom-left' ? { left: 120, bottom: 110 } : { right: 120, top: 92, textAlign: 'right' };
  const ul = ease.inOutExpo(seg(f, start + 14, 22));
  const name = displayFamilyName(fam.name);
  return (
    <div style={{ position: 'absolute', ...pos }}>
      <div style={{ fontFamily: MONO, fontSize: 18, color: 'rgba(255,246,230,0.72)' }}>
        <KineticText text={`FAMILY ${String(index).padStart(2, '0')}${total ? ` / ${String(total).padStart(2, '0')}` : ''}`} f={f} start={start} stagger={0.6} dur={10}
          from={{ opacity: 0 }} tracking={[0.7, 0.32]} trackDur={30} ease={ease.linear} />
      </div>
      <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1.02, color: accent, marginTop: 4, whiteSpace: 'nowrap' }}>
        <KineticText text={name} f={f} start={start + 4} stagger={1.4} dur={18} mask from={{ y: 1, opacity: 1 }} ease={ease.outQuint} />
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${GOLD}, ${GOLD}00)`, width: `${ul * Math.min(560, name.length * size * 0.42)}px`, marginTop: 4,
        marginLeft: position === 'top-right' ? 'auto' : undefined }} />
    </div>
  );
}

/** Accurate growth metrics with staggered kinetic entry. */
export function Metrics({ f, start, fam, compact = false }: { f: number; start: number; fam: RecapPresentationFamily; compact?: boolean }) {
  const items: Array<{ big: React.ReactNode; label: string; gold?: boolean }> = [
    { big: <Counter value={fam.added} f={f} start={start} dur={26} prefix="+" />, label: fam.added === 1 ? 'new Little' : 'new Littles', gold: true },
    { big: String(fam.growth.length), label: fam.growth.length === 1 ? 'Big' : 'Bigs' },
    { big: <>{fam.before.people}<span style={{ opacity: 0.5 }}>→</span><Counter value={fam.after.people} from={fam.before.people} f={f} start={start + 6} dur={26} /></>, label: 'members' },
    { big: `${fam.before.generations}→${fam.after.generations}`, label: 'generations' },
  ];
  const size = compact ? 64 : 84;
  return (
    <div style={{ position: 'absolute', right: 120, bottom: 92, display: 'flex', gap: compact ? 44 : 60, alignItems: 'flex-end' }}>
      {items.map((it, i) => {
        const k = ease.outQuint(seg(f, start + i * 5, 18));
        return (
          <div key={it.label} style={{ opacity: k, transform: `translateY(${(1 - k) * 26}px)` }}>
            <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 0.95, color: it.gold ? GOLD : CREAM, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{it.big}</div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,246,230,0.7)', marginTop: 6 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Focused callouts for the biggest new branches when the tree is too small
 * to read: leader line from the real Big to a chip with its name and count.
 */
export function Callouts({ sf, cam, f, start, max = 3, maxY = 790 }: { sf: StageFamily; cam: Camera; f: number; start: number; max?: number; maxY?: number }) {
  if (cam.s > 0.55) return null;
  const groups = [...sf.fam.growth].sort((a, b) => b.littleIds.length - a.littleIds.length || a.bigLabel.localeCompare(b.bigLabel)).slice(0, max);
  const placed = groups.map((g) => {
    const box = boxOfIds(sf, [g.bigNodeId, ...g.littleIds], 0);
    const anchor = toScreen(cam, { x: box.x + box.w / 2, y: box.y + box.h });
    return { g, anchor, x: Math.min(STAGE_W - 330, Math.max(120, anchor.x - 120)) };
  }).sort((a, b) => a.x - b.x);
  const treeBottom = toScreen(cam, { x: sf.bounds.x, y: sf.bounds.y + sf.bounds.h }).y;
  const chipY = Math.min(maxY, treeBottom + 24);
  for (let i = 1; i < placed.length; i++) placed[i].x = Math.max(placed[i].x, placed[i - 1].x + 340);
  const overflow = placed.length ? placed[placed.length - 1].x - (STAGE_W - 330) : 0;
  if (overflow > 0) placed.forEach((p) => { p.x -= overflow; });
  return (
    <svg width={STAGE_W} height={1080} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {placed.map(({ g, anchor, x }, i) => {
        const k = ease.outCubic(seg(f, start + i * 6, 16));
        if (k <= 0) return null;
        const label = `${g.bigLabel}  +${g.littleIds.length}`;
        const w = Math.max(200, label.length * 13 + 40);
        return (
          <g key={g.bigNodeId} opacity={k}>
            <path d={`M${anchor.x} ${anchor.y + 6} L${anchor.x} ${chipY + 22} L${x} ${chipY + 22}`} fill="none" stroke={GOLD} strokeWidth={1.4}
              strokeDasharray="4 4" opacity={0.8 * clamp01(k * 1.4)} />
            <circle cx={anchor.x} cy={anchor.y + 6} r={4} fill={GOLD} />
            <rect x={x} y={chipY} width={w} height={44} rx={22} fill={INK} stroke={GOLD} strokeWidth={1.4} opacity={0.92} />
            <text x={x + 20} y={chipY + 29} fontFamily={SANS} fontWeight={700} fontSize={20} fill={CREAM}>
              {g.bigLabel}<tspan fill={GOLD}>  +{g.littleIds.length}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
