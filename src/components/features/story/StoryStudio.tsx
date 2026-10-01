import { type ReactNode, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  type StoryDrawFn,
  canvasToPngBlob,
  downloadBlob,
} from '../../../lib/story/storyCanvas';

interface StoryStudioProps {
  title: string;
  description?: ReactNode;
  /** Paints the full 1080×1920 story; null while data/assets are loading. */
  draw: StoryDrawFn | null;
  fileName: string;
  /** Shown over the preview instead of the canvas (loading / empty states). */
  status?: ReactNode;
  /** Matches the preview frame to the story's backdrop while it loads. */
  tone?: 'dark' | 'light';
  /** Template-specific options (caption presets, etc.). */
  children?: ReactNode;
  onClose: () => void;
}

/**
 * Preview + export shell for canvas story templates. The on-screen preview is
 * the export canvas itself, scaled down, so what admins see is what downloads.
 */
export function StoryStudio({ title, description, draw, fileName, status, tone = 'dark', children, onClose }: StoryStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && draw) draw(ctx);
  }, [draw]);

  useEffect(() => {
    const probe = typeof File !== 'undefined' ? new File([''], 'probe.png', { type: 'image/png' }) : null;
    setCanShareFiles(Boolean(probe && navigator.canShare?.({ files: [probe] })));
  }, []);

  const exportPng = async (mode: 'download' | 'share') => {
    const canvas = canvasRef.current;
    if (!canvas || !draw) return;
    setExporting(true);
    try {
      const blob = await canvasToPngBlob(canvas);
      if (mode === 'share') {
        const file = new File([blob], fileName, { type: 'image/png' });
        await navigator.share({ files: [file], title });
      } else {
        downloadBlob(blob, fileName);
        toast.success('Story image downloaded');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('Could not export the story image. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={title}
      className="border border-[var(--color-border)] bg-[var(--color-surface)] sm:max-w-3xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl text-[var(--color-text)]">{title}</h2>
          {description && <p className="mt-1 font-sans text-xs text-[var(--color-text2)]">{description}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close story generator">
          Close
        </Button>
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[300px]">
          <div
            className={cn(
              'relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-[var(--color-border)]',
              tone === 'dark' ? 'bg-[#0d1a20] text-[#e4d8c8]' : 'bg-[#f5f1ea] text-[#142028]',
            )}
          >
            <canvas
              ref={canvasRef}
              width={STORY_WIDTH}
              height={STORY_HEIGHT}
              role="img"
              aria-label={`${title} preview`}
              className={cn('h-full w-full', (!draw || status) && 'invisible')}
            />
            {status && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-sans text-sm">
                {status}
              </div>
            )}
            {showSafeZones && !status && (
              <>
                <div aria-hidden className="absolute inset-x-0 top-0 h-[13.02%] border-b border-dashed border-coral-400 bg-coral-500/25" />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-[13.02%] border-t border-dashed border-coral-400 bg-coral-500/25" />
              </>
            )}
          </div>
          <label className="mt-3 flex items-center justify-center gap-2 font-sans text-xs text-[var(--color-text2)]">
            <input
              type="checkbox"
              checked={showSafeZones}
              onChange={(e) => setShowSafeZones(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            Show Instagram safe zones (preview only)
          </label>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {children}
          <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
            <Button onClick={() => exportPng('download')} disabled={!draw || Boolean(status)} loading={exporting} fullWidth>
              Download Story Image
            </Button>
            {canShareFiles && (
              <Button
                variant="outline"
                onClick={() => exportPng('share')}
                disabled={!draw || Boolean(status) || exporting}
                fullWidth
              >
                Share to Instagram…
              </Button>
            )}
            <p className="font-sans text-2xs text-[var(--color-text2)]">
              PNG, {STORY_WIDTH}×{STORY_HEIGHT} (9:16). Upload it as a Story from your phone.
            </p>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
