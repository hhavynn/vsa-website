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
import type { AceRecapSnapshot } from '../../../src/lib/aceRecap/recapSnapshot';

export interface AceRecapProps {
  snapshot: AceRecapSnapshot | null;
  /** Override the private-preview banner (null hides it; only for an approved, published snapshot). */
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

function AceRecap({ snapshot, watermark }: AceRecapProps) {
  useFontsReady();
  const frame = useCurrentFrame();
  if (!snapshot) return null;
  const timeline = planRecapTimeline(snapshot, { fps: FPS });
  return <RecapStage snapshot={snapshot} timeline={timeline} frame={frame} watermark={watermark} />;
}

const calculateMetadata: CalculateMetadataFunction<AceRecapProps> = ({ props }) => {
  if (!props.snapshot || props.snapshot.version !== 1) {
    throw new Error('Pass --props=<file> containing {"snapshot": <recap-snapshot.json contents>}');
  }
  return { durationInFrames: planRecapTimeline(props.snapshot, { fps: FPS }).durationInFrames };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AceRecap"
    component={AceRecap}
    width={STAGE_W}
    height={STAGE_H}
    fps={FPS}
    durationInFrames={FPS * 60}
    defaultProps={{ snapshot: null } as AceRecapProps}
    calculateMetadata={calculateMetadata}
  />
);
