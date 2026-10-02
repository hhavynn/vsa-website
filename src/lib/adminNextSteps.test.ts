import { nextStepFor } from './adminNextSteps';

describe('nextStepFor', () => {
  it('after an ACE import with problems, offers to review the issues', () => {
    const step = nextStepFor({ type: 'ace_imported', count: 47, issues: 5 });
    expect(step.message).toBe('47 Littles imported');
    expect(step.actions).toEqual([{ label: 'Review 5 Issues', filter: 'needs_review' }]);
  });

  it('after a clean ACE import, offers the preflight', () => {
    expect(nextStepFor({ type: 'ace_imported', count: 1, issues: 0 }).actions[0].label).toBe('Open Assignment Preflight');
    expect(nextStepFor({ type: 'ace_imported', count: 1, issues: 1 }).actions[0].label).toBe('Review 1 Issue');
  });

  it('after linking everyone, opens the assignment preflight', () => {
    expect(nextStepFor({ type: 'ace_all_linked' })).toMatchObject({
      message: 'All current members linked',
      actions: [{ label: 'Open Assignment Preflight', to: '/admin/ace?view=assignments' }],
    });
  });

  it('after locking Houses, offers a preview — never a publish', () => {
    const step = nextStepFor({ type: 'house_locked' });
    expect(step.message).toBe('Assignments locked');
    expect(step.actions).toEqual([{ label: 'Preview Reveal', intent: 'preview' }]);
  });

  it('after a complete roster, offers to preview the Cabinet', () => {
    expect(nextStepFor({ type: 'cabinet_roster_complete' }).actions[0]).toEqual({ label: 'Preview Cabinet', intent: 'preview' });
  });

  it('after year setup, opens the Operations dashboard', () => {
    expect(nextStepFor({ type: 'year_prepared', yearStart: 2027 })).toMatchObject({
      message: '2027–28 prepared',
      actions: [{ label: 'Open Operations Dashboard', to: '/admin' }],
    });
  });

  it('every step has at least one action (no dead ends)', () => {
    const events = [
      { type: 'ace_imported', count: 1, issues: 0 },
      { type: 'ace_all_linked' },
      { type: 'ace_locked' },
      { type: 'house_imported', count: 1, issues: 0 },
      { type: 'house_locked' },
      { type: 'cabinet_roster_complete' },
      { type: 'cabinet_published' },
      { type: 'intern_locked' },
      { type: 'year_prepared', yearStart: 2027 },
    ] as const;
    for (const event of events) expect(nextStepFor(event).actions.length).toBeGreaterThan(0);
  });
});
