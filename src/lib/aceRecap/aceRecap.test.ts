// Synthetic fixtures only. Never put real ACE names or member ids in this file.
import type { AceFamily } from '../../types';
import type { AceNodeRef } from '../aceAssignments';
import {
  buildRecapSnapshot, cleanPersonName, compareNames, diffPairingSheets, parseOfficialPairingRows,
  planRecapTimeline, resolveBig, scenesAt, splitPeople, toRecapPresentation,
} from '.';

const fam = (id: string, name: string): AceFamily => ({
  id, name, slug: name.toLowerCase().replace(/\W+/g, '-'), academic_year_start: null, academic_year_end: null,
  cover_image_url: null, theme_color: null, description: null, display_order: 0, is_published: true,
  created_at: '', updated_at: '',
});
const node = (id: string, name: string, familyId: string, parentId: string | null, memberId: string | null = null): AceNodeRef => ({
  id, name, familyId, familyName: null, memberId, parentId, roleLabel: null, isPublished: true,
});

const FAMILIES = [fam('f-orchid', 'Orchid'), fam('f-comet', 'Comet'), fam('f-old', '(Dead) Lantern')];
const NODES: AceNodeRef[] = [
  node('o1', 'Rowan Vale', 'f-orchid', null),
  node('o2', 'Juniper Ash', 'f-orchid', 'o1', 'm-juniper'),
  node('o3', 'Marlo Quill', 'f-orchid', 'o2'),
  node('o4', 'Sable Fenn', 'f-orchid', 'o1'),
  node('c1', 'Tamsin Reed', 'f-comet', null),
  node('c2', 'Ira Blue', 'f-comet', 'c1'),
  node('c3', 'Sable Fenn', 'f-comet', 'c1'),
  node('d1', 'Ollie Pike', 'f-old', null),
  node('d2', 'Juniper Ash', 'f-old', 'd1'),
];
const named = (families: AceFamily[], nodes: AceNodeRef[]) =>
  nodes.map((n) => ({ ...n, familyName: families.find((f) => f.id === n.familyId)!.name }));

const SHEET = [
  ['', 'BIGS', 'Sent?', '', 'LITTLES', '', 'Rejections:', 'Bigs'],
  ['', 'Juniper Ash', 'TRUE', '', 'Kit Lorne + Wren Oak', '', '', 'Nova Gale'],
  ['', 'Marlo, Q, Quill', 'TRUE', '', 'Pax Hale', '', '', ''],
  ['', 'Sable Fenn', 'TRUE', '', 'Lumi Day', '', '', ''],
  ['', 'Ira T Blue', 'TRUE', '', 'Bo Stern + Cy Moss + Dee Fox', '', '', ''],
  ['', 'Zed Unknown', 'TRUE', '', 'Eli Rook', '', '', ''],
  ['', 'Ollie Pike', 'TRUE', '', 'Fae Ray', '', '', ''],
  ['', 'Kit Lorne + Wren Oak', 'TRUE', '', 'Gus Wynn', '', '', ''],
  [],
  ['', 'TOTAL BIGS: 7', '', '', 'TOTAL LITTLES: 10'],
];

