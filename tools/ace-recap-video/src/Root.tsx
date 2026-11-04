import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import React, { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender, useCurrentFrame } from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import { RecapStage } from '../../../src/components/features/ace/recap/RecapStage';
import { STAGE_H, STAGE_W } from '../../../src/components/features/ace/recap/stageModel';
import { planRecapTimeline } from '../../../src/lib/aceRecap/recapTimeline';
import type { AceRecapPresentation } from '../../../src/lib/aceRecap/recapSnapshot';

export interface AceRecapProps {
  /** Presentation-only data (recap-presentation.json). Never the full review snapshot. */
  presentation: AceRecapPresentation | null;
  /** Banner text. Cannot remove the banner from a private-preview presentation. */
  watermark?: string | null;
  [key: string]: unknown;
}

const FPS = 30;

/** Blocks the first frame until the self-hosted fonts are ready. */
function useFontsReady() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(handle));
  }, [handle]);
}

function AceRecap({ presentation, watermark }: AceRecapProps) {
  useFontsReady();
  const frame = useCurrentFrame();
  const timeline = React.useMemo(() => (presentation ? planRecapTimeline(presentation, { fps: FPS }) : null), [presentation]);
  if (!presentation || !timeline) return null;
  return <RecapStage presentation={presentation} timeline={timeline} frame={frame} watermark={watermark} />;
}

const calculateMetadata: CalculateMetadataFunction<AceRecapProps> = ({ props }) => {
  if ('snapshot' in props) {
    throw new Error('Pass recap-video-props.json ({"presentation": …}); the full review snapshot is never sent to the renderer.');
  }
  if (!props.presentation || props.presentation.version !== 1) {
    throw new Error('Pass --props=<file> containing {"presentation": <recap-presentation.json contents>}');
  }
  return { durationInFrames: planRecapTimeline(props.presentation, { fps: FPS }).durationInFrames };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AceRecap"
    component={AceRecap}
    width={STAGE_W}
    height={STAGE_H}
    fps={FPS}
    durationInFrames={FPS * 60}
    defaultProps={{ presentation: null } as AceRecapProps}
    calculateMetadata={calculateMetadata}
  />
);
