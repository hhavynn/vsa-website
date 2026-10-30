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
  // Instrument Serif is the #761 display face; DM Serif Display is only a fallback.
  display: '"Instrument Serif", "DM Serif Display", Georgia, serif',
  sans: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
} as const;

export type StoryTheme = 'dark' | 'light';
export type MedalRank = 1 | 2 | 3;

interface StoryBloom {
  /** Center as a fraction of the canvas. */
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

export interface StoryPalette {
  /** Diagonal field, top-left → bottom-right, like VSA's photo-band posts. */
  field: readonly [string, string, string];
  blooms: readonly StoryBloom[];
  /** Strength of the film grain overlay (0 disables it). */
  grain: number;
  text: string;
  textMuted: string;
  /** Pill outlines, the handle, eyebrow labels. */
  accent: string;
  /** Soft shadow behind type so it stays legible over the blooms. */
  textShadow: string;
  /** The italic "at" in the wordmark. */
  wordmarkAt: string;
  /** Headline fill, left → right. */
  headline: readonly [string, string, string];
  glass: string;
  glassStroke: string;
  polaroid: string;
  polaroidInk: string;
  polaroidMuted: string;
  /** Photo mat while a portrait is missing or failed (initials sit on it). */
  polaroidMat: string;
  cardShadow: string;
  star: string;
  starGlow: string;
  bubbleTint: string;
  /** Multiplier applied to House colors used as text (darkens pale Houses on light). */
  houseInk: number;
  /** Solid medal tones (strokes, rank text). */
  rank: Record<MedalRank, string>;
  /** Metallic medal fills, highlight → body. */
  medal: Record<MedalRank, readonly [string, string]>;
  medalText: string;
}

/** The palette in one line: VSA's sky → periwinkle → lavender → blush. */
export const STORY_RIBBON = ['#a8d9f0', '#718bd4', '#c8b8e8', '#f0ccd9'] as const;

const MEDALS: Record<MedalRank, readonly [string, string]> = {
  1: ['#fff3c9', '#e0a63c'],
  2: ['#ffffff', '#b4bcdc'],
  3: ['#ffe0d2', '#c4785a'],
};

/**
 * Story palettes from the #761 identity. "dark" is the saturated blue-hour
 * field of VSA's photo posts with white type; "light" is the luminous
 * sky-to-lavender daydream with ink type. Medal tones stay gold/silver/bronze
 * so rank still reads at a glance.
 */
export const STORY_PALETTES: Record<StoryTheme, StoryPalette> = {
  dark: {
    field: ['#2747b4', '#4b56c6', '#6a55bd'],
    blooms: [
      { x: 0.12, y: 0.06, radius: 620, color: '#c1ddff', alpha: 0.32 },
      { x: 0.94, y: 0.14, radius: 560, color: '#c9acf4', alpha: 0.36 },
      { x: 0.5, y: 0.45, radius: 700, color: '#8fa6ff', alpha: 0.18 },
      { x: 0.02, y: 0.9, radius: 760, color: '#78beff', alpha: 0.34 },
      { x: 0.98, y: 1.02, radius: 880, color: '#f4b0de', alpha: 0.42 },
    ],
    grain: 0.05,
    text: '#ffffff',
    textMuted: '#e4e2fb',
    accent: '#ffffff',
    textShadow: 'rgba(18,24,82,0.42)',
    wordmarkAt: '#e7d6ff',
    headline: ['#ffffff', '#f8dcf1', '#cfdcff'],
    glass: 'rgba(255,255,255,0.13)',
    glassStroke: 'rgba(255,255,255,0.4)',
    polaroid: '#faf9f5',
    polaroidInk: '#28354d',
    polaroidMuted: '#6c628d',
    polaroidMat: '#e7e9f6',
    cardShadow: 'rgba(17,22,72,0.42)',
    star: '#ffffff',
    starGlow: 'rgba(255,255,255,0.9)',
    bubbleTint: '#f4bcee',
    houseInk: 1,
    rank: { 1: '#f5c86a', 2: '#e3e7f8', 3: '#efb196' },
    medal: MEDALS,
    medalText: '#28354d',
  },
  light: {
    field: ['#cfe3fb', '#d9dcf7', '#eedff4'],
    blooms: [
      { x: 0.1, y: 0.08, radius: 640, color: '#ffffff', alpha: 0.85 },
      { x: 0.96, y: 0.2, radius: 560, color: '#c9b6f0', alpha: 0.4 },
      { x: 0.5, y: 0.5, radius: 720, color: '#ffffff', alpha: 0.32 },
      { x: 0.04, y: 0.92, radius: 720, color: '#a8d0ff', alpha: 0.42 },
      { x: 0.98, y: 1.0, radius: 860, color: '#f6c2df', alpha: 0.62 },
    ],
    grain: 0.035,
    text: '#24305a',
    textMuted: '#4f5a7e',
    accent: '#4356a1',
    textShadow: 'rgba(255,255,255,0.55)',
    wordmarkAt: '#7a668e',
    headline: ['#3d5bc4', '#7a5fc0', '#c25f9f'],
    glass: 'rgba(255,255,255,0.6)',
    glassStroke: 'rgba(255,255,255,0.95)',
    polaroid: '#ffffff',
    polaroidInk: '#28354d',
    polaroidMuted: '#6c628d',
    polaroidMat: '#e7e9f6',
    cardShadow: 'rgba(67,86,161,0.22)',
    star: '#ffffff',
    starGlow: 'rgba(140,120,230,0.55)',
    bubbleTint: '#e7a6dc',
    houseInk: 0.62,
    rank: { 1: '#c98a1e', 2: '#7d87a8', 3: '#a96443' },
    medal: MEDALS,
    medalText: '#28354d',
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
      `italic 400 40px ${STORY_FONTS.sans}`,
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

/** `#rrggbb` → `rgba(r,g,b,a)`; passes through anything else unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Small deterministic PRNG so the grain and every redraw are identical. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * The atmospheric field from #761 and VSA's posts: a diagonal blue→violet (or
 * sky→lavender) wash, soft color blooms, and a fine film grain.
 */
export function drawStoryBackdrop(ctx: CanvasRenderingContext2D, palette: StoryPalette) {
  const { width, height } = ctx.canvas;
  const base = ctx.createLinearGradient(0, 0, width * 0.55, height);
  base.addColorStop(0, palette.field[0]);
  base.addColorStop(0.5, palette.field[1]);
  base.addColorStop(1, palette.field[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  palette.blooms.forEach(({ x, y, radius, color, alpha }) => {
    const cx = x * width;
    const cy = y * height;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, withAlpha(color, alpha));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  });

  if (palette.grain > 0 && typeof ctx.getImageData === 'function') {
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const random = seededRandom(1977);
    const amount = palette.grain * 255;
    for (let i = 0; i < data.length; i += 4) {
      const n = (random() - 0.5) * amount;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
  }
}

/** The long-armed four-point star from VSA's graphics (same path as ui/Sparkle). */
export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, glow?: string) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 26 / s;
  }
  ctx.beginPath();
  ctx.moveTo(50, 0);
  ctx.bezierCurveTo(52, 34, 66, 48, 100, 50);
  ctx.bezierCurveTo(66, 52, 52, 66, 50, 100);
  ctx.bezierCurveTo(48, 66, 34, 52, 0, 50);
  ctx.bezierCurveTo(34, 48, 48, 34, 50, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** An iridescent soap bubble, as on the #761 hero. Decorative only. */
export function drawBubble(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, tint: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const body = ctx.createRadialGradient(cx + r * 0.3, cy + r * 0.4, r * 0.1, cx, cy, r);
  body.addColorStop(0, withAlpha(tint, 0.22));
  body.addColorStop(0.7, 'rgba(169,229,255,0.08)');
  body.addColorStop(1, 'rgba(255,255,255,0.16)');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.02);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  // Specular arc and glint.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, Math.PI * 1.08, Math.PI * 1.42);
  ctx.lineWidth = Math.max(3, r * 0.035);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  const glint = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.46, 0, cx - r * 0.38, cy - r * 0.46, r * 0.16);
  glint.addColorStop(0, 'rgba(255,255,255,0.9)');
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** The 4px iridescent ribbon: #761's signature edge. */
export function drawRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, alpha = 1) {
  const g = ctx.createLinearGradient(x, 0, x + width, 0);
  STORY_RIBBON.forEach((color, i) => g.addColorStop(i / (STORY_RIBBON.length - 1), withAlpha(color, alpha)));
  ctx.save();
  roundRectPath(ctx, x, y, width, 4, 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Frosted card, the story equivalent of the site's glass tiles. */
export function drawGlassCard(ctx: CanvasRenderingContext2D, p: StoryPalette, x: number, y: number, w: number, h: number, r: number, stroke?: string) {
  ctx.save();
  ctx.shadowColor = p.cardShadow;
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = p.glass;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke ?? p.glassStroke;
  ctx.stroke();
  ctx.restore();
}

/** Draws `img` cover-fit into a rectangle, or the initials avatar when absent. */
export function drawRectAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const colors = getInitialsAvatarColors(name);
    ctx.fillStyle = colors.background;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colors.foreground;
    setFont(ctx, 600, Math.round(Math.min(w, h) * 0.34), STORY_FONTS.sans);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getAvatarInitials(name), x + w / 2, y + h / 2 + h * 0.02);
  }
  ctx.restore();
}

/**
 * Metallic rank medallion: gold, silver and bronze keep their meaning, set in
 * a white rim with a star glint. `label` defaults to the rank ("T2" for ties).
 */
export function drawMedallion(ctx: CanvasRenderingContext2D, p: StoryPalette, rank: MedalRank, cx: number, cy: number, r: number, label: string = String(rank)) {
  const [hi, body] = p.medal[rank];
  ctx.save();
  ctx.shadowColor = 'rgba(20,26,80,0.32)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r + Math.max(4, r * 0.12), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  const fill = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  fill.addColorStop(0, hi);
  fill.addColorStop(0.55, body);
  fill.addColorStop(1, shade(body, 0.86));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = p.medalText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.round(r * (label.length > 1 ? 0.88 : 1.14));
  setFont(ctx, 400, size, STORY_FONTS.display);
  ctx.fillText(label, cx, cy + r * 0.08);
  ctx.restore();
  drawStar(ctx, cx + r * 0.72, cy - r * 0.72, r * 0.62, '#ffffff', 'rgba(255,255,255,0.9)');
}

/**
 * A Polaroid print: white frame, square photo, caption band. Rotated about
 * its center by `tiltDeg`. `caption` draws inside the band, in the frame's ink.
 */
export function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  p: StoryPalette,
  { cx, top, photo, pad, band, tiltDeg, img, name, caption }: {
    cx: number;
    top: number;
    photo: number;
    pad: number;
    band: number;
    tiltDeg: number;
    img: HTMLImageElement | null;
    name: string;
    caption?: (ctx: CanvasRenderingContext2D, area: { x: number; y: number; w: number; h: number }) => void;
  },
) {
  const w = photo + pad * 2;
  const h = pad + photo + band;
  const cy = top + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tiltDeg * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  ctx.save();
  ctx.shadowColor = p.cardShadow;
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = p.polaroid;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.fillStyle = p.polaroidMat;
  ctx.fillRect(pad, pad, photo, photo);
  drawRectAvatar(ctx, img, name, pad, pad, photo, photo);
  // A hairline inside the frame, like print paper.
  ctx.strokeStyle = 'rgba(40,53,77,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, photo, photo);

  caption?.(ctx, { x: pad, y: pad + photo, w: photo, h: band });
  ctx.restore();
}

