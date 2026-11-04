// Synthetic fixtures only. Never put real ACE names or member ids in this file.
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AceFamily } from '../../../../types';
import type { AceNodeRef } from '../../../../lib/aceAssignments';
import { buildRecapSnapshot, parseOfficialPairingRows } from '../../../../lib/aceRecap';
import { AceRecapPlayer } from './AceRecapPlayer';
import { stageFamily } from './stageModel';

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
    render(<AceRecapPlayer snapshot={snapshotWith('Kit Lorne')} />);
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
