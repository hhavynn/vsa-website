/**
 * Deterministic easing + camera grammar for the ACE recap. Everything is a
 * pure function of the frame, so Remotion and the browser player agree.
 */

export type Ease = (t: number) => number;
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const ease = {
  linear: ((t) => clamp01(t)) as Ease,
  inOutCubic: ((t) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }) as Ease,
  outCubic: ((t) => 1 - Math.pow(1 - clamp01(t), 3)) as Ease,
  outQuint: ((t) => 1 - Math.pow(1 - clamp01(t), 5)) as Ease,
  inCubic: ((t) => Math.pow(clamp01(t), 3)) as Ease,
  /** Fast start, long settle: whip moves that land softly. */
  outExpo: ((t) => { const x = clamp01(t); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }) as Ease,
  inExpo: ((t) => { const x = clamp01(t); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); }) as Ease,
  /** Slow-in, rush through the middle, slow-out: camera "whip" between holds. */
  inOutExpo: ((t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
  }) as Ease,
  outBack: ((t) => { const c1 = 1.7, c3 = c1 + 1, x = clamp01(t) - 1; return 1 + c3 * x * x * x + c1 * x * x; }) as Ease,
  /** Critically-damped-ish spring with a single small overshoot. */
  spring: ((t) => { const x = clamp01(t); return 1 - Math.exp(-7 * x) * Math.cos(5.2 * x) * (1 - x * 0.15); }) as Ease,
};

/** Progress of a window [start, start+dur) through an easing. */
export const seg = (f: number, start: number, dur: number, e: Ease = ease.linear) => e((f - start) / Math.max(1, dur));
/** 1 inside [start, end), ramping in and out over `ramp` frames. */
export const envelope = (f: number, start: number, end: number, rampIn = 10, rampOut = 10) =>
  Math.min(seg(f, start, rampIn, ease.outCubic), 1 - seg(f, end - rampOut, rampOut, ease.inCubic));

/** Deterministic pseudo-random in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
export const hashId = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// ─── camera ──────────────────────────────────────────────────────────────────

export interface Camera { cx: number; cy: number; s: number; /** small roll in degrees */ r?: number }
export interface CameraKey extends Camera {
  f: number;
  /** Easing used to arrive at THIS key from the previous one. */
  ease?: Ease;
}

export function mixCamera(a: Camera, b: Camera, t: number): Camera {
  return {
    cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t),
    // Zoom interpolates in log space so pushes read as constant speed.
    s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), t)),
    r: lerp(a.r ?? 0, b.r ?? 0, t),
  };
}

/**
 * Keyframed camera. Each segment has its own easing; two keys with the same
 * position make a hold. Before the first / after the last key it clamps.
 */
export function cameraAt(keys: readonly CameraKey[], f: number): Camera {
  if (!keys.length) return { cx: 0, cy: 0, s: 1 };
  if (f <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f <= k.f) {
      const p = keys[i - 1];
      return mixCamera(p, k, (k.ease ?? ease.inOutCubic)((f - p.f) / Math.max(1, k.f - p.f)));
    }
  }
  return keys[keys.length - 1];
}

/** Gentle hand-held drift so holds never feel frozen. Amplitude in screen px. */
export function drift(f: number, seed: number, amp = 6): { x: number; y: number } {
  return {
    x: Math.sin(f / 47 + seed) * amp + Math.sin(f / 23 + seed * 2) * amp * 0.35,
    y: Math.cos(f / 53 + seed * 1.3) * amp * 0.7,
  };
}
