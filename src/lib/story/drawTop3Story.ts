// Canvas template: "Current Top 3" Instagram Story (1080×1920).
// Everything sits between STORY_SAFE_TOP and STORY_HEIGHT - STORY_SAFE_BOTTOM.
// Visual language: the #761 field, a taped champion Polaroid, metallic medals.

import {
  STORY_FONTS,
  STORY_PALETTES,
  STORY_HEIGHT,
  STORY_SAFE_BOTTOM,
  STORY_SAFE_TOP,
  STORY_WIDTH,
  drawBubble,
  drawCircleAvatar,
  drawGlassCard,
  drawGlassPill,
  drawMedallion,
  drawPolaroid,
  drawRibbon,
  drawStar,
  drawStoryBackdrop,
  drawTape,
  drawWordmark,
  fillTrackedText,
  fitText,
  fitTextLines,
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
  cohort?: 'members' | 'board';
}

export interface Top3StoryAssets {
  logo: HTMLImageElement | null;
  avatars: ReadonlyMap<string, HTMLImageElement | null>;
}

const CENTER_X = STORY_WIDTH / 2;
const CONTENT_BOTTOM = STORY_HEIGHT - STORY_SAFE_BOTTOM;
const MARGIN = 80;

/** Shared by the Top 3 and Top N templates: logo, wordmark, year pill, ribbon. */
export function drawStoryHeader(ctx: CanvasRenderingContext2D, p: StoryPalette, logo: HTMLImageElement | null, pillLabel: string) {
  const rowY = STORY_SAFE_TOP + 40;
  const logoR = 34;
  const logoX = MARGIN + logoR;

  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX, rowY, logoR + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
    drawCircleAvatar(ctx, logo, 'VSA', logoX, rowY, logoR);
  }
  drawWordmark(ctx, p, logo ? logoX + logoR + 22 : MARGIN, rowY + 2, 44);

  setFont(ctx, 600, 22, STORY_FONTS.mono);
  const pillWidth = ctx.measureText(pillLabel).width + 44;
  drawGlassPill(ctx, p, pillLabel, STORY_WIDTH - MARGIN - pillWidth / 2, rowY - 24, { sizePx: 22 });

  drawRibbon(ctx, MARGIN, rowY + 60, STORY_WIDTH - MARGIN * 2, 0.95);
}

/** Mono eyebrow flanked by two small stars, centered. */
export function drawEyebrow(ctx: CanvasRenderingContext2D, p: StoryPalette, text: string, baseline: number, size = 26) {
  ctx.save();
  ctx.fillStyle = p.accent;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 10;
  setFont(ctx, 600, size, STORY_FONTS.mono);
  const tracking = size * 0.32;
  const width = Array.from(text).reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + tracking * (text.length - 1);
  fillTrackedText(ctx, text, CENTER_X, baseline, tracking);
  ctx.restore();
  const gap = 34;
  drawStar(ctx, CENTER_X - width / 2 - gap, baseline - size * 0.36, 26, p.star, p.starGlow);
  drawStar(ctx, CENTER_X + width / 2 + gap, baseline - size * 0.36, 26, p.star, p.starGlow);
}

/** Serif italic headline with the iridescent fill and a soft halo. */
export function drawSerifHeadline(ctx: CanvasRenderingContext2D, p: StoryPalette, text: string, baseline: number, maxSize: number, minSize: number) {
  const fit = fitText(ctx, text, STORY_WIDTH - MARGIN * 2 - 40, {
    weight: 'italic 400', family: STORY_FONTS.display, maxSize, minSize,
  });
  setFont(ctx, 'italic 400', fit.size, STORY_FONTS.display);
  const width = ctx.measureText(fit.text).width;
  const fill = ctx.createLinearGradient(CENTER_X - width / 2, 0, CENTER_X + width / 2, 0);
  fill.addColorStop(0, p.headline[0]);
  fill.addColorStop(0.55, p.headline[1]);
  fill.addColorStop(1, p.headline[2]);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 30;
  ctx.fillStyle = fill;
  ctx.fillText(fit.text, CENTER_X, baseline);
  ctx.restore();
}

