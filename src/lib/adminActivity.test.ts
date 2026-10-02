import {
  ACTIVITY_ACTIONS,
  ActivityEntry,
  UNDO_WINDOW_MS,
  actionPrefixesFor,
  activityFilterFor,
  activitySummary,
  actorLabel,
  buildUndoMetadata,
  clampSummary,
  isUndoable,
  matchesActivityFilter,
  planUndo,
  readUndoSpec,
  sanitizeMetadata,
  undoEntryDraft,
  undoneEntryIds,
} from './adminActivity';

const NOW = Date.parse('2026-10-02T12:00:00Z');

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'e1',
    actorUserId: 'u1',
    action: ACTIVITY_ACTIONS.houseAssignmentChanged,
    entityType: 'house_assignment_draft',
    entityId: 'd1',
    academicYearStart: 2026,
    summary: "Changed Kevin Tran's House: Boo → Toad",
    metadata: buildUndoMetadata({ kind: 'house_draft_house', target: { batchId: 'b1', draftId: 'd1' }, before: 'boo', after: 'toad' }),
    createdAt: '2026-10-02T11:00:00Z',
    ...overrides,
  };
}

describe('activity filters', () => {
  it('maps every domain prefix to the filter the Recent Changes page offers', () => {
    expect(activityFilterFor('ace.link_changed')).toBe('ace');
    expect(activityFilterFor('house.batch_published')).toBe('houses');
    expect(activityFilterFor('cabinet.roster_published')).toBe('cabinet');
    expect(activityFilterFor('intern.added')).toBe('interns');
    expect(activityFilterFor('member.link_changed')).toBe('members');
    expect(activityFilterFor('year.setup_created')).toBe('year_setup');
    expect(activityFilterFor('mystery.thing')).toBeNull();
  });

  it('matches All and a specific filter, and exposes server-side prefixes', () => {
    expect(matchesActivityFilter('ace.link_changed', 'all')).toBe(true);
    expect(matchesActivityFilter('ace.link_changed', 'houses')).toBe(false);
    expect(actionPrefixesFor('all')).toBeNull();
    expect(actionPrefixesFor('houses')).toEqual(['house.']);
  });

  it('every defined action belongs to some filter', () => {
    for (const action of Object.values(ACTIVITY_ACTIONS)) {
      expect(activityFilterFor(action)).not.toBeNull();
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});

describe('summaries', () => {
  it('reads like the operational facts an admin wants', () => {
    expect(activitySummary.houseChanged('Kevin Tran', 'Boo', 'Toad')).toBe("Changed Kevin Tran's House: Boo → Toad");
    expect(activitySummary.aceLinked('Jenny Nguyen', 'Jenny Nguyen')).toBe('Linked ACE node "Jenny Nguyen" → member Jenny Nguyen');
    expect(activitySummary.published('Intern cohort', 2026, 12)).toBe('Published the 2026–27 Intern cohort (12 records)');
    expect(activitySummary.yearSetup(2027)).toBe('Prepared the 2027–28 academic year');
  });

  it('uses sensible words for empty values', () => {
    expect(activitySummary.houseChanged('Kevin', null, 'Toad')).toContain('Unassigned → Toad');
    expect(activitySummary.cabinetAssigned('Treasurer', null, 'Ada')).toBe('Treasurer: Unfilled → Ada');
  });

  it('keeps summaries within the database limit', () => {
    expect(clampSummary('x'.repeat(500)).length).toBeLessThanOrEqual(300);
    expect(clampSummary('  a   b \n c ')).toBe('a b c');
  });
});

describe('sanitizeMetadata', () => {
  it('drops sensitive-looking keys instead of storing them', () => {
    const cleaned = sanitizeMetadata({ memberName: 'Ada', email: 'a@b.c', nested: { phone: '555', ok: 1 }, apiKey: 'x', password: 'y' });
    expect(cleaned).toEqual({ memberName: 'Ada', nested: { ok: 1 } });
  });

  it('truncates long strings and caps arrays rather than dumping whole rows', () => {
    const cleaned = sanitizeMetadata({ note: 'n'.repeat(1000), ids: Array.from({ length: 200 }, (_, i) => `id${i}`) });
    expect((cleaned.note as string).length).toBeLessThanOrEqual(200);
    expect((cleaned.ids as string[]).length).toBe(50);
  });

  it('caps nesting depth', () => {
    const cleaned = sanitizeMetadata({ a: { b: { c: { d: 'deep' } } } });
    expect(JSON.stringify(cleaned)).not.toContain('deep');
  });

  it('stays under the database size limit while keeping the undo spec', () => {
    const undo = { kind: 'house_draft_house', target: { batchId: 'b', draftId: 'd' }, before: 'x', after: 'y' };
    const cleaned = sanitizeMetadata({ undo, filler: Array.from({ length: 50 }, () => 'z'.repeat(190)) });
    expect(JSON.stringify(cleaned).length).toBeLessThanOrEqual(2800);
    expect(cleaned.undo).toEqual(undo);
    expect(cleaned.truncated).toBe(true);
  });
});

describe('sanitizeMetadata byte budget', () => {
  it('counts bytes, not characters, so multi-byte names cannot overflow the database cap', () => {
    const accented = 'Nguyễn Thị Hương '.repeat(10);
    const cleaned = sanitizeMetadata({ rows: Array.from({ length: 30 }, () => accented) });
    const bytes = new TextEncoder().encode(JSON.stringify(cleaned)).length;
    expect(bytes).toBeLessThanOrEqual(2800);
  });
});

describe('readUndoSpec', () => {
  it('round-trips a valid spec', () => {
    const spec = { kind: 'ace_node_link' as const, target: { nodeId: 'n1' }, before: 'm0', after: 'm1' };
    expect(readUndoSpec(buildUndoMetadata(spec))).toEqual(spec);
  });

  it('rejects unknown kinds, missing target ids, and malformed values', () => {
    expect(readUndoSpec({ undo: { kind: 'drop_table', target: {}, before: null, after: null } })).toBeNull();
    expect(readUndoSpec({ undo: { kind: 'ace_node_link', target: {}, before: null, after: null } })).toBeNull();
    expect(readUndoSpec({ undo: { kind: 'ace_node_link', target: { nodeId: 'n' }, before: 5, after: null } })).toBeNull();
    expect(readUndoSpec({})).toBeNull();
  });

  it('keeps only the target keys the kind needs', () => {
    const spec = readUndoSpec({ undo: { kind: 'ace_node_link', target: { nodeId: 'n', extra: 'x' }, before: null, after: 'm' } });
    expect(spec?.target).toEqual({ nodeId: 'n' });
  });
});

describe('isUndoable', () => {
  it('offers undo for a recent supported change', () => {
    expect(isUndoable(entry(), { now: NOW })).toBe(true);
  });

  it.each([
    ACTIVITY_ACTIONS.aceCyclePublished,
    ACTIVITY_ACTIONS.houseBatchPublished,
    ACTIVITY_ACTIONS.cabinetRosterPublished,
    ACTIVITY_ACTIONS.internCohortPublished,
    ACTIVITY_ACTIONS.yearSetupCreated,
    ACTIVITY_ACTIONS.houseBulkChanged,
  ])('never offers one-click undo for %s, even with an undo block attached', (action) => {
    expect(isUndoable(entry({ action }), { now: NOW })).toBe(false);
  });

  it('rejects a spec whose kind does not match the action', () => {
    const wrong = entry({ metadata: buildUndoMetadata({ kind: 'intern_mentor', target: { cycleId: 'c', draftId: 'd' }, before: null, after: 'm' }) });
    expect(isUndoable(wrong, { now: NOW })).toBe(false);
  });

  it('is not offered twice or after the undo window', () => {
    expect(isUndoable(entry(), { now: NOW, undoneIds: new Set(['e1']) })).toBe(false);
    expect(isUndoable(entry({ createdAt: new Date(NOW - UNDO_WINDOW_MS - 1000).toISOString() }), { now: NOW })).toBe(false);
  });

  it('is not offered when nothing actually changed', () => {
    const noop = entry({ metadata: buildUndoMetadata({ kind: 'house_draft_house', target: { batchId: 'b', draftId: 'd' }, before: 'x', after: 'x' }) });
    expect(isUndoable(noop, { now: NOW })).toBe(false);
  });
});

describe('planUndo', () => {
  const spec = readUndoSpec(entry().metadata)!;

  it('restores the previous value while the recorded one is still current', () => {
    expect(planUndo(spec, { found: true, value: 'toad', editable: true })).toEqual({ ok: true, restore: 'boo' });
  });

  it('refuses when the value changed again since', () => {
    const plan = planUndo(spec, { found: true, value: 'frog', editable: true });
    expect(plan.ok).toBe(false);
  });

  it('refuses when the record is gone or locked', () => {
    expect(planUndo(spec, { found: false, value: null, editable: true }).ok).toBe(false);
    expect(planUndo(spec, { found: true, value: 'toad', editable: false }).ok).toBe(false);
  });

  it('treats null and undefined as the same empty value', () => {
    const cleared = { ...spec, after: null };
    expect(planUndo(cleared, { found: true, value: null, editable: true }).ok).toBe(true);
  });
});

describe('undo bookkeeping', () => {
  it('records the undo as a new entry that points at the original', () => {
    const draft = undoEntryDraft(entry());
    expect(draft.action).toBe('house.assignment_undone');
    expect(draft.metadata).toEqual({ undoes: 'e1' });
    expect(draft.summary).toContain('Undid:');
  });

  it('collects undone ids so the same change cannot be undone twice', () => {
    expect(undoneEntryIds([{ metadata: { undoes: 'e1' } }, { metadata: {} }])).toEqual(new Set(['e1']));
  });

  it('an undone entry is not itself undoable', () => {
    expect(isUndoable({ ...entry(), id: 'e2', action: 'house.assignment_undone', metadata: { undoes: 'e1' } }, { now: NOW })).toBe(false);
  });
});

describe('actorLabel', () => {
  it('prefers a first name and falls back to the email local part', () => {
    expect(actorLabel({ email: 'x@y.z', user_metadata: { full_name: 'Havyn Nguyen' } })).toBe('Havyn');
    expect(actorLabel({ email: 'april.t@vsa.org' })).toBe('april');
    expect(actorLabel(null)).toBe('An admin');
  });
});
