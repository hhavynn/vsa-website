// Top 5/Top 10 layout, and Top 3 when a tie would hide someone on the podium.
// Same #761 language as drawTop3Story: field, ribbon header, glass rows.
import {
  STORY_WIDTH, STORY_HEIGHT,
  STORY_FONTS, STORY_PALETTES, STORY_RIBBON, drawStoryBackdrop, drawCircleAvatar,
  drawBubble, drawGlassCard, drawMedallion, drawStar, fitText, setFont, shade, withAlpha,
  type MedalRank, type StoryPalette, type StoryTheme,
} from './storyCanvas';
import { drawEyebrow, drawSerifHeadline, drawStoryFooter, drawStoryHeader, type Top3StoryAssets } from './drawTop3Story';
import type { TopNStoryEntry, StoryLimit } from './topNStory';
import type { Top3StoryPreset } from './top3Story';

export interface TopNStoryContent {
  entries: readonly TopNStoryEntry[];
  limit: StoryLimit;
  preset: Top3StoryPreset;
  yearLabel: string;
  asOfLabel: string;
  handle: string;
  theme: StoryTheme;
}

export interface StoryRowBounds {
  top: number;
  height: number;
  bottom: number;
}

/** Fixed geometry in the 1080×1920 safe area, for both preview and PNG. */
export function topNRowBounds(limit: StoryLimit, count: number): StoryRowBounds[] {
  const top = limit === 10 ? 610 : limit === 5 ? 640 : 620;
  const height = limit === 10 ? 88 : limit === 5 ? 160 : 250;
  const gap = limit === 10 ? 9 : limit === 5 ? 22 : 30;
  return Array.from({ length: Math.min(Math.max(count, 0), limit) }, (_, i) => {
    const y = top + i * (height + gap);
    return { top: y, height, bottom: y + height };
  });
}

const isMedal = (rank: number): rank is MedalRank => rank === 1 || rank === 2 || rank === 3;

/** Avatar with a thin iridescent ring, like the site's member chips. */
function ringedAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, cx: number, cy: number, r: number) {
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  STORY_RIBBON.forEach((color, i) => ring.addColorStop(i / (STORY_RIBBON.length - 1), color));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  drawCircleAvatar(ctx, img, name, cx, cy, r);
}