/** "1,240 pts": bold number, serif-italic unit, centered or left-aligned. */
function drawPoints(
  ctx: CanvasRenderingContext2D,
  p: StoryPalette,
  label: string,
  x: number,
  baseline: number,
  size: number,
  align: 'center' | 'left' = 'center',
) {
  const unit = ' pts';
  setFont(ctx, 700, size, STORY_FONTS.sans);
  const numberWidth = ctx.measureText(label).width;
  setFont(ctx, 'italic 400', Math.round(size * 0.62), STORY_FONTS.display);
  const unitWidth = ctx.measureText(unit).width;
  const startX = align === 'center' ? x - (numberWidth + unitWidth) / 2 : x;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 16;
  setFont(ctx, 700, size, STORY_FONTS.sans);
  ctx.fillStyle = p.text;
  ctx.fillText(label, startX, baseline);
  setFont(ctx, 'italic 400', Math.round(size * 0.62), STORY_FONTS.display);
  ctx.fillStyle = p.textMuted;
  ctx.fillText(unit, startX + numberWidth, baseline);
  ctx.restore();
}

/** House affiliation as color dot + mono name, left-aligned and width-fitted. */
function drawHouseLine(ctx: CanvasRenderingContext2D, p: StoryPalette, house: { name: string; color: string }, x: number, baseline: number, maxWidth: number, size: number) {
  const fit = fitText(ctx, house.name.toUpperCase(), maxWidth - size, {
    weight: 600, family: STORY_FONTS.mono, maxSize: size, minSize: Math.round(size * 0.75),
  });
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size * 0.32, baseline - fit.size * 0.36, size * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = house.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.fillStyle = p.houseInk === 1 ? p.textMuted : shade(house.color, p.houseInk);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 600, fit.size, STORY_FONTS.mono);
  ctx.fillText(fit.text, x + size, baseline);
  ctx.restore();
}

function drawOpenPhoto(ctx: CanvasRenderingContext2D, p: StoryPalette, x: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = p.polaroidMat;
  ctx.fillRect(x, y, size, size);
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = withAlpha(p.polaroidMuted, 0.6);
  ctx.strokeRect(x + size * 0.12, y + size * 0.12, size * 0.76, size * 0.76);
  ctx.restore();
  ctx.fillStyle = p.polaroidMuted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, 'italic 400', Math.round(size * 0.42), STORY_FONTS.display);
  ctx.fillText('?', x + size / 2, y + size / 2);
}

function drawChampion(ctx: CanvasRenderingContext2D, p: StoryPalette, entry: Top3StoryEntry | undefined, img: HTMLImageElement | null) {
  const photo = 364;
  const pad = 28;
  const band = 96;
  const top = 640;
  const tilt = -2.5;

  drawPolaroid(ctx, p, {
    cx: CENTER_X, top, photo, pad, band, tiltDeg: tilt, img, name: entry?.name ?? '',
    caption: (c, area) => {
      if (!entry) {
        drawOpenPhoto(c, p, area.x, area.y - photo, photo);
      }
      const fit = fitText(c, entry?.name ?? 'Up for grabs', area.w - 20, {
        weight: 'italic 400', family: STORY_FONTS.display, maxSize: 52, minSize: 32,
      });
      c.fillStyle = p.polaroidInk;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      setFont(c, 'italic 400', fit.size, STORY_FONTS.display);
      c.fillText(fit.text, area.x + area.w / 2, area.y + 60);
    },
  });

  // Washi tape and the champion's medal sit on top of the tilted print.
  drawTape(ctx, CENTER_X + 6, top + 4, 150, 38, -4, 'rgba(200,184,232,0.72)');
  drawMedallion(ctx, p, 1, CENTER_X - 196, top + 40, 58);
  drawStar(ctx, CENTER_X + 236, top + 18, 64, p.star, p.starGlow);
  drawStar(ctx, CENTER_X + 268, top + 96, 26, p.star, p.starGlow);

  if (!entry) return;
  drawPoints(ctx, p, entry.pointsLabel, CENTER_X, 1226, 88);
  if (entry.house) {
    setFont(ctx, 600, 22, STORY_FONTS.mono);
    drawGlassPill(ctx, p, entry.house.name.toUpperCase(), CENTER_X, 1252, { sizePx: 22, height: 46, dot: entry.house.color });
  }
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
  const top = 1330;
  const height = 280;
  drawGlassCard(ctx, p, x, top, width, height, 28, withAlpha(p.rank[rank], 0.75));

  const photo = 150;
  const pad = 12;
  const band = 36;
  const printCx = x + 34 + (photo + pad * 2) / 2;
  const printTop = top + 40;
  drawPolaroid(ctx, p, {
    cx: printCx, top: printTop, photo, pad, band, tiltDeg: rank === 2 ? -3.5 : 3, img, name: entry?.name ?? '',
    caption: (c, area) => {
      if (!entry) drawOpenPhoto(c, p, area.x, area.y - photo, photo);
      c.fillStyle = p.polaroidMuted;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      setFont(c, 600, 16, STORY_FONTS.mono);
      fillTrackedText(c, `NO. ${rank}`, area.x + area.w / 2, area.y + 25, 3);
    },
  });
  drawMedallion(ctx, p, rank, printCx - 82, printTop + 6, 32);

  const textX = x + 34 + photo + pad * 2 + 26;
  const textWidth = x + width - 26 - textX;
  if (!entry) {
    ctx.fillStyle = p.textMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, 'italic 400', 40, STORY_FONTS.display);
    ctx.fillText('Up for grabs', textX, top + 150);
    return;
  }

  const name = fitTextLines(ctx, entry.name, textWidth, {
    weight: 400, family: STORY_FONTS.display, maxSize: 48, minSize: 30, wrapMaxSize: 40,
  });
  ctx.save();
  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 12;
  setFont(ctx, 400, name.size, STORY_FONTS.display);
  const lineHeight = Math.round(name.size * 1.04);
  const firstBaseline = top + 104 - (name.lines.length - 1) * lineHeight * 0.5;
  name.lines.forEach((line, i) => ctx.fillText(line, textX, firstBaseline + i * lineHeight));
  ctx.restore();

  drawPoints(ctx, p, entry.pointsLabel, textX, top + 192, 52, 'left');
  if (entry.house) drawHouseLine(ctx, p, entry.house, textX, top + 238, textWidth, 19);
}

