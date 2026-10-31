import { buildBranchPreview } from './aceBranchPreview';
import { buildPublishPreview, type AceNodeRef } from './aceAssignments';
import type { AceAssignmentCycle, AceAssignmentDraft, AceFamily } from '../types';

const family = (id: string, is_published = true): AceFamily => ({
  id, name: 'Fictional ' + id, slug: id, is_published,
  academic_year_start: null, academic_year_end: null, cover_image_url: null,
  theme_color: null, description: null, display_order: 0, created_at: '', updated_at: '',
});
const node = (id: string, parentId: string | null = null, over: Partial<AceNodeRef> = {}): AceNodeRef => ({
  id, name: 'Fictional ' + id, familyId: 'family-a', familyName: 'Fictional family',
  parentId, memberId: 'member-' + id, roleLabel: parentId ? 'Little' : 'Big',
  isPublished: true, pickupAcademicYearStart: null, pickupTerm: null, ...over,
});
const draft = (id: string, big_ace_member_id = 'big', over: Partial<AceAssignmentDraft> = {}): AceAssignmentDraft => ({
  id, cycle_id: 'cycle', little_name: 'Fictional Little ' + id,
  little_member_id: 'little-' + id, big_ace_member_id, published_ace_member_id: null,
  notes: 'DO NOT show private notes', display_order: 0, created_at: '', updated_at: '', ...over,
});
const cycle = (status: AceAssignmentCycle['status'] = 'draft', pickup_term?: string | null) => ({
  id: 'cycle', status, academic_year_start: 2026, pickup_term,
});
const build = (ds: AceAssignmentDraft[], ns: AceNodeRef[], options: {
  term?: string | null; status?: AceAssignmentCycle['status']; families?: AceFamily[];
} = {}) => buildBranchPreview({
  cycle: cycle(options.status, options.term),
  drafts: ds, nodes: ns, families: options.families ?? [family('family-a')],
});

