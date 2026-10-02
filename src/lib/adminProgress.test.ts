import {
  aceProgress,
  cabinetProgress,
  countStep,
  firstUnfinishedStep,
  houseProgress,
  internProgress,
  preflightStep,
  stepMark,
} from './adminProgress';

describe('countStep / stepMark', () => {
  it('shows a count while unfinished and a check when complete', () => {
    expect(stepMark(countStep('a', 'Assignments', 42, 47))).toBe('42 / 47');
    const complete = countStep('a', 'Assignments', 47, 47);
    expect(complete.status).toBe('done');
    expect(stepMark(complete)).toBe('47 / 47');
  });

  it('is todo with an em dash when there is nothing to count', () => {
    const empty = countStep('a', 'Assignments', 0, 0);
    expect(empty.status).toBe('todo');
    expect(stepMark(empty)).toBe('—');
  });
});

describe('preflightStep', () => {
  it('is warning with outstanding issues, done when clean, todo without data', () => {
    expect(preflightStep({ hasData: true, blockers: 0, warnings: 2 }).status).toBe('warning');
    expect(stepMark(preflightStep({ hasData: true, blockers: 1, warnings: 0 }))).toBe('⚠');
    expect(preflightStep({ hasData: true, blockers: 0, warnings: 0 }).status).toBe('done');
    expect(stepMark(preflightStep({ hasData: false, blockers: 0, warnings: 0 }))).toBe('—');
  });
});

describe('ACE progress', () => {
  it('matches the header an admin returns to', () => {
    const steps = aceProgress({ status: 'draft', littles: 47, assigned: 42, linked: 47, blockers: 0, warnings: 3 });
    expect(steps.map((step) => `${step.label} ${stepMark(step)}`)).toEqual([
      'Import ✓',
      'Linking 47 / 47',
      'Assignments 42 / 47',
      'Preflight ⚠',
      'Locked —',
      'Published —',
    ]);
  });

  it('marks locked and published from the cycle status', () => {
    const locked = aceProgress({ status: 'locked', littles: 1, assigned: 1, linked: 1, blockers: 0, warnings: 0 });
    expect(locked.find((step) => step.key === 'locked')?.status).toBe('done');
    expect(locked.find((step) => step.key === 'published')?.status).toBe('todo');
    const published = aceProgress({ status: 'published', littles: 1, assigned: 1, linked: 1, blockers: 0, warnings: 0 });
    expect(published.find((step) => step.key === 'published')?.status).toBe('done');
  });
});

describe('House / Cabinet / Intern progress', () => {
  it('House counts matched and assigned rows', () => {
    const steps = houseProgress({ status: 'draft', rows: 129, matched: 129, assigned: 126 });
    expect(steps.find((step) => step.key === 'assignments')?.value).toBe('126 / 129');
    expect(steps.find((step) => step.key === 'revealed')?.status).toBe('todo');
  });

  it('Cabinet links are counted against filled people, not all positions', () => {
    const steps = cabinetProgress({ status: 'draft', positions: 19, filled: 18, linked: 17 });
    expect(steps.find((step) => step.key === 'people')?.value).toBe('18 / 19');
    expect(steps.find((step) => step.key === 'links')?.value).toBe('17 / 18');
  });

  it('Interns track links and mentors against the cohort', () => {
    const steps = internProgress({ status: 'draft', accepted: 12, linked: 12, mentored: 4 });
    expect(steps.find((step) => step.key === 'links')?.status).toBe('done');
    expect(steps.find((step) => step.key === 'mentors')?.value).toBe('4 / 12');
  });
});

describe('firstUnfinishedStep', () => {
  it('finds where work stopped', () => {
    const steps = aceProgress({ status: 'draft', littles: 47, assigned: 42, linked: 47, blockers: 0, warnings: 0 });
    expect(firstUnfinishedStep(steps)?.key).toBe('assignments');
  });

  it('is null when every step is finished', () => {
    const steps = cabinetProgress({ status: 'published', positions: 2, filled: 2, linked: 2 });
    expect(firstUnfinishedStep(steps)).toBeNull();
  });

  it('does not let a warning hide a later unfinished step', () => {
    const steps = aceProgress({ status: 'draft', littles: 2, assigned: 2, linked: 2, blockers: 0, warnings: 1 });
    expect(firstUnfinishedStep(steps)?.key).toBe('locked');
  });
});
