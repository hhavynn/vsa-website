import React from 'react';
import { partial, pointAt } from './thread';
import type { Poly } from './thread';

export const THREAD_GOLD = '#ffd27a';
export const THREAD_CORE = '#fff3cf';

/**
 * Draws a thread along `poly` from arc fraction t0 to t1, with a bright
 * trailing highlight and a glowing head at t1. Units are those of the parent
 * coordinate space (pass `scale` when drawing in world space so the stroke
 * keeps a constant on-screen width).
 */
export function ThreadPath({ poly, t0 = 0, t1, width = 4, color = THREAD_GOLD, head = true, scale = 1, opacity = 1, id }: {
  poly: Poly; t0?: number; t1: number; width?: number; color?: string; head?: boolean; scale?: number; opacity?: number; id: string;
}) {
  if (poly.length < 2 || t1 <= t0) return null;
  const k = 1 / Math.max(scale, 0.05);
  const tip = pointAt(poly, t1);
  const trail = partial(poly, Math.max(t0, t1 - 0.08), t1, 16);
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={`th-${id}`}>
          <stop offset="0%" stopColor={THREAD_CORE} stopOpacity="0.95" />
          <stop offset="40%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={partial(poly, t0, t1)} fill="none" stroke={color} strokeWidth={width * k * 2.6} strokeLinecap="round" opacity={0.16} />
      <path d={partial(poly, t0, t1)} fill="none" stroke={color} strokeWidth={width * k} strokeLinecap="round" strokeLinejoin="round" />
      {head && t1 < 0.999 && (
        <>
          <path d={trail} fill="none" stroke={THREAD_CORE} strokeWidth={width * k * 1.4} strokeLinecap="round" />
          <circle cx={tip.x} cy={tip.y} r={38 * k} fill={`url(#th-${id})`} />
          <circle cx={tip.x} cy={tip.y} r={width * k * 1.3} fill={THREAD_CORE} />
        </>
      )}
    </g>
  );
}
