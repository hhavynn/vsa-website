/**
 * Repository tests for current-year House membership reads.
 *
 * The interval filtering is enforced by PostgREST, so what matters here is
 * that the query actually carries those constraints — the recording mock makes
 * that assertable rather than a matter of reading the source and hoping.
 */
import { houseMembershipsRepository } from './houseMemberships';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const TODAY = '2026-09-25';
const YEAR = 2026;

beforeEach(() => {
  supabaseMock.reset();
});

describe('HouseMembershipsRepository — only the membership in effect today', () => {
  // Admin -> Houses handles a reassignment by closing the open interval and
  // inserting a replacement, and may insert one that starts in the future. A
  // member can therefore hold several rows for a single academic year, so
  // filtering by year alone can surface a House they have been moved out of.
  it('constrains the query to the academic year and the effective interval', async () => {
    await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    const calls = supabaseMock.queriesFor('house_memberships')[0].calls;

    expect(calls).toContainEqual({ method: 'eq', args: ['academic_year_start', YEAR] });
    expect(calls).toContainEqual({ method: 'lte', args: ['effective_start_date', TODAY] });
    expect(calls).toContainEqual({
      method: 'or',
      args: [`effective_end_date.is.null,effective_end_date.gt.${TODAY}`],
    });
  });

  it('maps each member to their House display name', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: [
        { member_id: 'm1', house_page_assets: { display_name: 'Bowser', house_key: 'bowser' } },
        { member_id: 'm2', house_page_assets: { display_name: 'Toad', house_key: 'toad' } },
      ],
      error: null,
    });

    const labels = await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    expect(labels.get('m1')).toBe('Bowser');
    expect(labels.get('m2')).toBe('Toad');
  });

  it('falls back to house_key when the profile has no display name', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: [{ member_id: 'm1', house_page_assets: { display_name: null, house_key: 'boo' } }],
      error: null,
    });

    const labels = await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    expect(labels.get('m1')).toBe('boo');
  });

  it('accepts an array-shaped embed', async () => {
    // database.ts carries no Relationships blocks, so embed cardinality cannot
    // be inferred from the generated types. A shape change must not silently
    // render everyone unassigned.
    supabaseMock.queueResult('house_memberships', {
      data: [{ member_id: 'm1', house_page_assets: [{ display_name: 'Donkey Kong' }] }],
      error: null,
    });

    const labels = await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    expect(labels.get('m1')).toBe('Donkey Kong');
  });

  it('omits members with no membership in effect', async () => {
    supabaseMock.queueResult('house_memberships', { data: [], error: null });

    const labels = await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    expect(labels.size).toBe(0);
  });

  it('skips a row whose House profile resolves to nothing', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: [{ member_id: 'm1', house_page_assets: null }],
      error: null,
    });

    const labels = await houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY);

    expect(labels.has('m1')).toBe(false);
  });

  it('throws rather than returning an empty map when the lookup fails', async () => {
    // Failing open here would mark every member Unassigned, which for House
    // data is indistinguishable from the correct pre-House-Reveal state.
    supabaseMock.queueResult('house_memberships', {
      data: null,
      error: postgrestError('permission denied for table house_memberships', '42501'),
    });

    await expect(
      houseMembershipsRepository.getHouseLabelsByMemberId(YEAR, TODAY),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
