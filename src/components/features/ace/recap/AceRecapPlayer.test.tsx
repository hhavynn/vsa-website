// Synthetic fixtures only. Never put real ACE names or member ids in this file.
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AceFamily } from '../../../../types';
import type { AceNodeRef } from '../../../../lib/aceAssignments';
import { buildRecapSnapshot, parseOfficialPairingRows, toRecapPresentation } from '../../../../lib/aceRecap';
import { AceRecapPlayer } from './AceRecapPlayer';
import { stageFamily } from './stageModel';
import { PRIVATE_WATERMARK, RecapStage, resolveWatermark } from './RecapStage';
import { planRecapTimeline } from '../../../../lib/aceRecap/recapTimeline';
import fixture from '../../../../../tools/ace-recap-video/fixtures/synthetic-props.json';
import type { AceRecapPresentation } from '../../../../lib/aceRecap/recapSnapshot';
import { finaleGrid } from './scenes/Finale';
import { Metrics } from './scenes/shared';

const family: AceFamily = {
  id: 'f-orchid', name: 'Orchid', slug: 'orchid', academic_year_start: null, academic_year_end: null,
  cover_image_url: null, theme_color: '#a773bf', description: null, display_order: 0, is_published: true,
  created_at: '', updated_at: '',
};
const nodes: AceNodeRef[] = [
  { id: 'o1', name: 'Rowan Vale', familyId: 'f-orchid', familyName: 'Orchid', memberId: null, parentId: null, roleLabel: null, isPublished: true },
  { id: 'o2', name: 'Juniper Ash', familyId: 'f-orchid', familyName: 'Orchid', memberId: null, parentId: 'o1', roleLabel: null, isPublished: true },
];
const snapshotWith = (little: string) => buildRecapSnapshot({
  cycle: { label: 'Fall 2099', academicYearStart: 2099 },
  source: { label: 'synthetic', revision: null, retrievedAt: '' },
  families: [family], nodes,
  pairings: parseOfficialPairingRows([['BIGS', 'LITTLES'], ['Juniper Ash', little]]).pairings,
});

describe('stage geometry cache', () => {
  it('never reuses geometry from a different snapshot with the same ids and counts', () => {
    const a = snapshotWith('Kit Lorne').families[0];
    const b = snapshotWith('Wren Oak').families[0];
    expect(a.id).toBe(b.id);
    expect(a.nodes.length).toBe(b.nodes.length);
    expect(stageFamily(a)).toBe(stageFamily(a));
    const labels = (f: typeof a) => Array.from(stageFamily(f).byId.values()).filter((n) => n.isNew).map((n) => n.label);
    expect(labels(a)).toEqual(['Kit Lorne']);
    expect(labels(b)).toEqual(['Wren Oak']);
  });
});

describe('recap stage guarantees', () => {
  it('cannot drop the private banner from an unpublished presentation', () => {
    expect(resolveWatermark({ visibility: 'private-preview' }, null)).toBe(PRIVATE_WATERMARK);
    expect(resolveWatermark({ visibility: 'private-preview' }, '  ')).toBe(PRIVATE_WATERMARK);
    expect(resolveWatermark({ visibility: 'private-preview' }, 'Chair review copy')).toBe('Chair review copy');
    expect(resolveWatermark({ visibility: 'published' }, null)).toBeNull();
  });

  it('gives every finale family its own non-overlapping cell, whatever the count', () => {
    for (const n of [1, 3, 8, 9, 13, 20]) {
      const cells = finaleGrid(n);
      expect(cells).toHaveLength(n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = cells[i]; const b = cells[j];
        const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
        expect(overlap).toBe(false);
      }
      cells.forEach((c) => { expect(c.x).toBeGreaterThanOrEqual(100); expect(c.x + c.w).toBeLessThanOrEqual(1820.5); });
    }
  });
});

describe('growth metrics', () => {
  it('never shows a family shrinking while its member count animates', () => {
    const fam = snapshotWith('Kit Lorne').families[0];
    const seen: number[] = [];
    for (let f = 0; f <= 40; f += 2) {
      const { container, unmount } = render(<Metrics f={f} start={0} fam={fam} />);
      const match = /(\d+)→(\d+)members/i.exec(container.textContent ?? '');
      const after = Number(match?.[2]);
      seen.push(after);
      unmount();
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(fam.before.people);
    expect(seen[seen.length - 1]).toBe(fam.after.people);
  });
});

describe('RecapStage on the fictional fixture', () => {
  it('renders every scene and transition without React errors', () => {
    const presentation = (fixture as unknown as { presentation: AceRecapPresentation }).presentation;
    const timeline = planRecapTimeline(presentation, { fps: 30 });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(<RecapStage presentation={presentation} timeline={timeline} frame={0} />);
    const frames = new Set<number>();
    for (let f = 0; f < timeline.durationInFrames; f += 23) frames.add(f);
    timeline.scenes.forEach((s) => { frames.add(s.from); frames.add(s.from + Math.max(0, s.overlapIn - 1)); frames.add(s.from + s.durationInFrames - 1); });
    for (const frame of Array.from(frames).sort((a, b) => a - b)) {
      rerender(<RecapStage presentation={presentation} timeline={timeline} frame={frame} />);
      expect(container.textContent).toMatch(/Private preview/i);
    }
    expect(errors.mock.calls.map((c) => String(c[0]).slice(0, 160))).toEqual([]);
    errors.mockRestore();
  });
});

describe('AceRecapPlayer', () => {
  let callbacks: FrameRequestCallback[] = [];
  beforeEach(() => {
    callbacks = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callbacks.push(cb); return callbacks.length; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const tick = (t: number) => act(() => { const cb = callbacks[callbacks.length - 1]; callbacks = []; cb(t); });

  it('restarts from the beginning even while it is playing', () => {
    render(<AceRecapPlayer presentation={toRecapPresentation(snapshotWith('Kit Lorne'))} />);
    const seek = screen.getByRole('slider', { name: 'Seek recap' }) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    tick(1000);
    tick(3000); // two seconds in
    expect(Number(seek.value)).toBe(60);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    tick(10_000); // first tick after restart re-anchors the clock
    expect(Number(seek.value)).toBe(0);
    tick(11_000);
    expect(Number(seek.value)).toBe(30);
  });
});