describe('official pairing sheet', () => {
  it('cleans comma-separated names and splits Littles on "+"', () => {
    expect(cleanPersonName(' Marlo, Q, Quill ')).toBe('Marlo Q Quill');
    expect(splitPeople('A Bee + C Dee &  E Eff')).toEqual(['A Bee', 'C Dee', 'E Eff']);
  });

  it('reads only the BIGS/LITTLES columns and checks the declared totals', () => {
    const sheet = parseOfficialPairingRows(SHEET);
    expect(sheet.bigCount).toBe(7);
    expect(sheet.littleCount).toBe(10);
    expect(sheet.declaredBigs).toBe(7);
    expect(sheet.declaredLittles).toBe(10);
    const everyone = sheet.pairings.flatMap((p) => [...p.bigNames, ...p.littleNames]);
    expect(everyone).not.toContain('Nova Gale'); // rejection column is never read
    expect(sheet.issues.map((i) => i.code).sort()).toEqual(['big_also_little', 'big_also_little', 'co_big']);
  });

  it('flags a declared total that does not match', () => {
    const rows = SHEET.map((r) => [...r]);
    rows[rows.length - 1] = ['', 'TOTAL BIGS: 8', '', '', 'TOTAL LITTLES: 10'];
    expect(parseOfficialPairingRows(rows).issues.map((i) => i.code)).toContain('big_count_mismatch');
  });

  it('diffs an older export: renamed Big, moved and added Littles', () => {
    const older = parseOfficialPairingRows([
      ['BIGS', 'LITTLES'], ['Juniper Ash', 'Kit Lorne + Wren Oak + Pax Hale'], ['Ira Blew', 'Bo Stern'],
    ]);
    const newer = parseOfficialPairingRows([
      ['BIGS', 'LITTLES'], ['Juniper Ash', 'Kit Lorne + Wren Oak'], ['Ira Blue', 'Bo Stern'],
      ['Marlo Quill', 'Pax Hale + Lumi Day'],
    ]);
    const diff = diffPairingSheets(older, newer);
    expect(diff.bigsRenamed).toEqual([{ from: 'Ira Blew', to: 'Ira Blue', littles: ['Bo Stern'] }]);
    expect(diff.littlesMoved).toEqual([{ little: 'Pax Hale', fromBig: 'Juniper Ash', toBig: 'Marlo Quill' }]);
    expect(diff.littlesAdded).toEqual([{ little: 'Lumi Day', big: 'Marlo Quill' }]);
    expect(diff.bigsAdded).toEqual(['Marlo Quill']);
  });
});

describe('Big resolution', () => {
  const nodes = named(FAMILIES, NODES);
  it('compares names exactly or by compatible middle initials only', () => {
    expect(compareNames('Ira T Blue', 'Ira Blue')).toBe('variant');
    expect(compareNames('Ira T Blue', 'Ira Tobias Blue')).toBe('variant');
    expect(compareNames('Ira T Blue', 'Ira D Blue')).toBeNull();
    expect(compareNames('Tamsin  Reed', 'tamsin reed')).toBe('exact');
    expect(compareNames('Ira Blue', 'Ira Bluett')).toBeNull();
  });

  it('resolves a single exact node and ignores archived-family namesakes', () => {
    const r = resolveBig('Juniper Ash', ['Juniper Ash'], { nodes });
    expect(r.status).toBe('resolved_exact');
    expect(r.chosen?.nodeId).toBe('o2');
    expect(r.notes.join(' ')).toMatch(/archived/);
  });

  it('never chooses between same-name nodes in different families', () => {
    const r = resolveBig('Sable Fenn', ['Sable Fenn'], { nodes });
    expect(r.status).toBe('ambiguous');
    expect(r.chosen).toBeNull();
    expect(r.candidates.map((c) => c.nodeId).sort()).toEqual(['c3', 'o4']);
  });

  it('reports missing, archived-only, co-Big and legacy-only Bigs without inventing nodes', () => {
    expect(resolveBig('Zed Unknown', ['Zed Unknown'], { nodes }).status).toBe('not_found');
    expect(resolveBig('Ollie Pike', ['Ollie Pike'], { nodes }).status).toBe('archived_family');
    expect(resolveBig('Kit Lorne + Wren Oak', ['Kit Lorne', 'Wren Oak'], { nodes }).status).toBe('co_big');
    expect(resolveBig('Tamsin Reed', ['Tamsin Reed'], {
      nodes, importTermByNodeId: new Map([['c1', 'legacy']]),
    }).status).toBe('stale_candidate');
  });
});

