import { webcrypto } from 'crypto';
import { aceFamiliesRepository } from './aceFamilies';
import { buildImportPlan } from '../../lib/aceFamilyImport';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

// jsdom has no crypto.randomUUID; the importer uses it for member ids.
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_families', { data: { id: 'fam-1', name: 'Synthetic' }, error: null });
});

const famFields = { theme_color: null, cover_image_url: null, display_order: 0, is_published: true };

const plan = () =>
  buildImportPlan({
    family: 'Synthetic',
    members: [
      { name: 'Root', big: null, added_term: 'legacy', confidence: 'confirmed', littles: ['Kid', 'Implicit'] },
      { name: 'Kid', big: 'Root', added_term: 'FA23', confidence: 'inferred-high' },
      { name: 'Undated', big: 'Root', added_term: '' },
    ],
  });

const callArgs = (table: string, method: string) =>
  supabaseMock
    .queriesFor(table)
    .flatMap((query) => query.calls.filter((call) => call.method === method).map((call) => call.args[0]));

describe('bulkCreateFamily pickup evidence', () => {
  it('stores added_term as pending evidence and never as an approved year', async () => {
    const p = plan();
    await aceFamiliesRepository.bulkCreateFamily(famFields, p);

    const [memberRows] = callArgs('ace_family_members', 'insert') as Record<string, unknown>[][];
    expect(memberRows).toHaveLength(4);
    for (const row of memberRows) {
      expect(row).not.toHaveProperty('pickup_academic_year_start');
      expect(row).not.toHaveProperty('pickup_term');
    }
    for (const update of callArgs('ace_family_members', 'update') as Record<string, unknown>[]) {
      expect(Object.keys(update).sort()).toEqual(['parent_member_id', 'updated_at']);
    }

    const [evidence] = callArgs('ace_member_pickup_evidence', 'insert') as Record<string, unknown>[][];
    const idOf = (name: string) => p.people.find((person) => person.name === name)!.id;
    expect(evidence).toEqual([
      {
        ace_member_id: idOf('Root'),
        source_kind: 'import_json',
        source_label: 'JSON import: Synthetic',
        raw_value: 'legacy',
        candidate_academic_year_start: null,
        candidate_term: null,
        source_confidence: 'confirmed',
        review_status: 'pending',
      },
      {
        ace_member_id: idOf('Kid'),
        source_kind: 'import_json',
        source_label: 'JSON import: Synthetic',
        raw_value: 'FA23',
        candidate_academic_year_start: 2023,
        candidate_term: 'FA23',
        source_confidence: 'inferred-high',
        review_status: 'pending',
      },
    ]);
    expect(supabaseMock.queriesFor('rpc:set_ace_member_pickup_year')).toHaveLength(0);
  });

  it('skips the evidence insert when the source has no terms', async () => {
    await aceFamiliesRepository.bulkCreateFamily(
      famFields,
      buildImportPlan({ family: 'Synthetic', members: [{ name: 'Solo', big: null }] }),
    );
    expect(supabaseMock.queriesFor('ace_member_pickup_evidence')).toHaveLength(0);
  });

  it('removes the half-imported fam when evidence cannot be saved', async () => {
    supabaseMock.setDefault('ace_member_pickup_evidence', {
      data: null,
      error: postgrestError('permission denied for table ace_member_pickup_evidence', '42501'),
    });
    await expect(aceFamiliesRepository.bulkCreateFamily(famFields, plan())).rejects.toBeTruthy();
    expect(supabaseMock.usedMethod('ace_families', 'delete')).toBe(true);
    expect(supabaseMock.filtersFor('ace_families')).toContainEqual(['id', 'fam-1']);
  });
});

describe('setPickupYear', () => {
  it('goes through the review RPC with exactly the given values', async () => {
    const change = {
      ace_member_id: 'node-1',
      changed: true,
      previous: { academic_year_start: null, term: null },
      current: { academic_year_start: 2023, term: 'SP24' },
    };
    supabaseMock.setDefault('rpc:set_ace_member_pickup_year', { data: change, error: null });

    await expect(aceFamiliesRepository.setPickupYear('node-1', 2023, 'SP24', 'ev-1')).resolves.toEqual(change);
    expect(callArgs('rpc:set_ace_member_pickup_year', 'rpc')).toEqual([
      { p_ace_member_id: 'node-1', p_academic_year_start: 2023, p_term: 'SP24', p_evidence_id: 'ev-1' },
    ]);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
  });

  it('defaults to a year-only value with no evidence', async () => {
    supabaseMock.setDefault('rpc:set_ace_member_pickup_year', { data: {}, error: null });
    await aceFamiliesRepository.setPickupYear('node-1', 2021);
    expect(callArgs('rpc:set_ace_member_pickup_year', 'rpc')).toEqual([
      { p_ace_member_id: 'node-1', p_academic_year_start: 2021, p_term: null, p_evidence_id: null },
    ]);
  });

  it('surfaces a refusal instead of pretending it saved', async () => {
    supabaseMock.setDefault('rpc:set_ace_member_pickup_year', {
      data: null,
      error: postgrestError('Only admins can set ACE pickup years.', '42501'),
    });
    await expect(aceFamiliesRepository.setPickupYear('node-1', 2023, 'FA23')).rejects.toBeTruthy();
  });
});