function row(
  ctx: CanvasRenderingContext2D,
  p: StoryPalette,
  entry: TopNStoryEntry,
  assets: Top3StoryAssets,
  bounds: StoryRowBounds,
  limit: StoryLimit,
) {
  const compact = limit === 10;
  const roomy = limit === 3;
  const left = 80;
  const width = STORY_WIDTH - 160;
  const centerY = bounds.top + bounds.height / 2;
  const medal = isMedal(entry.rank);
  const tied = (entry.tiedCount ?? 1) > 1;

  drawGlassCard(ctx, p, left, bounds.top, width, bounds.height, compact ? 20 : 26, medal ? withAlpha(p.rank[entry.rank as MedalRank], 0.8) : undefined);

  const rankX = 136;
  const rankLabel = `${tied ? 'T' : ''}${entry.rank}`;
  if (medal) {
    drawMedallion(ctx, p, entry.rank as MedalRank, rankX, centerY, compact ? 25 : roomy ? 40 : 34, rankLabel);
  } else {
    ctx.save();
    ctx.fillStyle = p.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = p.textShadow;
    ctx.shadowBlur = 10;
    setFont(ctx, 'italic 400', compact ? 44 : 56, STORY_FONTS.display);
    ctx.fillText(rankLabel, rankX, centerY + 2);
    ctx.restore();
  }

  const avatarX = compact ? 226 : 240;
  const radius = compact ? 29 : roomy ? 62 : 48;
  ringedAvatar(ctx, assets.avatars.get(entry.memberId) ?? null, entry.name, avatarX, centerY, radius);

  const nameX = avatarX + radius + (compact ? 24 : 30);
  const pointsRight = left + width - 34;
  const nameWidth = pointsRight - 190 - nameX;
  const name = fitText(ctx, entry.name, nameWidth, {
    weight: 400, family: STORY_FONTS.display,
    maxSize: compact ? 38 : roomy ? 54 : 46, minSize: compact ? 26 : 30,
  });
  ctx.save();
  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 10;
  setFont(ctx, 400, name.size, STORY_FONTS.display);
  const nameBaseline = entry.house ? centerY + (compact ? -2 : -6) : centerY + name.size * 0.32;
  ctx.fillText(name.text, nameX, nameBaseline);
  ctx.restore();

  if (entry.house) {
    // House affiliation is the published single-member badge; never a House score.
    const size = compact ? 16 : 19;
    const house = fitText(ctx, entry.house.name.toUpperCase(), nameWidth - size, {
      weight: 600, family: STORY_FONTS.mono, maxSize: size, minSize: compact ? 13 : 15,
    });
    const houseBaseline = centerY + (compact ? 28 : 34);
    ctx.save();
    ctx.beginPath();
    ctx.arc(nameX + size * 0.32, houseBaseline - house.size * 0.36, size * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = entry.house.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = p.houseInk === 1 ? p.textMuted : shade(entry.house.color, p.houseInk);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, 600, house.size, STORY_FONTS.mono);
    ctx.fillText(house.text, nameX + size, houseBaseline);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = p.textShadow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = p.text;
  const points = fitText(ctx, entry.pointsLabel, 175, {
    weight: 700, family: STORY_FONTS.sans,
    maxSize: compact ? 38 : roomy ? 56 : 48, minSize: compact ? 26 : 33,
  });
  setFont(ctx, 700, points.size, STORY_FONTS.sans);
  ctx.fillText(points.text, pointsRight, centerY + (compact ? 6 : 8));
  ctx.fillStyle = p.textMuted;
  setFont(ctx, 600, compact ? 15 : 18, STORY_FONTS.mono);
  ctx.fillText('POINTS', pointsRight, centerY + (compact ? 30 : 40));
  ctx.restore();
}

export function drawTopNStory(ctx: CanvasRenderingContext2D, content: TopNStoryContent, assets: Top3StoryAssets) {
  const { limit, theme, entries } = content;
  // A tie inside Top 3 uses the ranked-list template so every member of
  // the shared rank is shown. The podium remains for no-tie Top 3.
  const p = STORY_PALETTES[theme];
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  drawStoryBackdrop(ctx, p);
  // Decoration stays in the margins and Instagram's reserved bands.
  drawBubble(ctx, 1040, 470, 104, p.bubbleTint);
  drawBubble(ctx, 110, 1850, 140, p.bubbleTint);
  drawStar(ctx, 132, 520, 30, p.star, p.starGlow);
  drawStar(ctx, 46, 1040, 24, p.star, p.starGlow);
  drawStar(ctx, 1036, 1360, 26, p.star, p.starGlow);
  drawStar(ctx, 930, 1760, 50, p.star, p.starGlow);

  // No header or footer text enters Instagram's 250px reserved bands.
  drawStoryHeader(ctx, p, assets.logo, `${content.yearLabel} LEADERBOARD`);
  const current = content.preset.id === 'current';
  drawEyebrow(ctx, p, current ? 'PUBLIC MEMBER LEADERBOARD' : `PUBLIC LEADERBOARD · TOP ${limit}`, 432, 22);
  drawSerifHeadline(
    ctx, p,
    current ? `Top ${limit}` : content.preset.headline.join(' '),
    limit === 10 ? 560 : 578,
    limit === 10 ? 118 : 136, 86,
  );

  topNRowBounds(limit, entries.length).forEach((bounds, i) => row(ctx, p, entries[i], assets, bounds, limit));

  drawStoryFooter(ctx, p, content.handle, content.asOfLabel);
}
