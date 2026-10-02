import { planStructureCopy } from './adminStructureCopy';

const source = [
  { role: 'President', category: 'Executive Board', display_order: 0 },
  { role: 'Treasurer', category: 'Executive Board', display_order: 1 },
  { role: 'Webmaster', category: 'General Board', display_order: 0 },
  { role: 'Interns', category: 'Interns', display_order: 0 },
];

describe('planStructureCopy', () => {
  it('copies roles, boards and order into an empty roster', () => {
    const plan = planStructureCopy([], source);
    expect(plan.inserts).toEqual([
      { role: 'President', category: 'Executive Board', display_order: 0 },
      { role: 'Treasurer', category: 'Executive Board', display_order: 1 },
      { role: 'Webmaster', category: 'General Board', display_order: 0 },
    ]);
  });

  it('copies no people: inserts carry only role, category and display_order', () => {
    const [first] = planStructureCopy([], [{ ...source[0], name: 'Ada', member_id: 'm1', fun_fact: 'x' } as never]).inserts;
    expect(Object.keys(first).sort()).toEqual(['category', 'display_order', 'role']);
  });

  it('is idempotent: positions already on the roster are not added again', () => {
    const existing = [{ role: 'president', category: 'Executive Board', display_order: 0 }];
    const plan = planStructureCopy(existing, source);
    expect(plan.inserts.map((row) => row.role)).toEqual(['Treasurer', 'Webmaster']);
    expect(plan.alreadyPresent).toBe(1);
    expect(plan.inserts.every((row) => (row.display_order ?? 0) >= 1)).toBe(true);
  });

  it('never imports the Interns group (managed by its own cohort)', () => {
    expect(planStructureCopy([], source).inserts.some((row) => row.category === 'Interns')).toBe(false);
  });
});
