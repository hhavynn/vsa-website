// Canvas template: "Current Top 3" Instagram Story (1080×1920).
// Everything sits between STORY_SAFE_TOP and STORY_HEIGHT - STORY_SAFE_BOTTOM.

import {
  STORY_FONTS,
  STORY_PALETTES,
  STORY_HEIGHT,
  STORY_SAFE_BOTTOM,
  STORY_SAFE_TOP,
  STORY_WIDTH,
  drawCircleAvatar,
  drawPill,
  drawStoryBackdrop,
  fillTrackedText,
  fitText,
  fitTextLines,
  roundRectPath,
  setFont,
  shade,
  withAlpha,
  type StoryPalette,
  type StoryTheme,
} from './storyCanvas';
import type { Top3StoryEntry, Top3StoryPreset } from './top3Story';

export interface Top3StoryContent {
  entries: readonly Top3StoryEntry[];
  preset: Top3StoryPreset;
  yearLabel: string;
  asOfLabel: string;
  handle: string;
  theme: StoryTheme;
}

export interface Top3StoryAssets {
  logo: HTMLImageElement | null;
  avatars: ReadonlyMap<string, HTMLImageElement | null>;
}

const CENTER_X = STORY_WIDTH / 2;
const CONTENT_BOTTOM = STORY_HEIGHT - STORY_SAFE_BOTTOM;

function drawRankMedallion(ctx: CanvasRenderingContext2D, p: StoryPalette, rank: 1 | 2 | 3, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = p.medallionBorder;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = p.rank[rank];
  ctx.fill();
  ctx.fillStyle = p.medallionText;
  setFont(ctx, 700, Math.round(r * 1.1), STORY_FONTS.sans);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), cx, cy + r * 0.06);
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number, glow: number) {
  ctx.save();
  ctx.shadowColor = withAlpha(color, 0.55);
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, p: StoryPalette, cx: number, baseY: number, width: number) {
  const h = width * 0.62;
  const left = cx - width / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, baseY);
  ctx.lineTo(left + width * 0.04, baseY - h * 0.78);
  ctx.lineTo(left + width * 0.3, baseY - h * 0.42);
  ctx.lineTo(cx, baseY - h);
  ctx.lineTo(left + width * 0.7, baseY - h * 0.42);
  ctx.lineTo(left + width * 0.96, baseY - h * 0.78);
  ctx.lineTo(left + width, baseY);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  fill.addColorStop(0, p.crownGradient[0]);
  fill.addColorStop(1, p.crownGradient[1]);
  ctx.fillStyle = fill;
  ctx.shadowColor = withAlpha(p.rank[1], 0.6);
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.restore();
}

function drawPoints(ctx: CanvasRenderingContext2D, p: StoryPalette, label: string, cx: number, baseline: number, size: number, color: string) {
  const unit = ' pts';
  setFont(ctx, 700, size, STORY_FONTS.sans);
  const numberWidth = ctx.measureText(label).width;
  setFont(ctx, 500, Math.round(size * 0.42), STORY_FONTS.sans);
  const unitWidth = ctx.measureText(unit).width;
  const startX = cx - (numberWidth + unitWidth) / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 700, size, STORY_FONTS.sans);
  ctx.fillStyle = color;
  ctx.fillText(label, startX, baseline);
  setFont(ctx, 500, Math.round(size * 0.42), STORY_FONTS.sans);
  ctx.fillStyle = p.textMuted;
  ctx.fillText(unit, startX + numberWidth, baseline);
}

function drawHeader(ctx: CanvasRenderingContext2D, p: StoryPalette, content: Top3StoryContent, logo: HTMLImageElement | null) {
  const rowY = STORY_SAFE_TOP + 40;
  const logoR = 34;
  const logoX = 80 + logoR;

  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX, rowY, logoR + 3, 0, Math.PI * 2);
  ctx.fillStyle = p.logoRing;
  ctx.fill();
  ctx.restore();
  if (logo) {
    drawCircleAvatar(ctx, logo, 'VSA', logoX, rowY, logoR);
  }

  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setFont(ctx, 700, 30, STORY_FONTS.sans);
  ctx.fillText('VSA at UCSD', logoX + logoR + 22, rowY + 1);

  setFont(ctx, 600, 24, STORY_FONTS.mono);
  const pillLabel = `${content.yearLabel} LEADERBOARD`;
  const pillWidth = ctx.measureText(pillLabel).width + 44;
  drawPill(ctx, pillLabel, STORY_WIDTH - 80 - pillWidth / 2, rowY - 25, {
    color: p.accent,
    fill: withAlpha(p.accent, 0.12),
    sizePx: 24,
  });
}

