import React from 'react';
import { STAGE_H, STAGE_W } from '../stageModel';
import type { Camera } from '../stageModel';
import { rand } from './easing';

/**
 * Graphic layers that give the flat SVG depth: night sky with parallax
 * depth planes, rice-paper ground for the light scenes, film grain and a
 * lens vignette. All deterministic per frame.
 */

export const NIGHT = { top: '#232a66', mid: '#141a45', deep: '#0b1030' };
export const PAPER = { base: '#f4efe4', ink: '#1b1f3f', edge: '#e4dccb' };

/** Night sky. Star planes move with the camera at different depths (parallax). */
export function NightSky({ frame, cam, tint = '#7a5fc0' }: { frame: number; cam?: Camera; tint?: string }) {
  const t = frame / 30;
  const planes = [0.05, 0.12, 0.22];
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <radialGradient id="ns-core" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={NIGHT.top} />
          <stop offset="58%" stopColor={NIGHT.mid} />
          <stop offset="100%" stopColor={NIGHT.deep} />
        </radialGradient>
        <radialGradient id="ns-tint" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tint} stopOpacity="0.32" />
          <stop offset="100%" stopColor={tint} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill="url(#ns-core)" />
      <ellipse cx={460 + Math.sin(t * 0.2) * 110} cy={300 + Math.cos(t * 0.16) * 60} rx={760} ry={540} fill="url(#ns-tint)" />
      <ellipse cx={1500 + Math.cos(t * 0.18) * 120} cy={820} rx={700} ry={460} fill="url(#ns-tint)" opacity={0.6} />
      {planes.map((depth, p) => {
        const ox = cam ? -cam.cx * cam.s * depth : 0;
        const oy = cam ? -cam.cy * cam.s * depth : 0;
        return Array.from({ length: 46 }, (_, i) => {
          const seed = p * 1000 + i;
          const x = (((rand(seed * 3.1) * STAGE_W + ox) % STAGE_W) + STAGE_W) % STAGE_W;
          const y = (((rand(seed * 7.7) * STAGE_H + oy + t * (2 + p * 3)) % STAGE_H) + STAGE_H) % STAGE_H;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + rand(seed)) + i));
          return <circle key={seed} cx={x} cy={y} r={0.5 + p * 0.7 + rand(seed * 5.3)} fill="#e9e4ff" opacity={(0.08 + p * 0.1) * tw} />;
        });
      })}
    </svg>
  );
}

/** Warm rice-paper ground with faint fibres; used for the typographic scenes. */
export function Paper({ frame }: { frame: number }) {
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <defs>
        <radialGradient id="pp-light" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#fbf8f1" />
          <stop offset="70%" stopColor={PAPER.base} />
          <stop offset="100%" stopColor={PAPER.edge} />
        </radialGradient>
        <filter id="pp-fibre" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves={2} seed={3} />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.09 0" />
        </filter>
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill="url(#pp-light)" />
      <rect width={STAGE_W} height={STAGE_H} filter="url(#pp-fibre)" transform={`translate(${Math.sin(frame / 90) * 3} 0)`} />
    </svg>
  );
}

/** Film grain: seeded noise that changes every 2 frames. */
export function Grain({ frame, opacity = 0.07 }: { frame: number; opacity?: number }) {
  const seed = Math.floor(frame / 2) % 12;
  return (
    <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', pointerEvents: 'none' }} aria-hidden>
      <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={STAGE_W} height={STAGE_H} filter={`url(#grain-${seed})`} opacity={opacity * 6} />
    </svg>
  );
}

/** Lens vignette; `strength` 0..1. */
export function Vignette({ strength = 0.55, color = '0,0,0' }: { strength?: number; color?: string }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at 50% 48%, rgba(${color},0) 52%, rgba(${color},${strength}) 100%)`,
    }} />
  );
}
