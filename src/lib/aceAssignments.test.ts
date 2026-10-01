import {
  AceNodeRef,
  buildPublishPreview,
  canTransitionCycle,
  computeBigLoad,
  computePreflight,
  formatAcademicYear,
  isCycleEditable,
  parseAssignmentImport,
  resolveImportRows,
  reviewUnlinkedLittles,
  selectBulkLittleLinks,
} from './aceAssignments';
import { buildMemberNameIndex, toMemberOption } from './memberLinkMatching';
import type { AceAssignmentDraft } from '../types';

const draft = (id: string, name: string, over: Partial<AceAssignmentDraft> = {}): AceAssignmentDraft => ({
  id,
  cycle_id: 'cycle-1',
  little_name: name,
  little_member_id: null,
  big_ace_member_id: 'big-april',
  published_ace_member_id: null,
  notes: null,
  display_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const node = (id: string, name: string, over: Partial<AceNodeRef> = {}): AceNodeRef => ({
  id,
  name,
  familyId: 'fam-sweatpants',
  familyName: 'Sweatpants',
  memberId: null,
  parentId: null,
  roleLabel: 'Little',
  ...over,
});

const nodes = [
  node('big-april', 'April Pham'),
  node('big-emily', 'Emily Nguyen', { familyId: 'fam-nsf', familyName: 'NSF' }),
  node('big-emily-2', 'Emily Nguyen', { familyId: 'fam-down', familyName: 'Down' }),
];

const member = (id: string, first: string, last: string) =>
  toMemberOption({ id, first_name: first, last_name: last, college: 'Sixth', year: 'Third Year' });

const index = buildMemberNameIndex([
  member('m-amy', 'Amy', 'Tran'),
  member('m-kevin', 'Kevin', 'Le'),
  member('m-andy-1', 'Andy', 'Tran'),
  member('m-andy-2', 'Andy', 'Tran'),
]);

const codes = (list: ReturnType<typeof computePreflight>['issues']) => list.map((i) => i.code);

describe('computePreflight', () => {
  it('counts Littles, links, and assignments', () => {
    const result = computePreflight(
      [
        draft('d1', 'Amy Tran', { little_member_id: 'm-amy' }),
        draft('d2', 'Kevin Le', { little_member_id: 'm-kevin', big_ace_member_id: 'big-emily' }),
        draft('d3', 'Zed Nobody', { big_ace_member_id: null }),
      ],
      nodes,
      index,
      'draft',
    );
    expect(result).toMatchObject({ littleCount: 3, linkedCount: 2, assignedCount: 2, unassignedCount: 1, bigCount: 2 });
  });

  it('blocks publish on an unassigned Little and on a deleted Big', () => {
    const result = computePreflight(
      [draft('d1', 'Amy Tran', { big_ace_member_id: null }), draft('d2', 'Kevin Le', { big_ace_member_id: 'gone' })],
      nodes,
      index,
      'locked',
    );
    expect(codes(result.blockers)).toEqual(expect.arrayContaining(['unassigned', 'missing_big']));
    expect(result.canPublish).toBe(false);
  });

  it('flags the same Little twice, ignoring case, spacing and diacritics', () => {
    const result = computePreflight(
      [draft('d1', 'Amy Tran'), draft('d2', '  amy   TRAN '), draft('d3', 'Kevin Le')],
      nodes,
      index,
      'draft',
    );
    const issue = result.blockers.find((i) => i.code === 'duplicate_little');
    expect(issue?.message).toBe('1 Little appears twice');
    expect(issue?.draftIds.sort()).toEqual(['d1', 'd2']);
    expect(result.canPublish).toBe(false);
  });

  it('flags one canonical member assigned twice, even under different names', () => {
    const result = computePreflight(
      [
        draft('d1', 'Amy Tran', { little_member_id: 'm-amy' }),
        draft('d2', 'Amy T.', { little_member_id: 'm-amy', big_ace_member_id: 'big-emily' }),
      ],
      nodes,
      index,
      'draft',
    );
    const issue = result.blockers.find((i) => i.code === 'duplicate_member');
    expect(issue?.message).toBe('1 canonical member assigned twice');
    expect(issue?.draftIds.sort()).toEqual(['d1', 'd2']);
  });

  it('blocks a Little who is already on the tree under the same Big, by name or member', () => {
    const live = [
      ...nodes,
      node('existing-1', 'Kevin Le', { parentId: 'big-april' }),
      node('existing-2', 'Someone Else', { parentId: 'big-emily', memberId: 'm-amy' }),
    ];
    const result = computePreflight(
      [
        draft('d1', 'kevin le'),
        draft('d2', 'Amy Tran', { little_member_id: 'm-amy', big_ace_member_id: 'big-emily' }),
      ],
      live,
      index,
      'locked',
    );
    expect(result.blockers.find((i) => i.code === 'already_on_tree')?.draftIds.sort()).toEqual(['d1', 'd2']);
  });

  it('only warns when the member appears elsewhere on the tree', () => {
    const live = [...nodes, node('old-amy', 'Amy Tran', { memberId: 'm-amy', parentId: 'big-emily' })];
    const result = computePreflight([draft('d1', 'Amy Tran', { little_member_id: 'm-amy' })], live, index, 'locked');
    expect(codes(result.blockers)).toEqual([]);
    expect(codes(result.warnings)).toContain('member_on_other_node');
    expect(result.canPublish).toBe(true);
  });

  it('blocks a draft that already created a node, until the cycle is published', () => {
    const drafts = [draft('d1', 'Amy Tran', { published_ace_member_id: 'node-x' })];
    expect(codes(computePreflight(drafts, nodes, index, 'locked').blockers)).toContain('already_published');
    expect(codes(computePreflight(drafts, nodes, index, 'published').blockers)).toEqual([]);
  });

  it('keeps member-link gaps as warnings: ambiguous, obvious-but-unlinked, and no record', () => {
    const result = computePreflight(
      [draft('d1', 'Andy Tran'), draft('d2', 'Kevin Le'), draft('d3', 'Old Alumni Name')],
      nodes,
      index,
      'draft',
    );
    expect(result.blockers).toEqual([]);
    expect(result.warnings.map((w) => [w.code, w.draftIds])).toEqual([
      ['ambiguous_match', ['d1']],
      ['unlinked_suggestion', ['d2']],
      ['no_member_record', ['d3']],
    ]);
    expect(result.canPublish).toBe(true);
  });

  it('cannot publish an empty cycle', () => {
    expect(computePreflight([], nodes, index, 'locked').canPublish).toBe(false);
  });
});

describe('cycle lifecycle', () => {
  it('only a draft is editable', () => {
    expect(isCycleEditable('draft')).toBe(true);
    for (const status of ['locked', 'published', 'archived'] as const) expect(isCycleEditable(status)).toBe(false);
  });

  it('allows lock and an explicit unlock, but nothing back out of published', () => {
    expect(canTransitionCycle('draft', 'locked')).toBe(true);
    expect(canTransitionCycle('locked', 'draft')).toBe(true);
    expect(canTransitionCycle('locked', 'published')).toBe(true);
    expect(canTransitionCycle('draft', 'published')).toBe(false);
    expect(canTransitionCycle('published', 'draft')).toBe(false);
    expect(canTransitionCycle('published', 'locked')).toBe(false);
    expect(canTransitionCycle('published', 'archived')).toBe(true);
    expect(canTransitionCycle('archived', 'draft')).toBe(false);
  });

  it('formats the academic year', () => {
    expect(formatAcademicYear(2026)).toBe('2026–27');
    expect(formatAcademicYear(2099)).toBe('2099–00');
  });
});

describe('buildPublishPreview', () => {
  it('puts each Little in their Big\'s family with the Big as parent', () => {
    const preview = buildPublishPreview(
      [
        draft('d1', ' Amy Tran ', { little_member_id: 'm-amy', big_ace_member_id: 'big-april' }),
        draft('d2', 'Kevin Le', { big_ace_member_id: 'big-emily' }),
        draft('d3', 'Third', { big_ace_member_id: 'big-emily-2' }),
      ],
      nodes,
    );
    expect(preview.nodes).toEqual([
      { draftId: 'd1', name: 'Amy Tran', familyId: 'fam-sweatpants', parentMemberId: 'big-april', memberId: 'm-amy', roleLabel: 'Little', isPublished: true },
      { draftId: 'd2', name: 'Kevin Le', familyId: 'fam-nsf', parentMemberId: 'big-emily', memberId: null, roleLabel: 'Little', isPublished: true },
      { draftId: 'd3', name: 'Third', familyId: 'fam-down', parentMemberId: 'big-emily-2', memberId: null, roleLabel: 'Little', isPublished: true },
    ]);
    expect(preview.familyCount).toBe(3);
    expect(preview.skipped).toEqual([]);
  });

  it('skips unassigned, deleted-Big, and already-published drafts, so a second run adds nothing', () => {
    const drafts = [
      draft('d1', 'Amy Tran', { big_ace_member_id: null }),
      draft('d2', 'Kevin Le', { big_ace_member_id: 'gone' }),
      draft('d3', 'Third', { published_ace_member_id: 'node-3' }),
    ];
    const preview = buildPublishPreview(drafts, nodes);
    expect(preview.nodes).toEqual([]);
    expect(preview.skipped.map((s) => s.reason)).toEqual(['unassigned', 'missing_big', 'already_published']);
  });
});

describe('computeBigLoad', () => {
  it('counts Littles already on the tree and new ones in the cycle', () => {
    const live = [...nodes, node('c1', 'Child One', { parentId: 'big-april' }), node('c2', 'Child Two', { parentId: 'big-april' })];
    const load = computeBigLoad('big-april', [draft('d1', 'A'), draft('d2', 'B', { published_ace_member_id: 'x' })], live);
    expect(load).toEqual({ current: 2, incoming: 1 });
  });
});

describe('reviewUnlinkedLittles', () => {
  it('recommends only unique exact matches and never an ambiguous one', () => {
    const items = reviewUnlinkedLittles(
      [draft('d1', 'Amy Tran'), draft('d2', 'Andy Tran'), draft('d3', 'Nobody Here'), draft('d4', 'Kevin Le', { little_member_id: 'm-kevin' })],
      index,
    );
    expect(items.map((i) => [i.draft.id, i.status])).toEqual([
      ['d1', 'recommended'],
      ['d2', 'ambiguous'],
      ['d3', 'none'],
    ]);
    expect(selectBulkLittleLinks(items)).toEqual([{ draftId: 'd1', memberId: 'm-amy' }]);
  });

  it('does not bulk-link a member that another Little already holds or also wants', () => {
    const held = reviewUnlinkedLittles([draft('d1', 'Amy Tran'), draft('d2', 'Someone', { little_member_id: 'm-amy' })], index);
    expect(held[0].status).toBe('conflict');
    const twice = reviewUnlinkedLittles([draft('d1', 'Amy Tran'), draft('d2', 'amy tran')], index);
    expect(twice.map((i) => i.status)).toEqual(['conflict', 'conflict']);
    expect(selectBulkLittleLinks([...held, ...twice])).toEqual([]);
  });
});

describe('parseAssignmentImport', () => {
  it('reads a TSV with a header and every recognized column', () => {
    const parsed = parseAssignmentImport(
      'First Name\tLast Name\tEmail\tBig Name\tNotes\nJohn\tNguyen\tJohn@UCSD.edu\tApril Pham\tlikes boba\nAmy\tTran\t\t\t',
    );
    expect(parsed.columns).toEqual(['first', 'last', 'email', 'big', 'notes']);
    expect(parsed.rows).toEqual([
      { line: 2, name: 'John Nguyen', email: 'john@ucsd.edu', bigName: 'April Pham', notes: 'likes boba' },
      { line: 3, name: 'Amy Tran', email: null, bigName: null, notes: null },
    ]);
  });

  it('reads a CSV with quoted cells and a single name column', () => {
    const parsed = parseAssignmentImport('name,big\n"Tran, Amy",April Pham\n\n   ,\n"Kevin ""KL"" Le",');
    expect(parsed.rows.map((r) => [r.name, r.bigName])).toEqual([
      ['Tran, Amy', 'April Pham'],
      ['Kevin "KL" Le', null],
    ]);
    expect(parsed.skipped).toBe(1);
  });

  it('falls back to one name per line without a header, and warns', () => {
    const parsed = parseAssignmentImport('John Nguyen\nAmy Tran');
    expect(parsed.rows.map((r) => r.name)).toEqual(['John Nguyen', 'Amy Tran']);
    expect(parsed.warnings).toHaveLength(1);
  });

  it('refuses a header that has no name column', () => {
    const parsed = parseAssignmentImport('email,big\nx@y.com,April');
    expect(parsed.rows).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/No name column/);
  });
});

describe('resolveImportRows', () => {
  const rows = parseAssignmentImport('name,email,big\nAmy Tran,AMY@ucsd.edu,April Pham\nKevin Le,,Emily Nguyen\nNew Person,,Nobody Known\nAndy Tran,a@b.com,').rows;

  it('links by unique email, assigns a uniquely named Big, and keeps unresolved Bigs in notes', () => {
    const resolution = resolveImportRows(rows, {
      nodes,
      membersByEmail: new Map([['amy@ucsd.edu', [member('m-amy', 'Amy', 'Tran')]], ['a@b.com', [member('m-andy-1', 'Andy', 'Tran'), member('m-andy-2', 'Andy', 'Tran')]]]),
    });
    expect(resolution.seeds).toEqual([
      { little_name: 'Amy Tran', little_member_id: 'm-amy', big_ace_member_id: 'big-april', notes: null },
      { little_name: 'Kevin Le', little_member_id: null, big_ace_member_id: null, notes: 'Requested Big: Emily Nguyen (several matches)' },
      { little_name: 'New Person', little_member_id: null, big_ace_member_id: null, notes: 'Requested Big: Nobody Known (not found)' },
      { little_name: 'Andy Tran', little_member_id: null, big_ace_member_id: null, notes: null },
    ]);
    expect(resolution).toMatchObject({ emailLinked: 1, bigMatched: 1, bigUnresolved: 2 });
  });

  it('never carries an email into the draft rows', () => {
    const { seeds } = resolveImportRows(rows, { nodes, membersByEmail: new Map() });
    expect(JSON.stringify(seeds)).not.toMatch(/@/);
    expect(seeds.every((seed) => !('email' in seed))).toBe(true);
  });

  it('does not auto-link by name; that is left to the review step', () => {
    const { seeds } = resolveImportRows(parseAssignmentImport('name\nKevin Le').rows, { nodes, membersByEmail: new Map() });
    expect(seeds[0].little_member_id).toBeNull();
  });
});
