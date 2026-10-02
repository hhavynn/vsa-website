import type { CabinetRosterDraft } from './cabinetRoster';
import type { InternCohortDraft } from './internCohort';
import { internDraftsToPreviewMembers, rosterDraftsToPreviewMembers } from './adminPreviewMappers';

const roster = (id: string, patch: Partial<CabinetRosterDraft>): CabinetRosterDraft =>
  ({ id, cycle_id: 'c', role: 'Treasurer', category: 'Executive Board', display_order: 0, name: null, member_id: null, year: null, college: null, major: null, pronouns: null, favorite_snack: null, fun_fact: null, created_at: '', updated_at: '', ...patch }) as CabinetRosterDraft;

const intern = (id: string, patch: Partial<InternCohortDraft>): InternCohortDraft =>
  ({ id, cycle_id: 'c', name: id, member_id: null, mentor_cabinet_member_id: 'mentor-secret', role_or_track: null, caption: 'private bio', internal_notes: 'private note', display_order: 0, published_cabinet_member_id: null, created_at: '', updated_at: '', ...patch }) as InternCohortDraft;

describe('rosterDraftsToPreviewMembers', () => {
  it('previews only filled positions, as the public board would show them', () => {
    const members = rosterDraftsToPreviewMembers([roster('a', { name: 'Ada', member_id: 'm1', year: 'Third' }), roster('b', {})], 'cy1');
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ name: 'Ada', role: 'Treasurer', category: 'Executive Board', year: 'Third', member_id: 'm1', cabinet_year_id: 'cy1' });
  });

  it('never carries images (publish never writes them) and gives previews synthetic ids', () => {
    const [member] = rosterDraftsToPreviewMembers([roster('a', { name: 'Ada' })], 'cy1');
    expect(member.image_url).toBeNull();
    expect(member.thumbnail_url).toBeNull();
    expect(member.id).toBe('preview-a');
  });

  it('orders by display order, then name', () => {
    const names = rosterDraftsToPreviewMembers([roster('a', { name: 'Zed', display_order: 1 }), roster('b', { name: 'Amy', display_order: 1 }), roster('c', { name: 'Mo', display_order: 0 })], 'cy1').map((m) => m.name);
    expect(names).toEqual(['Mo', 'Amy', 'Zed']);
  });
});

describe('internDraftsToPreviewMembers', () => {
  it('uses the Interns board and the default role, exposing no mentor, caption, or notes', () => {
    const [member] = internDraftsToPreviewMembers([intern('Sam', {})], 'cy1');
    expect(member).toMatchObject({ name: 'Sam', role: 'Intern', category: 'Interns' });
    expect(JSON.stringify(member)).not.toContain('mentor-secret');
    expect(JSON.stringify(member)).not.toContain('private');
  });

  it('keeps a chosen track as the role', () => {
    expect(internDraftsToPreviewMembers([intern('Sam', { role_or_track: 'Media' })], 'cy1')[0].role).toBe('Media');
  });
});