describe('admin-only ACE branch preview foundation (#665)', () => {
  it('uses exactly the existing publish planner and preserves skipped drafts', () => {
    const ns = [node('big')];
    const ds = [draft('one'), draft('missing', 'deleted'), draft('orphan', ''), draft('already', 'big', {
      published_ace_member_id: 'existing',
    })];
    const result = build(ds, ns);
    const plan = buildPublishPreview(ds, ns);
    expect(result.skipped).toEqual(plan.skipped);
    expect(result.fams[0].fullNodes.filter((n) => n.isDraft).map((n) => n.id)).toEqual(
      plan.nodes.map((n) => 'draft:' + n.draftId),
    );
    expect(result.fams[0].fullNodes.filter((n) => n.isDraft).every((n) => n.photoUrl === null)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('DO NOT show private notes');
  });

  it('keeps the historical Big and sibling unchanged with two additional Littles', () => {
    const ns = [
      node('root', null, { pickupAcademicYearStart: 2020, pickupTerm: 'FA20' }),
      node('big', 'root', { roleLabel: 'Little', pickupAcademicYearStart: 2021, pickupTerm: 'FA21' }),
      node('existing', 'big', { pickupAcademicYearStart: 2022, pickupTerm: 'FA22' }),
    ];
    const before = JSON.stringify(ns);
    const result = build([draft('one'), draft('two')], ns, { term: 'FA26', status: 'locked' });
    expect(JSON.stringify(ns)).toBe(before);
    expect(result.isFinal).toBe(true);
    expect(result.fams[0].byBig).toEqual([
      { bigId: 'big', bigName: 'Fictional big', existing: 1, incoming: 2 },
    ]);
    expect(result.fams[0].newOnlyNodes.map((n) => n.id)).toEqual([
      'root', 'big', 'existing', 'draft:one', 'draft:two',
    ]);
    expect(result.fams[0].fullNodes.find((n) => n.id === 'big')).toMatchObject({
      parent: 'root', role: 'Little',
    });
    expect(result.fams[0].fullNodes.find((n) => n.id === 'big')?.isDraft).toBeUndefined();
    expect(result.fams[0].fullNodes.filter((n) => n.isDraft)).toEqual([
      expect.objectContaining({ id: 'draft:one', parent: 'big', pickup: {
        status: 'verified', academicYearStart: 2026, term: 'FA26',
      } }),
      expect.objectContaining({ id: 'draft:two', parent: 'big', pickup: {
        status: 'verified', academicYearStart: 2026, term: 'FA26',
      } }),
    ]);
    expect(result.checks.some((c) => c.code === 'big_unpublished')).toBe(false);
  });

  it('keeps a missing #674 pickup term unknown instead of borrowing the Big year', () => {
    const result = build([draft('one')], [
      node('big', null, { pickupAcademicYearStart: 2021, pickupTerm: 'FA21' }),
    ]);
    expect(result.isFinal).toBe(false);
    expect(result.fams[0].fullNodes.find((n) => n.isDraft)?.pickup).toEqual({ status: 'unknown' });
    expect(result.checks.find((c) => c.code === 'draft_year_unknown')?.draftIds).toEqual(['one']);
  });

  it('treats an unpublished Big as a public root and warns without exposing it', () => {
    const result = build([draft('one')], [node('big', null, { isPublished: false })], { term: 'FA26' });
    const [fam] = result.fams;
    expect(fam.fullNodes).toHaveLength(1);
    expect(fam.fullNodes[0]).toMatchObject({ id: 'draft:one', parent: null, isDraft: true });
    expect(result.checks.map((c) => c.code)).toContain('big_unpublished');
  });

  it('warns about an unpublished family and about a Big with no verified member link', () => {
    const result = build([draft('one')], [
      node('big', null, { memberId: null }),
    ], { families: [family('family-a', false)] });
    expect(result.fams[0].isPublished).toBe(false);
    expect(result.checks.map((c) => c.code)).toEqual(expect.arrayContaining([
      'family_unpublished', 'big_no_member_link',
    ]));
  });

  it('flags ambiguous Big names, missing parents, duplicate canonical links and cycles', () => {
    const ns = [
      node('big', 'dup', { memberId: 'one' }),
      node('dup', 'big', { memberId: 'one', name: 'Fictional big' }),
      node('orphan', 'deleted', { memberId: 'orphan-member' }),
    ];
    const result = build([draft('one')], ns);
    const codes = result.checks.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining([
      'big_name_ambiguous', 'lineage_cycle', 'parent_missing', 'member_linked_twice',
    ]));
    expect(result.fams[0].fullNodes.filter((n) => n.isDraft)).toHaveLength(1);
  });

  it('flags a cross-family parent instead of traversing into a different private family', () => {
    const ns = [
      node('foreign-grand', null, {
        familyId: 'family-b', familyName: 'Other Fam',
        isPublished: false, name: 'Other Fam Private Ancestor',
      }),
      node('big', 'foreign-grand', { pickupAcademicYearStart: 2021, pickupTerm: 'FA21' }),
      node('existing', 'big', { pickupAcademicYearStart: 2022, pickupTerm: 'FA22' }),
    ];
    const before = JSON.stringify(ns);
    const result = build([draft('one')], ns, {
      term: 'FA26', families: [family('family-a'), family('family-b')],
    });
    const [fam] = result.fams;
    expect(JSON.stringify(ns)).toBe(before);
    expect(result.skipped).toEqual([]);
    expect(fam.fullNodes.map((n) => n.id)).toEqual(['big', 'existing', 'draft:one']);
    expect(fam.newOnlyNodes.map((n) => n.id)).toEqual(['big', 'existing', 'draft:one']);
    const wrong = result.checks.filter((c) => c.code === 'parent_wrong_family');
    expect(wrong.some((c) => c.nodeIds.includes('big') && c.draftIds.includes('one'))).toBe(true);
    expect(result.checks.some((c) => c.code === 'parent_missing')).toBe(false);
    expect(JSON.stringify(fam)).not.toContain('Other Fam Private Ancestor');
  });

  it('never represents an unpublished family as publicly visible, even with published member flags', () => {
    const result = build([draft('one')], [
      node('big', null, { isPublished: true }),
      node('existing', 'big', { isPublished: true }),
    ], { families: [family('family-a', false)], term: 'FA26' });
    expect(result.fams[0].fullNodes).toEqual([
      expect.objectContaining({ id: 'draft:one', isDraft: true, parent: null }),
    ]);
    expect(result.fams[0].newOnlyNodes).toHaveLength(1);
    expect(result.fams[0].byBig[0]).toMatchObject({ existing: 0, incoming: 1 });
    expect(result.checks.map((c) => c.code)).toContain('family_unpublished');
  });

  it('does not flag valid same-family multigeneration ancestry as a cross-family link', () => {
    const result = build([draft('one')], [node('root'), node('big', 'root')], { term: 'FA26' });
    expect(result.checks.map((c) => c.code)).not.toContain('parent_wrong_family');
  });

  it('detects a draft pickup earlier than its verified Big and does not change that year', () => {
    const ns = [node('big', null, { pickupAcademicYearStart: 2027, pickupTerm: 'FA27' })];
    const result = build([draft('one')], ns, { term: 'FA26' });
    expect(result.checks.map((c) => c.code)).toContain('little_before_big');
    expect(ns[0].pickupAcademicYearStart).toBe(2027);
  });

  it('retains every node in a 153-node published family without truncation', () => {
    const ns = Array.from({ length: 153 }, (_, i) => node('node-' + i, i ? 'node-' + (i - 1) : null));
    const result = build([draft('one', 'node-152')], ns, { term: 'FA26' });
    expect(result.fams[0].fullNodes).toHaveLength(154);
    expect(result.fams[0].newOnlyNodes).toHaveLength(154);
    expect(result.fams[0].fullNodes.filter((n) => n.isDraft)).toHaveLength(1);
  });

  it('does not accidentally classify unrelated families or draft descendants as public', () => {
    const ns = [
      node('big'), node('other', null, { familyId: 'family-b', familyName: 'Other' }),
    ];
    const result = build([draft('one')], ns, { families: [family('family-a'), family('family-b')] });
    expect(result.fams).toHaveLength(1);
    expect(result.fams[0].fullNodes.every((n) => n.id !== 'other')).toBe(true);
    expect(result.fams[0].fullNodes.find((n) => n.isDraft)?.isDraft).toBe(true);
  });
});