export function drawStoryFooter(ctx: CanvasRenderingContext2D, p: StoryPalette, handle: string, asOfLabel: string) {
  const baseline = CONTENT_BOTTOM - 6;
  ctx.save();
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 12;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = p.text;
  setFont(ctx, 'italic 400', 44, STORY_FONTS.display);
  ctx.fillText(handle, MARGIN, baseline);

  ctx.textAlign = 'right';
  ctx.fillStyle = p.textMuted;
  setFont(ctx, 600, 19, STORY_FONTS.mono);
  ctx.fillText(`POINTS AS OF ${asOfLabel.toUpperCase()}`, STORY_WIDTH - MARGIN, baseline - 6);
  ctx.restore();
}

export function drawTop3Story(ctx: CanvasRenderingContext2D, content: Top3StoryContent, assets: Top3StoryAssets) {
  const [first, second, third] = [1, 2, 3].map((rank) => content.entries.find((entry) => entry.rank === rank));
  const avatarFor = (entry: Top3StoryEntry | undefined) => (entry ? assets.avatars.get(entry.memberId) ?? null : null);

  const p = STORY_PALETTES[content.theme];

  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  drawStoryBackdrop(ctx, p);
  // Decoration stays in the margins and Instagram's reserved bands.
  drawBubble(ctx, 1010, 560, 120, p.bubbleTint);
  drawBubble(ctx, 40, 1180, 86, p.bubbleTint);
  drawBubble(ctx, 130, 1860, 150, p.bubbleTint);
  drawStar(ctx, 118, 560, 34, p.star, p.starGlow);
  drawStar(ctx, 980, 1230, 30, p.star, p.starGlow);
  drawStar(ctx, 900, 1730, 54, p.star, p.starGlow);

  drawStoryHeader(ctx, p, assets.logo, `${content.yearLabel} ${content.cohort === 'board' ? 'BOARD' : 'LEADERBOARD'}`);
  drawEyebrow(ctx, p, content.preset.headline[0].toUpperCase(), 446);
  drawSerifHeadline(ctx, p, content.preset.headline[1], 600, 176, 110);
  drawChampion(ctx, p, first, avatarFor(first));

  const gutter = 28;
  const cardWidth = (STORY_WIDTH - MARGIN * 2 - gutter) / 2;
  drawRunnerUp(ctx, p, 2, second, avatarFor(second), MARGIN, cardWidth);
  drawRunnerUp(ctx, p, 3, third, avatarFor(third), MARGIN + cardWidth + gutter, cardWidth);

  drawStoryFooter(ctx, p, content.handle, content.asOfLabel);
}
