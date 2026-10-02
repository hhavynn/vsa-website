// Renders the Find My Points "snapshot" as a shareable PNG and hands it to the
// OS share sheet (or downloads it where files can't be shared). The card is
// drawn on a canvas rather than rasterised from the DOM so the output doesn't
// depend on theme variables, animated counters, or cross-origin stylesheets.

export const SNAPSHOT_WIDTH = 1080;
export const SNAPSHOT_HEIGHT = 1350;

const FONTS = {
  serif: '"DM Serif Display", Georgia, serif',
  sans: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
} as const;

// Always the light palette (index.css light tokens) so a shared image looks the
// same no matter which theme the sender uses.
const INK = '#142028';
const INK_MUTED = '#4a6b68';
const PAPER = ['#fdf7f0', '#f5f1ea', '#efe5d6'] as const;
const BRAND = '#1e8878';

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  teal: { bg: '#d6efec', fg: '#17635a' },
  coral: { bg: '#fbdccf', fg: '#a8401c' },
  gold: { bg: '#f8e6c0', fg: '#8a4d06' },
  purple: { bg: '#e6dcf3', fg: '#5b3a8c' },
};

export interface SnapshotBadge {
  label: string;
  color: keyof typeof BADGE_COLORS;
}

export interface SnapshotData {
  name: string;
  subline: string;
  /** Label for the points figure, e.g. "2025–26 points". */
  periodLabel: string;
  rankLabel: string;
  /** Preformatted rank, e.g. "#12" or "T6" for a shared rank. */
  rank: string;
  points: number;
  checkIns: number;
  allTimePoints: number;
  houseLabel: string | null;
  houseColor: string | null;
  top10Gap: string | null;
  badges: SnapshotBadge[];
  avatarUrl?: string | null;
}

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, weight: string | number, size: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Shrinks text until it fits `maxWidth`, then truncates with an ellipsis as a last resort. */
function fitText(ctx: Ctx, text: string, maxWidth: number, start: number, min: number, weight: string | number, family: string) {
  let size = start;
  font(ctx, weight, size, family);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    font(ctx, weight, size, family);
  }
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out === text ? text : `${out.trimEnd()}…`;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function hueOf(name: string) {
  return (name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137) % 360;
}

/** Resolves once the site webfonts are usable by canvas; never rejects. */
async function ensureFonts() {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts?.load) return;
  const loads = [
    `400 120px ${FONTS.serif}`,
    `500 40px ${FONTS.sans}`,
    `700 40px ${FONTS.sans}`,
    `700 40px ${FONTS.mono}`,
  ].map((f) => fonts.load(f).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 2500))]);
}

/**
 * Loads an avatar with CORS so the canvas stays exportable. Any failure
 * (missing CORS headers, 404, timeout) resolves to null and the caller draws
 * initials instead, so a flaky image never blocks sharing.
 */