describe('recap snapshot', () => {
  const sheet = parseOfficialPairingRows(SHEET);
  const build = (extra: Partial<Parameters<typeof buildRecapSnapshot>[0]> = {}) => buildRecapSnapshot({
    cycle: { label: 'Fall 2099', academicYearStart: 2099 },
    source: { label: 'synthetic', revision: 'r1', retrievedAt: '2099-11-01' },
    families: FAMILIES, nodes: NODES, pairings: sheet.pairings, sheetIssues: sheet.issues, ...extra,
  });

  it('accounts for every Little exactly once and marks the file private', () => {
    const s = build();
    expect(s.visibility).toBe('private-preview');
    expect(s.records).toHaveLength(10);
    expect(s.totals.previewed + s.totals.queued).toBe(10);
    expect(new Set(s.records.map((r) => r.id)).size).toBe(10);
  });

  it('attaches previewable Littles under the resolved Big only, in that Big’s family', () => {
    const s = build();
    const orchid = s.families.find((f) => f.id === 'f-orchid')!;
    const comet = s.families.find((f) => f.id === 'f-comet')!;
    const kids = (f: typeof orchid, parent: string) => f.nodes.filter((n) => n.isNew && n.parent === parent).map((n) => n.label).sort();
    expect(kids(orchid, 'o2')).toEqual(['Kit Lorne', 'Wren Oak']);
    expect(kids(orchid, 'o3')).toEqual(['Pax Hale']);
    expect(kids(comet, 'c2')).toEqual(['Bo Stern', 'Cy Moss', 'Dee Fox']);
    expect(orchid.added + comet.added).toBe(6);
    // Every new node's parent is an existing node of the same family.
    for (const f of s.families) for (const n of f.nodes.filter((x) => x.isNew)) {
      expect(f.nodes.find((x) => x.id === n.parent)?.isNew).toBe(false);
    }
  });

  it('keeps ambiguous, missing, archived and co-Big rows out of every tree', () => {
    const s = build();
    const attached = new Set(s.families.flatMap((f) => f.nodes.filter((n) => n.isNew).map((n) => n.label)));
    for (const name of ['Lumi Day', 'Eli Rook', 'Fae Ray', 'Gus Wynn']) expect(attached.has(name)).toBe(false);
    expect(s.records.filter((r) => !r.safeToPreview).map((r) => r.bigStatus).sort())
      .toEqual(['ambiguous', 'archived_family', 'co_big', 'not_found']);
  });

  it('never alters existing ancestry', () => {
    const s = build();
    for (const original of NODES) {
      const f = s.families.find((x) => x.id === original.familyId)!;
      expect(f.nodes.find((n) => n.id === original.id)?.parent).toBe(original.parentId);
    }
    expect(s.families.find((f) => f.id === 'f-old')!.added).toBe(0);
  });

  it('flags, but never drops, an accepted pairing whose name is on a rejection list', () => {
    const s = build({ rejectedNames: ['Pax Hale'], approvals: [{ littleName: 'Kit Lorne', bigNodeId: 'o2' }] });
    const pax = s.records.find((r) => r.littleName === 'Pax Hale')!;
    expect(pax.safeToPreview).toBe(true);
    expect(pax.warnings).toContain('rejected_name_match');
    expect(pax.evidence.join(' ')).toMatch(/authoritative/);
    expect(s.records.find((r) => r.littleName === 'Kit Lorne')!.approvedForPublication).toBe(true);
    expect(s.records.filter((r) => r.approvedForPublication)).toHaveLength(1);
  });

  it('lets a Chair approval resolve a held pairing to the named node', () => {
    // Sable Fenn is ambiguous (o4 in Orchid, c3 in Comet); the Chair picks c3.
    const s = build({ approvals: [{ littleName: 'Lumi Day', bigNodeId: 'c3' }] });
    const lumi = s.records.find((r) => r.littleName === 'Lumi Day')!;
    expect(lumi).toMatchObject({ bigStatus: 'ambiguous', chairSelected: true, safeToPreview: true, approvedForPublication: true, bigNodeId: 'c3' });
    const comet = s.families.find((f) => f.id === 'f-comet')!;
    expect(comet.nodes.find((n) => n.isNew && n.label === 'Lumi Day')?.parent).toBe('c3');
    // A co-Big row and a not-found Big can be resolved the same way.
    const more = build({ approvals: [{ littleName: 'Gus Wynn', bigNodeId: 'o3' }, { littleName: 'Eli Rook', bigNodeId: 'c2' }] });
    expect(more.records.filter((r) => ['Gus Wynn', 'Eli Rook'].includes(r.littleName)).every((r) => r.safeToPreview && r.approvedForPublication)).toBe(true);
  });

  it('confirms a generation outlier only through an approval of that exact node', () => {
    const deep: AceNodeRef[] = [...NODES];
    let parent = 'o3';
    for (let i = 0; i < 6; i++) { deep.push(node(`deep${i}`, `Deep Person${i}`, 'f-orchid', parent)); parent = `deep${i}`; }
    const s = build({ nodes: deep, approvals: [{ littleName: 'Kit Lorne', bigNodeId: 'o2' }] });
    const kit = s.records.find((r) => r.littleName === 'Kit Lorne')!;
    expect(kit).toMatchObject({ safeToPreview: true, approvedForPublication: true, chairSelected: false });
    expect(kit.warnings).not.toContain('generation_outlier');
    expect(s.records.find((r) => r.littleName === 'Wren Oak')!.safeToPreview).toBe(false);
  });

  it('never lets an approval override the hard node checks', () => {
    const s = build({
      rejectedNames: ['Pax Hale'],
      approvals: [
        { littleName: 'Pax Hale', bigNodeId: 'o3' },
        { littleName: 'Fae Ray', bigNodeId: 'd1' }, // archived family
        { littleName: 'Eli Rook', bigNodeId: 'no-such-node' },
      ],
    });
    const by = (n: string) => s.records.find((r) => r.littleName === n)!;
    // A rejection-list namesake is a warning; the Chair's approval stands.
    expect(by('Pax Hale')).toMatchObject({ safeToPreview: true, approvedForPublication: true });
    expect(by('Pax Hale').warnings).toContain('rejected_name_match');
    expect(by('Fae Ray').warnings).toContain('approval_node_invalid');
    expect(by('Eli Rook')).toMatchObject({ safeToPreview: false, approvedForPublication: false });
    expect(by('Eli Rook').warnings).toContain('approval_node_invalid');
  });

  it('strips review data from the presentation used by the video and player', () => {
    const p = toRecapPresentation(build({ rejectedNames: ['Pax Hale'] }));
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/records|evidence|candidates|sheetIssues|revision|"checks"/);
    expect(p.visibility).toBe('private-preview');
    expect(p.families.flatMap((f) => f.nodes).some((n) => n.isNew)).toBe(true);
  });

  it('warns, without blocking, on a middle-initial namesake of a rejected person', () => {
    const s = build({ rejectedNames: ['Bo Q Stern'] });
    const bo = s.records.find((r) => r.littleName === 'Bo Stern')!;
    expect(bo.safeToPreview).toBe(true);
    expect(bo.warnings).toContain('rejected_namesake');
  });

  it('holds a Big far above the newest generation for review (no years inferred)', () => {
    const deep: AceNodeRef[] = [...NODES];
    let parent = 'o3';
    for (let i = 0; i < 6; i++) { deep.push(node(`deep${i}`, `Deep Person${i}`, 'f-orchid', parent)); parent = `deep${i}`; }
    const s = build({ nodes: deep });
    const kit = s.records.find((r) => r.littleName === 'Kit Lorne')!; // Big o2 is depth 1 of 9
    expect(kit.warnings).toContain('generation_outlier');
    expect(kit.safeToPreview).toBe(false);
    const relaxed = build({ nodes: deep, generationOutlierGap: 20 });
    expect(relaxed.records.find((r) => r.littleName === 'Kit Lorne')!.safeToPreview).toBe(true);
  });

  it('records the lineage from the family root to each growing Big', () => {
    const orchid = build().families.find((f) => f.id === 'f-orchid')!;
    expect(orchid.growth.find((g) => g.bigNodeId === 'o3')?.lineage).toEqual(['o1', 'o2', 'o3']);
    expect(orchid.after.generations).toBe(orchid.before.generations + 1);
  });
});

