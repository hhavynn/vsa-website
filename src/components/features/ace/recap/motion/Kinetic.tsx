import React from 'react';
import { clamp01, ease, hashId, lerp, rand, seg } from './easing';
import type { Ease } from './easing';

/**
 * Kinetic typography primitives. Every value derives from the frame, so the
 * same text animates identically in Remotion and in the browser player.
 */

export const SERIF = '"Instrument Serif", "DM Serif Display", Georgia, serif';
export const SANS = '"DM Sans", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export interface UnitMotion {
  x?: number; // em
  y?: number; // em
  rot?: number; // deg
  scale?: number;
  opacity?: number;
}

export interface KineticTextProps {
  text: string;
  /** Local frame. */
  f: number;
  start?: number;
  by?: 'char' | 'word';
  stagger?: number;
  dur?: number;
  ease?: Ease;
  /** Where each unit comes from (relative to rest). */
  from?: UnitMotion;
  /** Random per-unit rotation jitter (deg) on entry — the "hand-set type" feel. */
  jitter?: number;
  /** Clip each line so units rise from behind a baseline. */
  mask?: boolean;
  /** Letter-spacing (em) animating from [0] to [1] over trackDur frames from start. */
  tracking?: [number, number];
  trackDur?: number;
  exit?: { at: number; dur?: number; stagger?: number; to?: UnitMotion; ease?: Ease };
  color?: string | ((index: number, unit: string) => string | undefined);
  style?: React.CSSProperties;
  className?: string;
}

function unitStyle(m: UnitMotion, k: number): React.CSSProperties {
  // k = 0 → at `m`, k = 1 → at rest.
  const x = lerp(m.x ?? 0, 0, k);
  const y = lerp(m.y ?? 0, 0, k);
  const r = lerp(m.rot ?? 0, 0, k);
  const s = lerp(m.scale ?? 1, 1, k);
  return { transform: `translate(${x}em, ${y}em) rotate(${r}deg) scale(${s})`, opacity: lerp(m.opacity ?? 0, 1, clamp01(k * 1.6)) };
}

export function KineticText({
  text, f, start = 0, by = 'char', stagger = 1.6, dur = 18, ease: e = ease.outBack,
  from = { y: 0.9, opacity: 0 }, jitter = 0, mask = false, tracking, trackDur = 40, exit, color, style, className,
}: KineticTextProps) {
  const units = by === 'char' ? Array.from(text) : text.split(/(\s+)/);
  const seed = hashId(text);
  const letterSpacing = tracking ? `${lerp(tracking[0], tracking[1], ease.outCubic(seg(f, start, trackDur)))}em` : undefined;
  let visible = 0;
  return (
    <span className={className} style={{ display: 'inline-block', whiteSpace: 'pre', letterSpacing, ...style }} aria-label={text}>
      {units.map((u, i) => {
        if (/^\s+$/.test(u)) return <span key={i} style={{ display: 'inline-block', width: by === 'char' ? '0.26em' : undefined }}>{by === 'word' ? u : ' '}</span>;
        const n = visible++;
        const k = e(seg(f, start + n * stagger, dur));
        const j = jitter ? (rand(seed + n) - 0.5) * 2 * jitter : 0;
        let st = unitStyle({ ...from, rot: (from.rot ?? 0) + j }, k);
        if (exit && f >= exit.at) {
          const kx = (exit.ease ?? ease.inCubic)(seg(f, exit.at + n * (exit.stagger ?? 0.8), exit.dur ?? 12));
          const to = exit.to ?? { y: -0.6, opacity: 0 };
          st = {
            transform: `translate(${lerp(0, to.x ?? 0, kx)}em, ${lerp(0, to.y ?? 0, kx)}em) rotate(${lerp(0, to.rot ?? 0, kx)}deg) scale(${lerp(1, to.scale ?? 1, kx)})`,
            opacity: lerp(1, to.opacity ?? 0, kx),
          };
        }
        const c = typeof color === 'function' ? color(n, u) : color;
        const inner = <span style={{ display: 'inline-block', willChange: 'transform', ...st, color: c }}>{u}</span>;
        return mask
          ? <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.12em', marginBottom: '-0.12em', verticalAlign: 'bottom' }}>{inner}</span>
          : <React.Fragment key={i}>{inner}</React.Fragment>;
      })}
    </span>
  );
}

/** Rolling counter: digits slide like a mechanical display. */
export function Counter({ value, from = 0, f, start, dur = 36, style, prefix = '' }: { value: number; from?: number; f: number; start: number; dur?: number; style?: React.CSSProperties; prefix?: string }) {
  const k = ease.outExpo(seg(f, start, dur));
  // Counts from `from` (e.g. last year's size) so it never reads as a decrease.
  const shown = Math.round(lerp(from, value, k));
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{prefix}{shown.toLocaleString('en-US')}</span>;
}

/**
 * The "editor annotation" frame: a dashed box with corner handles and a tiny
 * mono label that draws itself (side by side, clockwise) around a subject.
 */
export function DashedFrame({ x, y, w, h, f, start, dur = 16, label, color = 'rgba(255,246,230,0.75)', exitAt }: {
  x: number; y: number; w: number; h: number; f: number; start: number; dur?: number; label?: string; color?: string; exitAt?: number;
}) {
  const k = ease.outCubic(seg(f, start, dur));
  const out = exitAt !== undefined ? 1 - ease.inCubic(seg(f, exitAt, 10)) : 1;
  if (k <= 0 || out <= 0) return null;
  const sides: Array<[number, number, number, number]> = [
    [x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y],
  ];
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: out }} width={1} height={1} aria-hidden>
      {sides.map(([x1, y1, x2, y2], i) => {
        const p = clamp01(k * 4 - i);
        if (p <= 0) return null;
        return <line key={i} x1={x1} y1={y1} x2={lerp(x1, x2, p)} y2={lerp(y1, y2, p)} stroke={color} strokeWidth={1.4} strokeDasharray="6 5" />;
      })}
      {[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([hx, hy], i) => (
        <rect key={i} x={hx - 4} y={hy - 4} width={8} height={8} fill="none" stroke={color} strokeWidth={1.5}
          opacity={clamp01((k - 0.7) / 0.3)} />
      ))}
      {label && (
        <text x={x} y={y + h + 20} fill={color} fontFamily={MONO} fontSize={13} letterSpacing="0.18em"
          opacity={clamp01((k - 0.5) / 0.5)}>{label.toUpperCase()}</text>
      )}
    </svg>
  );
}
