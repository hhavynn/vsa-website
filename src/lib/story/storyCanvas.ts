// Reusable building blocks for canvas-rendered Instagram Story graphics.
// Templates (Top 3, future House standings / event promos) compose these so
// every story shares the same canvas size, safe zones, fonts, and export path.
// The preview IS the export: both are the same 1080×1920 canvas.

import { getAvatarInitials, getInitialsAvatarColors } from '../initialsAvatar';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

/**
 * Instagram overlays the profile row/progress bar at the top and the reply
 * bar at the bottom (~14% each). Keep text and faces out of these bands.
 */
export const STORY_SAFE_TOP = 250;
export const STORY_SAFE_BOTTOM = 250;

export const STORY_FONTS = {
  display: '"DM Serif Display", Georgia, serif',
  sans: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
} as const;

export type StoryTheme = 'dark' | 'light';

export interface StoryPalette {
  /** Backdrop gradient, top → bottom. */
  backdrop: readonly [string, string, string];
  glow: { teal: number; gold: number; coral: number };
  threadAlpha: number;
  text: string;
  textMuted: string;
  accent: string;
  headlineGradient: readonly [string, string];
  crownGradient: readonly [string, string];
  championPoints: string;
  card: string;
  medallionBorder: string;
  medallionText: string;
  logoRing: string;
  /** Multiplier applied to House colors used as text (darkens pale Houses on light). */
  houseInk: number;
  rank: Record<1 | 2 | 3, string>;
}

const BRAND = {
  teal: '#3bbdb5',
  coral: '#e8623a',
  gold: '#d4841a',
  goldLight: '#f2c46b',
} as const;

/** Story palettes built from the site's tokens (index.css light/dark values). */
export const STORY_PALETTES: Record<StoryTheme, StoryPalette> = {
  dark: {
    backdrop: ['#122430', '#0d1a20', '#081217'],
    glow: { teal: 0.2, gold: 0.16, coral: 0.14 },
    threadAlpha: 0.1,
    text: '#f3e9da',
    textMuted: '#b9ab98',
    accent: BRAND.teal,
    headlineGradient: [BRAND.goldLight, BRAND.coral],
    crownGradient: [BRAND.goldLight, BRAND.gold],
    championPoints: BRAND.goldLight,
    card: 'rgba(18,36,48,0.72)',
    medallionBorder: '#0d1a20',
    medallionText: '#081217',
    logoRing: '#f3e9da',
    houseInk: 1,
    rank: { 1: BRAND.gold, 2: '#c9d3d6', 3: '#c27a4a' },
  },
  light: {
    backdrop: ['#fdf7f0', '#f5f1ea', '#efe5d6'],
    glow: { teal: 0.16, gold: 0.2, coral: 0.12 },
    threadAlpha: 0.16,
    text: '#142028',
    textMuted: '#4a6b68',
    accent: '#1e8878',
    headlineGradient: [BRAND.gold, '#c2461f'],
    crownGradient: [BRAND.goldLight, BRAND.gold],
    championPoints: '#9a5208',
    card: 'rgba(255,255,255,0.8)',
    medallionBorder: '#fdf7f0',
    medallionText: '#142028',
    logoRing: '#c4b8a8',
    houseInk: 0.62,
    rank: { 1: BRAND.gold, 2: '#9aa8ad', 3: '#b0683a' },
  },
};

export type StoryDrawFn = (ctx: CanvasRenderingContext2D) => void;

/** Resolves once the site's webfonts are usable by canvas (no-op where unsupported). */
export async function ensureStoryFonts(): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  await Promise.all(
    [
      `400 120px ${STORY_FONTS.display}`,
      `italic 400 120px ${STORY_FONTS.display}`,
      `500 40px ${STORY_FONTS.sans}`,
      `700 40px ${STORY_FONTS.sans}`,
      `600 40px ${STORY_FONTS.mono}`,
    ].map((font) => fonts.load(font).catch(() => [])),
  );
}

/**
 * Loads an image for canvas drawing with CORS enabled so the canvas stays
 * exportable. Any failure (404, missing CORS headers, timeout) resolves to
 * null so the caller falls back to the initials avatar.
 */
export async function loadStoryImage(url: string | null | undefined, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  if (!url) return null;
  // Public pages load avatars without CORS; a cached non-CORS copy can make a
  // CORS request fail, so retry once with a distinct URL before giving up.
  return (await loadCorsImage(url, timeoutMs))
    ?? loadCorsImage(`${url}${url.includes('?') ? '&' : '?'}story=1`, timeoutMs);
}

