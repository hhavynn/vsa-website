import type { ApplicationLink } from '../types';
import { buildRevealReadiness, RevealReadinessInput } from './houseRevealReadiness';

const NOW = Date.parse('2026-11-07T12:00:00Z');
const profiles = [
  { id: 'twilight', house_key: 'twilight', display_name: 'Twilight Sparkle', is_active: true },
  { id: 'rarity', house_key: 'rarity', display_name: 'Rarity', is_active: true },
];
const link = (overrides: Partial<ApplicationLink>): ApplicationLink => ({
  id: 'l1', application_key: 'house_fall', title: 'Fall House application', description: null, button_label: 'Apply',
  target_url: 'https://example.test/form', open_at: '2026-10-01T07:00:00Z', due_at: '2026-10-25T06:59:00Z', is_enabled: true,
  before_open_message: null, after_close_message: null, sort_order: 0, created_by: null, updated_by: null,
  created_at: '', updated_at: '', ...overrides,
} as ApplicationLink);

function input(overrides: Partial<RevealReadinessInput> = {}): RevealReadinessInput {
  return {
    batch: { academic_year_start: 2026, status: 'locked', assignment_method: 'timestamp_ranked', effective_start_date: '2026-11-08' },
    drafts: [
      { member_id: 'm1', match_status: 'match', house_profile_id: 'twilight' },
      { member_id: 'm2', match_status: 'manual', house_profile_id: 'rarity' },
    ],
    profiles,
    preflight: { blockers: [], warnings: [] },
    paymentBlockers: [],
    activeTermYear: 2026,
    parentCounts: new Map([['twilight', 2], ['rarity', 2]]),
    applicationLinks: [link({})],
    nowMs: NOW,
    ...overrides,
  };
}

describe('buildRevealReadiness', () => {
  it('is Ready when every check is complete', () => {
    const readiness = buildRevealReadiness(input());
    expect(readiness.overall).toBe('complete');
    expect(readiness.canReveal).toBe(true);
    expect(readiness.items.map((item) => [item.id, item.state])).toEqual([
      ['term', 'complete'], ['profiles', 'complete'], ['members', 'complete'], ['preflight', 'complete'], ['payment', 'complete'], ['applications', 'complete'],
    ]);
  });

  it('fails closed: any read that failed is Unknown and blocks the Reveal', () => {
    for (const missing of [{ activeTermYear: undefined }, { paymentBlockers: undefined }, { parentCounts: undefined }, { applicationLinks: undefined }]) {
      const readiness = buildRevealReadiness(input(missing));
      expect(readiness.overall).toBe('unknown');
      expect(readiness.canReveal).toBe(false);
    }
  });

  it('blocks on payment blockers, unlinked automatic rows, preflight blockers or inactive Houses, with the reason', () => {
    expect(buildRevealReadiness(input({ paymentBlockers: ['Payments changed since this sort.'] })).items.find((item) => item.id === 'payment'))
      .toMatchObject({ state: 'blocked', detail: 'Payments changed since this sort.' });
    const unlinked = buildRevealReadiness(input({ drafts: [{ member_id: null, match_status: 'unmatched', house_profile_id: 'twilight' }, { member_id: 'm9', match_status: 'review', house_profile_id: 'rarity' }] }));
    expect(unlinked.items.find((item) => item.id === 'members')).toMatchObject({ state: 'blocked', detail: '0 of 2 linked to a confirmed member, 1 need review, 1 unmatched.' });
    expect(buildRevealReadiness(input({ preflight: { blockers: [{ code: 'interval', message: 'Overlaps an existing membership.', rowIds: [] }], warnings: [] } })).canReveal).toBe(false);
    expect(buildRevealReadiness(input({ profiles: [{ ...profiles[0], is_active: false }, profiles[1]] })).items.find((item) => item.id === 'profiles')?.state).toBe('blocked');
  });

  it('flags, without blocking, a wrong active year, an open application window and Houses with no Parents', () => {
    const readiness = buildRevealReadiness(input({
      activeTermYear: 2025,
      applicationLinks: [link({ due_at: '2026-11-10T07:59:00Z' })],
      parentCounts: new Map([['twilight', 2]]),
    }));
    expect(readiness.overall).toBe('needs_review');
    expect(readiness.canReveal).toBe(true);
    expect(readiness.items.filter((item) => item.state === 'needs_review').map((item) => item.id)).toEqual(['term', 'profiles', 'applications']);
    expect(readiness.items.find((item) => item.id === 'applications')?.detail).toMatch(/still open/);
  });

  it('treats a manual batch\'s unlinked rows as review (they are skipped at Reveal), and a non-gated batch as complete', () => {
    const readiness = buildRevealReadiness(input({
      batch: { academic_year_start: 2026, status: 'locked', assignment_method: 'manual', effective_start_date: '2026-11-08' },
      drafts: [{ member_id: null, match_status: 'unmatched', house_profile_id: 'twilight' }, { member_id: 'm2', match_status: 'match', house_profile_id: 'rarity' }],
      paymentBlockers: null,
    }));
    expect(readiness.items.find((item) => item.id === 'members')).toMatchObject({ state: 'needs_review' });
    expect(readiness.items.find((item) => item.id === 'payment')).toMatchObject({ state: 'complete' });
  });

  it('never calls an automatic batch payment-cleared when the check cannot run, and ignores unlinked rows for inactive Houses', () => {
    expect(buildRevealReadiness(input({ paymentBlockers: null })).items.find((item) => item.id === 'payment')?.state).toBe('needs_review');
    const readiness = buildRevealReadiness(input({
      batch: { academic_year_start: 2026, status: 'locked', assignment_method: 'manual', effective_start_date: '2026-11-08' },
      profiles: [{ ...profiles[0], is_active: false }, profiles[1]],
      drafts: [{ member_id: null, match_status: 'unmatched', house_profile_id: 'twilight' }, { member_id: 'm2', match_status: 'match', house_profile_id: 'rarity' }],
      paymentBlockers: null,
    }));
    expect(readiness.items.find((item) => item.id === 'profiles')?.state).not.toBe('blocked');
  });
});
