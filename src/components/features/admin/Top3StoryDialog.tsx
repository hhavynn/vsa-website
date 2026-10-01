import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTop3StoryData } from '../../../hooks/useTop3StoryData';
import { drawTop3Story, type Top3StoryAssets } from '../../../lib/story/drawTop3Story';
import { ensureStoryFonts, loadStoryImage, type StoryTheme } from '../../../lib/story/storyCanvas';
import {
  TOP3_STORY_PRESETS,
  formatStoryFileName,
  formatStoryYearLabel,
  type Top3StoryPreset,
} from '../../../lib/story/top3Story';
import { cn } from '../../../lib/utils';
import { StoryStudio } from '../story/StoryStudio';

const INSTAGRAM_HANDLE = '@vsaatucsd';
const LOGO_URL = `${process.env.PUBLIC_URL || ''}/images/vsa-logo.png`;
const THEMES: { id: StoryTheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

export function Top3StoryDialog({ onClose }: { onClose: () => void }) {
  const { academicYearStart, entries, loading, error } = useTop3StoryData();
  const [presetId, setPresetId] = useState<Top3StoryPreset['id']>('current');
  const [theme, setTheme] = useState<StoryTheme>('dark');
  const [assets, setAssets] = useState<Top3StoryAssets | null>(null);
  const preset = TOP3_STORY_PRESETS.find((p) => p.id === presetId) ?? TOP3_STORY_PRESETS[0];

  const avatarKey = entries.map((entry) => `${entry.memberId}:${entry.avatarUrl ?? ''}`).join('|');

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setAssets(null);
    (async () => {
      const [logo, ...avatarImages] = await Promise.all([
        loadStoryImage(LOGO_URL),
        ...entries.map((entry) => loadStoryImage(entry.avatarUrl)),
        ensureStoryFonts().then(() => null),
      ]);
      if (cancelled) return;
      setAssets({
        logo,
        avatars: new Map(entries.map((entry, i) => [entry.memberId, avatarImages[i] ?? null])),
      });
    })();
    return () => { cancelled = true; };
    // avatarKey captures every input the image loads depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, avatarKey]);

  const asOfLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!assets || academicYearStart === null) return;
      drawTop3Story(
        ctx,
        { entries, preset, theme, yearLabel: formatStoryYearLabel(academicYearStart), asOfLabel, handle: INSTAGRAM_HANDLE },
        assets,
      );
    },
    [assets, academicYearStart, entries, preset, theme, asOfLabel],
  );

  const status = error
    ? 'Could not load the leaderboard. Close and try again.'
    : loading || !assets
      ? 'Building your story…'
      : academicYearStart === null || entries.length === 0
        ? 'No leaderboard points recorded for this year yet.'
        : null;

  const yearLabel = academicYearStart !== null ? formatStoryYearLabel(academicYearStart) : null;

  return (
    <StoryStudio
      title="Top 3 Story"
      description={
        yearLabel
          ? `Current public leaderboard (${yearLabel}) — same names, points, photos, and Houses members see.`
          : 'Current public leaderboard.'
      }
      draw={status ? null : draw}
      status={status}
      fileName={academicYearStart !== null ? formatStoryFileName(academicYearStart, preset.id, theme) : 'vsa-top3-story.png'}
      tone={theme}
      onClose={onClose}
    >
      <fieldset>
        <legend className="mb-2 font-sans text-2xs font-semibold uppercase tracking-label text-[var(--color-text2)]">
          Look
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((option) => {
            const selected = option.id === theme;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 rounded border px-3 py-2 font-sans text-sm font-semibold transition-colors',
                  'focus-within:ring-2 focus-within:ring-brand-600 dark:focus-within:ring-brand-400',
                  selected
                    ? 'border-brand-600 bg-brand-600/5 text-[var(--color-text)] dark:border-brand-400 dark:bg-brand-400/10'
                    : 'border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
                )}
              >
                <input
                  type="radio"
                  name="top3-story-theme"
                  value={option.id}
                  checked={selected}
                  onChange={() => setTheme(option.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    'h-3.5 w-3.5 rounded-full border border-[var(--color-border-strong)]',
                    option.id === 'dark' ? 'bg-[#0d1a20]' : 'bg-[#f5f1ea]',
                  )}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-sans text-2xs font-semibold uppercase tracking-label text-[var(--color-text2)]">
          Headline
        </legend>
        <div className="flex flex-col gap-2">
          {TOP3_STORY_PRESETS.map((option) => {
            const selected = option.id === presetId;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 transition-colors',
                  'focus-within:ring-2 focus-within:ring-brand-600 dark:focus-within:ring-brand-400',
                  selected
                    ? 'border-brand-600 bg-brand-600/5 dark:border-brand-400 dark:bg-brand-400/10'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]',
                )}
              >
                <input
                  type="radio"
                  name="top3-story-preset"
                  value={option.id}
                  checked={selected}
                  onChange={() => setPresetId(option.id)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                <span className="font-sans text-sm font-semibold text-[var(--color-text)]">
                  {option.headline.join(' ')}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {entries.length > 0 && (
        <div>
          <p className="mb-2 font-sans text-2xs font-semibold uppercase tracking-label text-[var(--color-text2)]">
            On this story
          </p>
          <ol className="divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)]">
            {entries.map((entry) => (
              <li key={entry.memberId} className="flex items-center justify-between gap-3 px-3 py-2 font-sans text-sm">
                <span className="min-w-0 truncate text-[var(--color-text)]">
                  <span className="mr-2 font-mono text-xs text-[var(--color-text2)]">#{entry.rank}</span>
                  {entry.name}
                </span>
                <span className="shrink-0 font-semibold text-[var(--color-text)]">{entry.pointsLabel} pts</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 font-sans text-2xs text-[var(--color-text2)]">
            Members without an approved photo show their initials, as on the leaderboard.
          </p>
        </div>
      )}
    </StoryStudio>
  );
}