function loadCorsImage(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

export function setFont(ctx: CanvasRenderingContext2D, weight: string | number, sizePx: number, family: string) {
  ctx.font = `${weight} ${sizePx}px ${family}`;
}

/**
 * Largest font size (stepping down from `maxSize`) at which `text` fits
 * `maxWidth`; below `minSize` the text is ellipsized at `minSize`.
 */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  { weight, family, maxSize, minSize }: { weight: string | number; family: string; maxSize: number; minSize: number },
): { text: string; size: number } {
  for (let size = maxSize; size >= minSize; size -= 2) {
    setFont(ctx, weight, size, family);
    if (ctx.measureText(text).width <= maxWidth) return { text, size };
  }
  setFont(ctx, weight, minSize, family);
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated.trimEnd()}…`, size: minSize };
}

/**
 * Like fitText, but before ellipsizing tries a balanced two-line word split
 * (sized from `wrapMaxSize` down to `minSize`).
 */
export function fitTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  opts: { weight: string | number; family: string; maxSize: number; minSize: number; wrapMaxSize: number },
): { lines: string[]; size: number } {
  const { weight, family, maxSize, minSize, wrapMaxSize } = opts;
  for (let size = maxSize; size >= minSize; size -= 2) {
    setFont(ctx, weight, size, family);
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size };
  }

  const words = text.split(' ');
  if (words.length > 1) {
    for (let size = wrapMaxSize; size >= minSize; size -= 2) {
      setFont(ctx, weight, size, family);
      let best: string[] | null = null;
      let bestWidth = Infinity;
      for (let i = 1; i < words.length; i += 1) {
        const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
        const width = Math.max(...pair.map((line) => ctx.measureText(line).width));
        if (width < bestWidth) {
          best = pair;
          bestWidth = width;
        }
      }
      if (best && bestWidth <= maxWidth) return { lines: best, size };
    }
  }

  const single = fitText(ctx, text, maxWidth, { weight, family, maxSize: minSize, minSize });
  return { lines: [single.text], size: single.size };
}

/** Letter-spaced text centered on `cx` (canvas letterSpacing isn't universally supported). */
export function fillTrackedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws `img` cover-fit into a circle, or the initials avatar when absent. */
export function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (img) {
    const scale = Math.max((radius * 2) / img.naturalWidth, (radius * 2) / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    const colors = getInitialsAvatarColors(name);
    ctx.fillStyle = colors.background;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = colors.foreground;
    setFont(ctx, 600, Math.round(radius * 0.72), STORY_FONTS.sans);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getAvatarInitials(name), cx, cy + radius * 0.04);
  }
  ctx.restore();
}

/** Pill with centered label; returns the drawn width. */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  label: string,
  centerX: number,
  y: number,
  { color, fill, sizePx = 26, padX = 22, height = 50 }: { color: string; fill: string; sizePx?: number; padX?: number; height?: number },
): number {
  setFont(ctx, 600, sizePx, STORY_FONTS.mono);
  const width = ctx.measureText(label).width + padX * 2;
  const x = centerX - width / 2;
  roundRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, centerX, y + height / 2 + 1);
  return width;
}

/** `#rrggbb` → `rgba(r,g,b,a)`; passes through anything else unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Themed backdrop with soft brand glows and the drifting "threads" motif from
 * the homepage hero (ThreadsBackground), so stories read as VSA.
 */
export function drawStoryBackdrop(ctx: CanvasRenderingContext2D, palette: StoryPalette) {
  const { width, height } = ctx.canvas;
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, palette.backdrop[0]);
  base.addColorStop(0.55, palette.backdrop[1]);
  base.addColorStop(1, palette.backdrop[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(color, alpha));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  };
  glow(width * 0.5, height * 0.42, 720, BRAND.gold, palette.glow.gold);
  glow(width * 0.05, height * 0.12, 620, BRAND.teal, palette.glow.teal);
  glow(width * 0.98, height * 0.86, 640, BRAND.coral, palette.glow.coral);

  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const offset = i * 46;
    ctx.strokeStyle = withAlpha(i % 3 === 0 ? BRAND.coral : BRAND.teal, palette.threadAlpha + (i % 2) * 0.05);
    ctx.beginPath();
    ctx.moveTo(-60, 1540 + offset);
    ctx.bezierCurveTo(300, 1380 + offset, 700, 1760 + offset * 0.6, 1140, 1500 + offset * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-60, 140 + offset * 0.7);
    ctx.bezierCurveTo(360, 320 + offset * 0.5, 760, 20 + offset, 1140, 210 + offset * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Scales a `#rrggbb` color's channels by `factor` (< 1 darkens); passes through anything else. */
export function shade(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match || factor === 1) return hex;
  const n = parseInt(match[1], 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * factor).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export story image'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
