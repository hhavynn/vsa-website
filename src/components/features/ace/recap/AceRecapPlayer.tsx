import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { AceRecapSnapshot } from '../../../../lib/aceRecap/recapSnapshot';
import { planRecapTimeline } from '../../../../lib/aceRecap/recapTimeline';
import { RecapStage } from './RecapStage';
import { STAGE_H, STAGE_W } from './stageModel';

interface AceRecapPlayerProps {
  snapshot: AceRecapSnapshot;
  /** Start playing on mount (ignored when the visitor prefers reduced motion). */
  autoPlay?: boolean;
  className?: string;
  watermark?: string | null;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * In-browser player for the same RecapStage the MP4 is rendered from.
 * A clock advances the frame; the stage itself is stateless. With reduced
 * motion it never autoplays and opens on the closing overview.
 */
export function AceRecapPlayer({ snapshot, autoPlay = false, className, watermark }: AceRecapPlayerProps) {
  const reduceMotion = !!useReducedMotion();
  const timeline = useMemo(() => planRecapTimeline(snapshot, { fps: 30 }), [snapshot]);
  const last = timeline.durationInFrames - 1;
  const finaleFrame = useMemo(() => {
    const finale = timeline.scenes.find((s) => s.kind === 'finale');
    return finale ? finale.from + Math.min(finale.durationInFrames - 40, 230) : last;
  }, [timeline, last]);
  const [frame, setFrame] = useState(() => (reduceMotion ? finaleFrame : 0));
  const [playing, setPlaying] = useState(autoPlay && !reduceMotion);
  const [scale, setScale] = useState(0.5);
  const box = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ t: number; frame: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / STAGE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) { startRef.current = null; return; }
    let raf = 0;
    const tick = (t: number) => {
      if (!startRef.current) startRef.current = { t, frame };
      const next = startRef.current.frame + Math.floor(((t - startRef.current.t) / 1000) * timeline.fps);
      if (next >= last) { setFrame(last); setPlaying(false); return; }
      setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the clock only on play/pause
  }, [playing, timeline.fps, last]);

  const toggle = useCallback(() => {
    if (!playing && frame >= last) setFrame(0);
    setPlaying((p) => !p);
  }, [playing, frame, last]);

  return (
    <figure className={className} aria-label={`${snapshot.cycle.label} ACE recap`}>
      <div ref={box} className="relative w-full overflow-hidden rounded-2xl bg-[#0b1030] shadow-lg"
        style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
        <div aria-hidden style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <RecapStage snapshot={snapshot} timeline={timeline} frame={frame} watermark={watermark} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggle}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          {playing ? 'Pause' : frame >= last ? 'Replay' : 'Play'}
        </button>
        <button type="button" onClick={() => { setFrame(0); setPlaying(!reduceMotion); }}
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-text-primary hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          Restart
        </button>
        <label className="flex min-w-[200px] flex-1 items-center gap-3 text-sm text-text-secondary">
          <span className="sr-only">Seek</span>
          <input type="range" min={0} max={last} value={frame} className="w-full accent-brand-600"
            onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }} />
          <span className="tabular-nums">{fmtTime(frame / timeline.fps)} / {fmtTime(last / timeline.fps)}</span>
        </label>
      </div>
      {reduceMotion && (
        <p className="mt-2 text-sm text-text-muted">Reduced motion is on, so the recap won’t autoplay. Press Play to watch it.</p>
      )}
    </figure>
  );
}
