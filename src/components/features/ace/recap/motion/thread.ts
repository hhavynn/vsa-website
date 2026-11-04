/**
 * The thread: the recap's visual signature. A polyline sampled from REAL
 * tree edges (or from an abstract decorative path) that can draw itself,
 * carry a moving highlight, and morph into another shape (an underline, a
 * fork, the next scene's first edge).
 */
import { lerp } from './easing';

export interface Pt { x: number; y: number }
export type Poly = Pt[];

/** Parses absolute M / L / C path data (what edgeGeometry produces) into points. */
export function samplePath(d: string, perCurve = 18): Poly {
  const tokens = d.match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Poly = [];
  let i = 0;
  let cmd = '';
  let cur: Pt = { x: 0, y: 0 };
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[MLC]$/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'M' || cmd === 'L') {
      cur = { x: num(), y: num() };
      out.push(cur);
    } else if (cmd === 'C') {
      const p1 = { x: num(), y: num() };
      const p2 = { x: num(), y: num() };
      const p3 = { x: num(), y: num() };
      const p0 = cur;
      for (let k = 1; k <= perCurve; k++) {
        const t = k / perCurve;
        const u = 1 - t;
        out.push({
          x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
          y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
        });
      }
      cur = p3;
    } else {
      i++;
    }
  }
  return out;
}

export function concatPolys(polys: readonly Poly[]): Poly {
  const out: Poly = [];
  for (const p of polys) for (const pt of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 0.01) out.push(pt);
  }
  return out;
}

export function lengths(poly: Poly): number[] {
  const acc = [0];
  for (let i = 1; i < poly.length; i++) acc.push(acc[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  return acc;
}

/** Point at arc-length fraction t (0..1). */
export function pointAt(poly: Poly, t: number, acc = lengths(poly)): Pt {
  if (poly.length === 0) return { x: 0, y: 0 };
  const total = acc[acc.length - 1] || 1;
  const target = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < acc.length && acc[i] < target) i++;
  if (i >= poly.length) return poly[poly.length - 1];
  const span = acc[i] - acc[i - 1] || 1;
  const k = (target - acc[i - 1]) / span;
  return { x: lerp(poly[i - 1].x, poly[i].x, k), y: lerp(poly[i - 1].y, poly[i].y, k) };
}

/** Resample to n points evenly spaced by arc length. */
export function resample(poly: Poly, n: number): Poly {
  const acc = lengths(poly);
  return Array.from({ length: n }, (_, i) => pointAt(poly, n === 1 ? 0 : i / (n - 1), acc));
}

/** The sub-path between arc fractions t0..t1 as SVG path data. */
export function partial(poly: Poly, t0: number, t1: number, steps = 64): string {
  if (poly.length < 2 || t1 <= t0) return '';
  const acc = lengths(poly);
  const pts: Pt[] = [];
  const n = Math.max(2, Math.ceil(steps * (t1 - t0)) + 1);
  for (let i = 0; i < n; i++) pts.push(pointAt(poly, t0 + ((t1 - t0) * i) / (n - 1), acc));
  return toPath(pts);
}

export const toPath = (pts: Poly) =>
  pts.length ? 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L') : '';

/** Morph between two shapes point by point (both resampled to n). */
export function morph(a: Poly, b: Poly, t: number, n = 64): Poly {
  const ra = resample(a, n);
  const rb = resample(b, n);
  return ra.map((p, i) => ({ x: lerp(p.x, rb[i].x, t), y: lerp(p.y, rb[i].y, t) }));
}

/** A straight line poly, e.g. an underline target for a morph. */
export const line = (a: Pt, b: Pt): Poly => [a, b];

export const mapPoly = (poly: Poly, fn: (p: Pt) => Pt): Poly => poly.map(fn);