/** Washi tape across a print's top edge, unrotated helper for decoration. */
export function drawTape(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, angleDeg: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Two-tone wordmark: "VSA at UCSD" with an italic lavender "at", as in the site nav. */
export function drawWordmark(ctx: CanvasRenderingContext2D, p: StoryPalette, x: number, cy: number, size: number) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = p.text;
  setFont(ctx, 400, size, STORY_FONTS.display);
  ctx.fillText('VSA ', x, cy);
  let cursor = x + ctx.measureText('VSA ').width;
  ctx.fillStyle = p.wordmarkAt;
  setFont(ctx, 'italic 400', size, STORY_FONTS.display);
  ctx.fillText('at', cursor, cy);
  cursor += ctx.measureText('at ').width;
  ctx.fillStyle = p.text;
  setFont(ctx, 400, size, STORY_FONTS.display);
  ctx.fillText('UCSD', cursor, cy);
  ctx.restore();
}

/** Glass pill with a centered mono label; returns the drawn width. */
export function drawGlassPill(
  ctx: CanvasRenderingContext2D,
  p: StoryPalette,
  label: string,
  centerX: number,
  y: number,
  { sizePx = 22, padX = 22, height = 48, dot }: { sizePx?: number; padX?: number; height?: number; dot?: string },
): number {
  setFont(ctx, 600, sizePx, STORY_FONTS.mono);
  const dotSpace = dot ? sizePx * 0.9 : 0;
  const width = ctx.measureText(label).width + padX * 2 + dotSpace;
  const x = centerX - width / 2;
  roundRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = p.glass;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.glassStroke;
  ctx.stroke();
  if (dot) {
    ctx.beginPath();
    ctx.arc(x + padX + sizePx * 0.3, y + height / 2, sizePx * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }
  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setFont(ctx, 600, sizePx, STORY_FONTS.mono);
  ctx.fillText(label, x + padX + dotSpace, y + height / 2 + 1);
  return width;
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
