import { aceIssues, buildReadiness, cabinetIssues, houseIssues, internIssues, UnifiedIssue } from './adminPreflight';

const issue = (level: UnifiedIssue['level'], id: string = level): UnifiedIssue => ({ id, level, title: id, count: 1 });

describe('buildReadiness', () => {
  it('is Ready with zero blockers even when warnings exist', () => {
    const readiness = buildReadiness([issue('warning', 'a'), issue('warning', 'b'), issue('warning', 'c')]);
    expect(readiness.ready).toBe(true);
    expect(readiness.headline).toBe('Ready to Publish');
    expect(readiness.subline).toBe('0 blockers · 3 warnings');
  });

  it('is Not Ready when any blocker remains', () => {
    const readiness = buildReadiness([issue('blocker', 'a'), issue('blocker', 'b'), ...[1, 2, 3, 4].map((n) => issue('warning', `w${n}`))]);
    expect(readiness.ready).toBe(false);
    expect(readiness.headline).toBe('Not Ready');
    expect(readiness.subline).toBe('2 blockers · 4 warnings');
  });

  it('does not turn warnings or info into blockers', () => {
    const readiness = buildReadiness([issue('warning'), issue('info')]);
    expect(readiness.blockers).toBe(0);
    expect(readiness.infos).toBe(1);
  });

  it('lists blockers first, then warnings, then info', () => {
    const readiness = buildReadiness([issue('info', 'i'), issue('warning', 'w'), issue('blocker', 'b')]);
    expect(readiness.issues.map((item) => item.level)).toEqual(['blocker', 'warning', 'info']);
  });

  it('uses singular nouns and supports custom headlines', () => {
    expect(buildReadiness([issue('blocker')], { notReady: 'Not Ready' }).subline).toBe('1 blocker · 0 warnings');
    expect(buildReadiness([], { ready: 'Ready to Reveal' }).headline).toBe('Ready to Reveal');
  });
});

describe('domain adapters', () => {
  it('ACE: keeps the domain severity and points unassigned at the Unassigned filter', () => {
    const [unassigned, ambiguous] = aceIssues({
      issues: [
        { code: 'unassigned', severity: 'blocker', message: '5 unassigned Littles', draftIds: ['1', '2', '3', '4', '5'] },
        { code: 'ambiguous_match', severity: 'warning', message: '2 ambiguous member matches', draftIds: ['6', '7'] },
      ],
    } as never);
    expect(unassigned).toMatchObject({ level: 'blocker', count: 5, fix: { label: 'Review Unassigned', filter: 'unassigned' } });
    expect(unassigned.detail).toMatch(/must have a Big/);
    expect(ambiguous).toMatchObject({ level: 'warning', count: 2, fix: { filter: 'possible_match' } });
  });

  it('House: blockers stay blockers and warnings stay warnings', () => {
    const issues = houseIssues({
      blockers: [{ code: 'conflicting_house', message: 'Kevin is in two Houses', rowIds: ['a', 'b'] }],
      warnings: [{ code: 'imbalance', message: 'Toad has 5 more than Boo', rowIds: [] }],
    });
    expect(issues.map((item) => item.level)).toEqual(['blocker', 'warning']);
    expect(issues[0].fix?.filter).toBe('duplicates');
    expect(issues[1].fix).toBeUndefined();
  });

  it('Cabinet: a missing photo is a warning, never a blocker', () => {
    const issues = cabinetIssues({
      blockers: [],
      warnings: [{ code: 'missing_photos', message: '2 missing approved photos', draftIds: ['a', 'b'] }],
    });
    expect(buildReadiness(issues).ready).toBe(true);
    expect(issues[0]).toMatchObject({ level: 'warning', count: 2, fix: { filter: 'missing_photo' } });
  });

  it('Interns: optional gaps are info, and do not affect readiness', () => {
    const issues = internIssues({
      blockers: [],
      warnings: [{ code: 'unlinked', message: '3 unresolved', draftIds: ['a', 'b', 'c'] }],
      notes: [{ code: 'missing_mentor', message: '4 missing mentor (optional).', draftIds: ['a', 'b', 'c', 'd'] }],
    });
    expect(issues.map((item) => item.level)).toEqual(['warning', 'info']);
    expect(buildReadiness(issues).ready).toBe(true);
  });
});
