import type { DraftSeed } from './aceAssignments';
import { planAceDraftImport } from './aceDraftImportPlan';

const seed = (name: string, memberId: string | null = null): DraftSeed => ({
  little_name: name,
  little_member_id: memberId,
  big_ace_member_id: null,
  notes: null,
});
const existing = (name: string, memberId: string | null = null) => ({
  little_name: name,
  little_member_id: memberId,
});

describe('planAceDraftImport', () => {
  it('skips a previously imported mutual Little and retains other general applicants', () => {
    const plan = planAceDraftImport(
      [seed('  An  Nguyen '), seed('Mina Tran', 'member-mina')],
      [existing('ÁN NGUYEN')],
    );
    expect(plan).toEqual({
      seeds: [seed('Mina Tran', 'member-mina')],
      skippedExisting: 1,
      skippedRepeated: 0,
      needsReview: 0,
    });
  });

  it('does not create a second draft for the same canonical member under a preferred name', () => {
    expect(planAceDraftImport([seed('Mimi Tran', 'member-mina')], [existing('Mina Tran', 'member-mina')])).toEqual({
      seeds: [],
      skippedExisting: 1,
      skippedRepeated: 0,
      needsReview: 0,
    });
  });

  it('holds a same-name collision with a different linked member for human review', () => {
    const plan = planAceDraftImport(
      [seed('An Nguyen', 'member-two'), seed('Taro Cho', 'member-taro')],
      [existing('An Nguyen', 'member-one')],
    );
    expect(plan.seeds).toEqual([seed('Taro Cho', 'member-taro')]);
    expect(plan.needsReview).toBe(1);
    expect(plan.skippedExisting).toBe(0);
  });

  it('holds a linked applicant whose name matches an unlinked draft', () => {
    const plan = planAceDraftImport([seed('An Nguyen', 'member-two')], [existing('An Nguyen')]);
    expect(plan).toEqual({ seeds: [], skippedExisting: 0, skippedRepeated: 0, needsReview: 1 });

    const twoPeople = planAceDraftImport(
      [seed('Ari Lee', 'm1'), seed('Ari Lee', 'm2')],
      [existing('Ari Lee')],
    );
    expect(twoPeople).toEqual({ seeds: [], skippedExisting: 0, skippedRepeated: 0, needsReview: 2 });
  });

  it('deduplicates repeated rows only when their canonical member identity agrees', () => {
    const plan = planAceDraftImport([seed('Ari Lee', 'm1'), seed('ARI LEE', 'm1')], []);
    expect(plan.seeds).toEqual([seed('Ari Lee', 'm1')]);
    expect(plan.skippedRepeated).toBe(1);
    expect(plan.needsReview).toBe(0);
  });

  it('holds all same-name rows when identities disagree or remain unknown', () => {
    for (const ids of [['m1', 'm2'], [null, null], ['m1', null]] as Array<Array<string | null>>) {
      const plan = planAceDraftImport([seed('Ari Lee', ids[0]), seed('Ari Lee', ids[1])], []);
      expect(plan.seeds).toEqual([]);
      expect(plan.needsReview).toBe(2);
    }
  });

  it('holds a repeated canonical member used with two different names', () => {
    const plan = planAceDraftImport([seed('Ari Lee', 'm1'), seed('Ari L.', 'm1')], []);
    expect(plan.seeds).toEqual([]);
    expect(plan.needsReview).toBe(2);
  });

  it('does not import blank Little names', () => {
    const plan = planAceDraftImport([seed('   '), seed('Valid Name')], []);
    expect(plan.seeds).toEqual([seed('Valid Name')]);
    expect(plan.needsReview).toBe(1);
  });

  it('allows repeated imports to be idempotent, including empty input', () => {
    expect(planAceDraftImport([], [])).toEqual({ seeds: [], skippedExisting: 0, skippedRepeated: 0, needsReview: 0 });
    const prior = [existing('Mina Tran', 'm1'), existing('Ari Lee')];
    expect(planAceDraftImport([seed('Mina Tran', 'm1'), seed('ARI LEE')], prior)).toEqual({
      seeds: [], skippedExisting: 2, skippedRepeated: 0, needsReview: 0,
    });
  });
});
