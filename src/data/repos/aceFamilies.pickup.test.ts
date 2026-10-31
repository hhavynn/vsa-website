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
    supabaseMock
      .queueResult('ace_member_pickup_evidence', { data: [], error: null })
      .queueResult('ace_member_pickup_evidence', {
        data: null,
        error: postgrestError('new row violates row-level security policy', '42501'),
      });
    await expect(aceFamiliesRepository.bulkCreateFamily(famFields, plan())).rejects.toBeTruthy();
    expect(supabaseMock.usedMethod('ace_families', 'delete')).toBe(true);
    expect(supabaseMock.filtersFor('ace_families')).toContainEqual(['id', 'fam-1']);
  });

  it('refuses before writing anything when the evidence table is not deployed yet', async () => {
    supabaseMock.setDefault('ace_member_pickup_evidence', {
      data: null,
      error: postgrestError("Could not find the table 'public.ace_member_pickup_evidence'", 'PGRST205'),
    });
    await expect(aceFamiliesRepository.bulkCreateFamily(famFields, plan())).rejects.toThrow(
      /pickup-year database update is not applied yet/,
    );
    expect(supabaseMock.queriesFor('ace_families')).toHaveLength(0);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
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


describe('reviewed ACE year correction and private evidence reader (#673)', () => {
  const input = {
    nodeId: 'fictional-node',
    expected: { academicYearStart: 2021, term: 'FA21' },
    next: { academicYearStart: 2023, term: 'FA23' },
    sourceKind: 'official_pairing' as const,
    evidenceId: 'fictional-evidence',
  };

  it('uses only the atomic compare-and-swap audit RPC and preserves caller expected values', async () => {
    const result = {
      ace_member_id: 'fictional-node', changed: true,
      previous: { academic_year_start: 2021, term: 'FA21' },
      current: { academic_year_start: 2023, term: 'FA23' },
    };
    supabaseMock.setDefault('rpc:correct_ace_member_pickup_year', { data: result, error: null });
    await expect(aceFamiliesRepository.correctPickupYear(input)).resolves.toEqual(result);
    expect(callArgs('rpc:correct_ace_member_pickup_year', 'rpc')).toEqual([{
      p_ace_member_id: 'fictional-node', p_expected_year: 2021, p_expected_term: 'FA21',
      p_academic_year_start: 2023, p_term: 'FA23', p_source_kind: 'official_pairing',
      p_evidence_id: 'fictional-evidence',
    }]);
    expect(supabaseMock.queriesFor('rpc:set_ace_member_pickup_year')).toHaveLength(0);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
    expect(supabaseMock.queriesFor('admin_activity_log')).toHaveLength(0);
  });

  it('refuses a stale review and leaves rollback to the server transaction', async () => {
    supabaseMock.setDefault('rpc:correct_ace_member_pickup_year', {
      data: null,
      error: postgrestError('Someone else changed this pickup year. Refresh and try again.', 'P0001'),
    });
    await expect(aceFamiliesRepository.correctPickupYear(input)).rejects.toThrow(
      /Someone else changed this pickup year/);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
  });

  it('sends explicit Unknown/null, not a guessed term or current year', async () => {
    supabaseMock.setDefault('rpc:correct_ace_member_pickup_year', {
      data: { ace_member_id: input.nodeId, changed: true }, error: null,
    });
    await aceFamiliesRepository.correctPickupYear({
      nodeId: input.nodeId, expected: input.next,
      next: { academicYearStart: null, term: null }, sourceKind: 'admin_entry',
    });
    expect(callArgs('rpc:correct_ace_member_pickup_year', 'rpc')).toEqual([{
      p_ace_member_id: input.nodeId, p_expected_year: 2023, p_expected_term: 'FA23',
      p_academic_year_start: null, p_term: null,
      p_source_kind: 'admin_entry', p_evidence_id: null,
    }]);
  });

  const row = (id: number) => ({
    id: 'fictional-evidence-' + id, ace_member_id: 'fictional-node',
    source_kind: 'official_pairing', source_label: 'synthetic source',
    raw_value: 'FA23', candidate_academic_year_start: 2023, candidate_term: 'FA23',
    review_status: 'pending', reviewed_at: null,
    review_note: 'PRIVATE SHOULD NEVER APPEAR', created_by: 'private-actor',
    ace_family_members: { family_id: 'fictional-fam' },
  });

  it('pages past 500 evidence rows with exact ID ordering and omits private notes', async () => {
    supabaseMock.queueResult('ace_member_pickup_evidence', {
      data: Array.from({ length: 500 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_member_pickup_evidence', {
      data: [row(500)], error: null,
    });
    const result = await aceFamiliesRepository.listPickupEvidenceForFamily('fictional-fam');
    expect(result).toHaveLength(501);
    expect(JSON.stringify(result)).not.toContain('PRIVATE SHOULD NEVER APPEAR');
    expect(JSON.stringify(result)).not.toContain('private-actor');
    expect(result[500]).not.toHaveProperty('ace_family_members');
    const qs = supabaseMock.queriesFor('ace_member_pickup_evidence');
    expect(qs).toHaveLength(2);
    expect(qs.flatMap((q) => q.calls).filter((c) => c.method === 'range')).toEqual([
      { method: 'range', args: [0, 499] }, { method: 'range', args: [500, 999] },
    ]);
    for (const q of qs) {
      const select = q.calls.find((c) => c.method === 'select')?.args[0];
      expect(String(select)).not.toContain('review_note');
      expect(String(select)).not.toContain('created_by');
      expect(q.calls).toContainEqual({ method: 'eq', args: ['ace_family_members.family_id', 'fictional-fam'] });
    }
  });

  it('fails the whole evidence read when a later page returns an error', async () => {
    supabaseMock.queueResult('ace_member_pickup_evidence', {
      data: Array.from({ length: 500 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_member_pickup_evidence', {
      data: null, error: postgrestError('synthetic denied second page', 'P0001'),
    });
    await expect(aceFamiliesRepository.listPickupEvidenceForFamily('fictional-fam'))
      .rejects.toThrow(/synthetic denied second page/);
  });
});
