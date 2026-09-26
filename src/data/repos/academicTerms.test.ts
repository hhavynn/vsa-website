import { academicTermsRepository } from './academicTerms';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const WI27 = {
  id: 'wi27',
  code: 'WI27',
  label: 'Winter 2027',
  quarter: 'winter',
  academic_year_start: 2026,
  academic_year_end: 2027,
  starts_on: '2027-01-04',
  ends_on: '2027-03-20',
  is_active: false,
  display_order: 20262,
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

describe('academicTermsRepository.ensureTermForDate', () => {
  beforeEach(() => supabaseMock.reset());

  it('returns an existing term without overwriting its admin-set dates', async () => {
    supabaseMock.queueResult('academic_terms', { data: WI27, error: null });

    const term = await academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z');

    expect(term).toEqual(WI27);
    expect(supabaseMock.usedMethod('academic_terms', 'upsert')).toBe(false);
  });

  it('creates the term with default dates when it does not exist yet', async () => {
    supabaseMock
      .queueResult('academic_terms', { data: null, error: null })
      .queueResult('academic_terms', { data: { ...WI27, starts_on: '2027-01-01', ends_on: '2027-03-31' }, error: null });

    const term = await academicTermsRepository.ensureTermForDate('2027-02-10T19:00:00Z');

    expect(term?.code).toBe('WI27');
    expect(supabaseMock.usedMethod('academic_terms', 'upsert')).toBe(true);
  });
});