function drawHeadline(ctx: CanvasRenderingContext2D, p: StoryPalette, preset: Top3StoryPreset) {
  const maxWidth = STORY_WIDTH - 160;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const line1 = fitText(ctx, preset.headline[0].toUpperCase(), maxWidth, {
    weight: 700, family: STORY_FONTS.sans, maxSize: 64, minSize: 40,
  });
  ctx.fillStyle = p.text;
  setFont(ctx, 700, line1.size, STORY_FONTS.sans);
  fillTrackedText(ctx, line1.text, CENTER_X, 450, 12);
  ctx.textAlign = 'center';

  const line2 = fitText(ctx, preset.headline[1], maxWidth, {
    weight: 'italic 400', family: STORY_FONTS.display, maxSize: 180, minSize: 110,
  });
  setFont(ctx, 'italic 400', line2.size, STORY_FONTS.display);
  const gradient = ctx.createLinearGradient(0, 468, 0, 610);
  gradient.addColorStop(0, p.headlineGradient[0]);
  gradient.addColorStop(1, p.headlineGradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillText(line2.text, CENTER_X, 608);
}

function drawChampion(ctx: CanvasRenderingContext2D, p: StoryPalette, entry: Top3StoryEntry | undefined, img: HTMLImageElement | null) {
  const cy = 900;
  const r = 120;
  const color = p.rank[1];

  const halo = ctx.createRadialGradient(CENTER_X, cy, r, CENTER_X, cy, r * 2.1);
  halo.addColorStop(0, withAlpha(color, 0.28));
  halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, cy - r * 2.2, STORY_WIDTH, r * 4.4);

  if (!entry) {
    drawOpenSpot(ctx, CENTER_X, cy, r, color);
    return;
  }

  drawCircleAvatar(ctx, img, entry.name, CENTER_X, cy, r);
  drawRing(ctx, CENTER_X, cy, r + 10, color, 10, 40);
  drawCrown(ctx, p, CENTER_X, cy - r - 22, 92);
  drawRankMedallion(ctx, p, 1, CENTER_X + r * 0.74, cy + r * 0.74, 40);

  const name = fitText(ctx, entry.name, STORY_WIDTH - 180, {
    weight: 400, family: STORY_FONTS.display, maxSize: 78, minSize: 48,
  });
  ctx.fillStyle = p.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 400, name.size, STORY_FONTS.display);
  ctx.fillText(name.text, CENTER_X, 1104);

  drawPoints(ctx, p, entry.pointsLabel, CENTER_X, 1186, 84, p.championPoints);

  if (entry.house) {
    drawPill(ctx, entry.house.name.toUpperCase(), CENTER_X, 1208, {
      color: shade(entry.house.color, p.houseInk),
      fill: withAlpha(entry.house.color, 0.14),
      sizePx: 22,
      height: 44,
    });
  }
}

function drawOpenSpot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha(color, 0.7);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = withAlpha(color, 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, 400, Math.round(r * 0.9), STORY_FONTS.display);
  ctx.fillText('?', cx, cy + r * 0.05);
}

function drawRunnerUp(
  ctx: CanvasRenderingContext2D,
  p: StoryPalette,
  rank: 2 | 3,
  entry: Top3StoryEntry | undefined,
  img: HTMLImageElement | null,
  x: number,
  width: number,
) {
  const top = 1316;
  const height = 276;
  const cx = x + width / 2;
  const color = p.rank[rank];

  roundRectPath(ctx, x, top, width, height, 18);
  ctx.fillStyle = p.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.stroke();

  const r = 70;
  const cy = top + 6;
  if (!entry) {
    drawOpenSpot(ctx, cx, cy, r, color);
    ctx.fillStyle = p.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, 400, 40, STORY_FONTS.display);
    ctx.fillText('Up for grabs', cx, top + 160);
    return;
  }

  drawCircleAvatar(ctx, img, entry.name, cx, cy, r);
  drawRing(ctx, cx, cy, r + 7, color, 7, 20);
  drawRankMedallion(ctx, p, rank, cx + r * 0.74, cy + r * 0.74, 28);

  const name = fitTextLines(ctx, entry.name, width - 48, {
    weight: 400, family: STORY_FONTS.display, maxSize: 46, minSize: 30, wrapMaxSize: 38,
  });
  ctx.fillStyle = p.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 400, name.size, STORY_FONTS.display);
  const lineHeight = Math.round(name.size * 1.08);
  const firstBaseline = top + 132 - (name.lines.length - 1) * lineHeight * 0.5;
  name.lines.forEach((line, i) => ctx.fillText(line, cx, firstBaseline + i * lineHeight));

  drawPoints(ctx, p, entry.pointsLabel, cx, top + 210, 56, p.text);

  if (entry.house) {
    drawPill(ctx, entry.house.name.toUpperCase(), cx, top + 226, {
      color: shade(entry.house.color, p.houseInk),
      fill: withAlpha(entry.house.color, 0.14),
      sizePx: 18,
      padX: 16,
      height: 38,
    });
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, p: StoryPalette, content: Top3StoryContent) {
  const baseline = CONTENT_BOTTOM - 4;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = p.accent;
  setFont(ctx, 700, 34, STORY_FONTS.sans);
  ctx.fillText(content.handle, 80, baseline);

  ctx.textAlign = 'right';
  ctx.fillStyle = p.textMuted;
  setFont(ctx, 600, 20, STORY_FONTS.mono);
  ctx.fillText(`POINTS AS OF ${content.asOfLabel.toUpperCase()}`, STORY_WIDTH - 80, baseline - 4);
}

export function drawTop3Story(ctx: CanvasRenderingContext2D, content: Top3StoryContent, assets: Top3StoryAssets) {
  const [first, second, third] = [1, 2, 3].map((rank) => content.entries.find((entry) => entry.rank === rank));
  const avatarFor = (entry: Top3StoryEntry | undefined) => (entry ? assets.avatars.get(entry.memberId) ?? null : null);

  const p = STORY_PALETTES[content.theme];

  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  drawStoryBackdrop(ctx, p);
  drawHeader(ctx, p, content, assets.logo);
  drawHeadline(ctx, p, content.preset);
  drawChampion(ctx, p, first, avatarFor(first));

  const gutter = 30;
  const cardWidth = (STORY_WIDTH - 160 - gutter) / 2;
  drawRunnerUp(ctx, p, 2, second, avatarFor(second), 80, cardWidth);
  drawRunnerUp(ctx, p, 3, third, avatarFor(third), 80 + cardWidth + gutter, cardWidth);

  drawFooter(ctx, p, content);
}
