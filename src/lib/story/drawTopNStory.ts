// Top 5/Top 10 layout. The legacy Top 3 renderer stays untouched.
import {
  STORY_WIDTH, STORY_HEIGHT, STORY_SAFE_TOP, STORY_SAFE_BOTTOM,
  STORY_FONTS, STORY_PALETTES, drawStoryBackdrop, drawCircleAvatar,
  drawPill, fitText, roundRectPath, setFont, withAlpha,
  type StoryTheme,
} from './storyCanvas';
import type { Top3StoryAssets } from './drawTop3Story';
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
  cohort?: 'members' | 'board';
}

export interface StoryRowBounds {
  top: number;
  height: number;
  bottom: number;
}

/** Fixed geometry in the 1080×1920 safe area, for both preview and PNG. */
export function topNRowBounds(limit: StoryLimit, count: number): StoryRowBounds[] {
  const top = limit === 10 ? 610 : limit === 5 ? 640 : 620;
  const height = limit === 10 ? 88 : limit === 5 ? 145 : 216;
  const gap = limit === 10 ? 9 : limit === 5 ? 16 : 26;
  return Array.from({ length: Math.min(Math.max(count, 0), limit) }, (_, i) => {
    const y = top + i * (height + gap);
    return { top: y, height, bottom: y + height };
  });
}

function row(
  ctx: CanvasRenderingContext2D,
  entry: TopNStoryEntry,
  assets: Top3StoryAssets,
  bounds: StoryRowBounds,
  limit: StoryLimit,
  theme: StoryTheme,
) {
  const p = STORY_PALETTES[theme];
  const compact = limit === 10;
  const left = 80;
  const width = STORY_WIDTH - 160;
  const rankColor = entry.rank === 1 ? p.rank[1] : entry.rank === 2 ? p.rank[2] : entry.rank === 3 ? p.rank[3] : p.accent;
  roundRectPath(ctx, left, bounds.top, width, bounds.height, 16);
  ctx.fillStyle = p.card;
  ctx.fill();
  ctx.strokeStyle = withAlpha(rankColor, 0.54);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rankColor;
  setFont(ctx, 700, compact ? 31 : 43, STORY_FONTS.mono);
  ctx.fillText(`${(entry.tiedCount ?? 1) > 1 ? 'T' : '#'}${entry.rank}`, 129, bounds.top + bounds.height / 2);

  const centerY = bounds.top + bounds.height / 2;
  const avatarX = 219;
  const radius = compact ? 28 : 48;
  drawCircleAvatar(ctx, assets.avatars.get(entry.memberId) ?? null, entry.name, avatarX, centerY, radius);

  const nameX = compact ? 274 : 295;
  const nameWidth = compact ? 475 : 480;
  const name = fitText(ctx, entry.name, nameWidth, {
    weight: 600, family: STORY_FONTS.sans,
    maxSize: compact ? 33 : 40, minSize: compact ? 23 : 26,
  });
  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 600, name.size, STORY_FONTS.sans);
  ctx.fillText(name.text, nameX, compact ? bounds.top + 38 : bounds.top + 65);

  if (entry.house) {
    // House affiliation is the published single-member badge; never a House score.
    const house = fitText(ctx, entry.house.name.toUpperCase(), 405, {
      weight: 600, family: STORY_FONTS.mono,
      maxSize: compact ? 18 : 23, minSize: compact ? 14 : 18,
    });
    ctx.fillStyle = p.textMuted;
    setFont(ctx, 600, house.size, STORY_FONTS.mono);
    ctx.fillText(house.text, nameX, compact ? bounds.top + 71 : bounds.top + 106);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.text;
  const points = fitText(ctx, entry.pointsLabel, 175, {
    weight: 700, family: STORY_FONTS.sans,
    maxSize: compact ? 37 : 48, minSize: compact ? 26 : 33,
  });
  setFont(ctx, 700, points.size, STORY_FONTS.sans);
  ctx.fillText(points.text, 973, compact ? bounds.top + 47 : bounds.top + 80);
  ctx.fillStyle = p.textMuted;
  setFont(ctx, 500, compact ? 17 : 20, STORY_FONTS.mono);
  ctx.fillText('POINTS', 973, compact ? bounds.top + 71 : bounds.top + 111);
}

export function drawTopNStory(ctx: CanvasRenderingContext2D, content: TopNStoryContent, assets: Top3StoryAssets) {
  const { limit, theme, entries } = content;
  // A tie inside Top 3 uses the ranked-list template so every member of
  // the shared rank is shown. The original podium remains for no-tie Top 3.
  const p = STORY_PALETTES[theme];
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  drawStoryBackdrop(ctx, p);

  // No header or footer text enters Instagram's 250px reserved bands.
  if (assets.logo) drawCircleAvatar(ctx, assets.logo, 'VSA', 115, STORY_SAFE_TOP + 64, 32);
  ctx.fillStyle = p.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setFont(ctx, 700, 30, STORY_FONTS.sans);
  ctx.fillText('VSA at UCSD', 163, STORY_SAFE_TOP + 64);
  drawPill(ctx, `${content.yearLabel} PUBLIC`, 869, STORY_SAFE_TOP + 36, {
    color: p.accent, fill: withAlpha(p.accent, 0.12), sizePx: 22, padX: 17, height: 46,
  });

  ctx.textAlign = 'center';
  const heading = content.preset.id === 'current'
    ? `CURRENT TOP ${limit}`
    : `${content.preset.headline.join(' ')} · TOP ${limit}`.toUpperCase();
  const headline = fitText(ctx, heading, 900, {
    weight: 700, family: STORY_FONTS.sans, maxSize: 74, minSize: 48,
  });
  ctx.fillStyle = p.text;
  setFont(ctx, 700, headline.size, STORY_FONTS.sans);
  ctx.fillText(headline.text, STORY_WIDTH / 2, 459);
  setFont(ctx, 600, 23, STORY_FONTS.mono);
  ctx.fillStyle = p.accent;
  ctx.fillText(content.cohort === 'board' ? 'VERIFIED BOARD LEADERBOARD' : 'PUBLIC MEMBER LEADERBOARD', STORY_WIDTH / 2, 533);

  topNRowBounds(limit, entries.length).forEach((bounds, i) => row(ctx, entries[i], assets, bounds, limit, theme));

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.accent;
  ctx.textAlign = 'left';
  setFont(ctx, 700, 32, STORY_FONTS.sans);
  ctx.fillText(content.handle, 80, STORY_HEIGHT - STORY_SAFE_BOTTOM - 17);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.textMuted;
  setFont(ctx, 600, 19, STORY_FONTS.mono);
  ctx.fillText(`POINTS AS OF ${content.asOfLabel.toUpperCase()}`, STORY_WIDTH - 80, STORY_HEIGHT - STORY_SAFE_BOTTOM - 20);
}