function loadAvatar(url: string | null | undefined, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  if (!url || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function drawAvatar(ctx: Ctx, image: HTMLImageElement | null, name: string, cx: number, cy: number, r: number, ring: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    const hue = hueOf(name);
    ctx.fillStyle = `hsl(${hue},45%,88%)`;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = `hsl(${hue},55%,38%)`;
    font(ctx, 600, Math.round(r * 0.78), FONTS.sans);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(name), cx, cy + 4);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = ring;
  ctx.stroke();
}

function drawStat(ctx: Ctx, x: number, y: number, w: number, label: string, value: string, accent: string) {
  roundRect(ctx, x, y, w, 150, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = `${accent}55`;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK_MUTED;
  font(ctx, 700, 22, FONTS.mono);
  ctx.fillText(label.toUpperCase(), x + w / 2, y + 48);
  ctx.fillStyle = INK;
  const text = fitText(ctx, value, w - 36, 64, 36, 700, FONTS.mono);
  ctx.fillText(text, x + w / 2, y + 118);
}

/** Draws the snapshot card. Exposed separately so tests can run it against a stub context. */
export function drawSnapshot(ctx: Ctx, data: SnapshotData, avatar: HTMLImageElement | null) {
  const W = SNAPSHOT_WIDTH;
  const H = SNAPSHOT_HEIGHT;
  const accent = data.houseColor ?? BRAND;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PAPER[0]);
  bg.addColorStop(0.55, PAPER[1]);
  bg.addColorStop(1, PAPER[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // House-coloured frame
  roundRect(ctx, 28, 28, W - 56, H - 56, 56);
  ctx.lineWidth = 14;
  ctx.strokeStyle = accent;
  ctx.stroke();

  const left = 96;
  const right = W - 96;

  // Header
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_MUTED;
  font(ctx, 700, 26, FONTS.mono);
  ctx.fillText('VSA AT UCSD  ·  MY SNAPSHOT', left, 120);

  // Identity
  drawAvatar(ctx, avatar, data.name, left + 92, 262, 92, accent);
  const textLeft = left + 92 * 2 + 36;
  const textMax = right - textLeft;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  const name = fitText(ctx, data.name || 'VSA Member', textMax, 68, 38, 400, FONTS.serif);
  ctx.fillText(name, textLeft, 258);
  if (data.subline) {
    ctx.fillStyle = INK_MUTED;
    const sub = fitText(ctx, data.subline, textMax, 30, 22, 500, FONTS.sans);
    ctx.fillText(sub, textLeft, 306);
  }

  // House pill
  let y = 400;
  if (data.houseLabel && data.houseColor) {
    font(ctx, 700, 28, FONTS.mono);
    const label = data.houseLabel.toUpperCase();
    const pillW = ctx.measureText(label).width + 64;
    roundRect(ctx, left, y - 40, pillW, 64, 32);
    ctx.fillStyle = `${data.houseColor}22`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${data.houseColor}88`;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(label, left + 32, y + 4);
  }

  // Hero number
  y = 640;
  ctx.textAlign = 'left';
  const pointsText = data.points.toLocaleString('en-US');
  ctx.fillStyle = INK;
  const hero = fitText(ctx, pointsText, W - left * 2, 260, 120, 400, FONTS.serif);
  ctx.fillText(hero, left, y);
  ctx.fillStyle = INK_MUTED;
  font(ctx, 700, 30, FONTS.mono);
  ctx.fillText(`${data.periodLabel.toUpperCase()}`, left, y + 64);

  // Stats row
  const gap = 24;
  const statW = (W - left * 2 - gap * 2) / 3;
  const statY = 760;
  drawStat(ctx, left, statY, statW, data.rankLabel, data.rank, accent);
  drawStat(ctx, left + statW + gap, statY, statW, 'Check-ins', data.checkIns.toLocaleString('en-US'), accent);
  drawStat(ctx, left + (statW + gap) * 2, statY, statW, 'All-time pts', data.allTimePoints.toLocaleString('en-US'), accent);

  // Top-10 insight
  y = 970;
  if (data.top10Gap) {
    roundRect(ctx, left, y - 44, W - left * 2, 76, 22);
    ctx.fillStyle = `${accent}14`;
    ctx.fill();
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${accent}66`;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    const gapText = fitText(ctx, data.top10Gap.toUpperCase(), W - left * 2 - 64, 28, 20, 700, FONTS.mono);
    ctx.fillText(gapText, left + 32, y + 6);
  }

  // Badges (wrap, never overflow)
  let bx = left;
  let by = 1090;
  font(ctx, 700, 26, FONTS.mono);
  for (const badge of data.badges.slice(0, 6)) {
    const label = badge.label.toUpperCase();
    const w = ctx.measureText(label).width + 52;
    if (bx + w > right) {
      bx = left;
      by += 76;
    }
    if (by > 1190) break;
    const colors = BADGE_COLORS[badge.color] ?? BADGE_COLORS.gold;
    roundRect(ctx, bx, by - 38, w, 56, 14);
    ctx.fillStyle = colors.bg;
    ctx.fill();
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + 26, by);
    bx += w + 16;
  }

  // Footer
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_MUTED;
  font(ctx, 700, 26, FONTS.mono);
  ctx.fillText('Find yours at vsaatucsd.com/points', left, H - 96);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the image.'))), 'image/png');
  });
}

/** Renders the snapshot to a PNG. Rejects with a readable message if the browser can't draw it. */
export async function renderSnapshotImage(data: SnapshotData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_WIDTH;
  canvas.height = SNAPSHOT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the snapshot image.');
  const [avatar] = await Promise.all([loadAvatar(data.avatarUrl), ensureFonts()]);
  drawSnapshot(ctx, data, avatar);
  return canvasToBlob(canvas);
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface ShareSnapshotInput {
  blob: Blob;
  text: string;
  title: string;
  fileName?: string;
}

function isUserCancel(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the browser has had time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Shares the image through the native share sheet when the browser can share
 * files; otherwise saves it. A share the browser refuses (for example because
 * the tap's user activation expired during rendering) also falls back to saving
 * so the user always ends up with the image.
 */
export async function shareSnapshotImage({
  blob,
  text,
  title,
  fileName = 'my-vsa-snapshot.png',
}: ShareSnapshotInput): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (error) {
      if (isUserCancel(error)) return 'cancelled';
      // fall through to download
    }
  }
  download(blob, fileName);
  return 'downloaded';
}