describe('recap timeline', () => {
  const presentationOf = () => toRecapPresentation(buildRecapSnapshot({
    cycle: { label: 'Fall 2099', academicYearStart: 2099 },
    source: { label: 'synthetic', revision: null, retrievedAt: '' },
    families: FAMILIES, nodes: NODES, pairings: parseOfficialPairingRows(SHEET).pairings,
  }));

  it('hooks, follows the biggest-growth family, gives every other growing family its own scene, then ends', () => {
    const t = planRecapTimeline(presentationOf(), { fps: 30 });
    expect(t.heroFamilyId).toBe('f-orchid');
    expect(t.scenes.map((x) => x.kind)).toEqual(['hook', 'hero', 'family', 'finale']);
    expect(t.scenes.find((x) => x.kind === 'family')?.familyId).toBe('f-comet');
    const gaps = t.scenes.slice(1).map((scene, i) => scene.from - (t.scenes[i].from + t.scenes[i].durationInFrames));
    expect(gaps.every((gap) => gap === 0)).toBe(true);
    expect(t.durationInFrames).toBe(t.scenes.reduce((a, x) => a + x.durationInFrames, 0));
    const hero = t.scenes.find((x) => x.kind === 'hero')!;
    expect(hero.phases!.lineage + hero.phases!.reveal + hero.phases!.expand).toBe(hero.durationInFrames);
  });

  it('covers many families without dropping any, and never repeats a treatment back to back', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`, name: `Fam ${i}`, slug: `f${i}`, themeColor: null, archived: false, nodes: [], width: 1, rows: 1,
      before: { people: 10, generations: 3, roots: 1 }, after: { people: 10 + (12 - i), generations: 4, roots: 1 },
      added: 12 - i, growth: [{ bigNodeId: 'b', bigLabel: 'B', littleIds: ['x'], lineage: ['r', 'b'] }],
    }));
    const t = planRecapTimeline({ families: many }, { fps: 30 });
    const covered = t.scenes.filter((x) => x.kind === 'hero' || x.kind === 'family').map((x) => x.familyId);
    expect(new Set(covered)).toEqual(new Set(many.map((m) => m.id)));
    const treatments = t.scenes.filter((x) => x.kind === 'family').map((x) => x.treatment);
    const repeats = treatments.slice(1).filter((tr, i) => tr !== 'portrait' && tr === treatments[i]);
    expect(repeats).toEqual([]);
    expect(treatments.slice(-2)).toEqual(['portrait', 'portrait']); // 2 and 1 new Littles
    expect(t.durationInFrames / 30).toBeLessThanOrEqual(110);
  });

  it('overlaps an entrance with the outgoing scene for a motivated transition', () => {
    const t = planRecapTimeline(presentationOf(), { fps: 30 });
    const family = t.scenes.find((x) => x.kind === 'family')!;
    expect(family.overlapIn).toBeGreaterThan(0);
    const during = scenesAt(t, family.from + 2);
    expect(during.map((l) => l.scene.kind)).toEqual(['hero', 'family']);
    expect(during[0].local).toBeGreaterThanOrEqual(during[0].scene.durationInFrames);
    expect(during[1].enter).toBeGreaterThan(0);
    expect(scenesAt(t, family.from + family.overlapIn + 1).map((l) => l.scene.kind)).toEqual(['family']);
  });

  it('still renders a hook and finale when nothing is previewable', () => {
    const t = planRecapTimeline({ families: [] });
    expect(t.heroFamilyId).toBeNull();
    expect(t.scenes.map((x) => x.kind)).toEqual(['hook', 'finale']);
  });
});
