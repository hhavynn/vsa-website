/**
 * The dashboard's Events section must count an upcoming published event as
 * missing info whether a field is NULL or an empty string; a NULL check-in
 * form URL previously slipped through and made the preflight say all was well.
 */
import { adminOperationsRepository } from './adminOperations';
import { academicTermsRepository } from './academicTerms';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./academicTerms', () => ({ academicTermsRepository: { getActiveTerm: jest.fn() } }));

beforeEach(() => {
  supabaseMock.reset();
  (academicTermsRepository.getActiveTerm as jest.Mock).mockResolvedValue(null);
});

function orFilters() {
  return supabaseMock
    .queriesFor('events')
    .flatMap((query) => query.calls)
    .filter((call) => call.method === 'or')
    .map((call) => String(call.args[0]));
}

describe('events health', () => {
  beforeEach(() => {
    supabaseMock.queueResult('events', { data: [{ name: 'GBM', date: '2026-10-10T01:00:00Z' }], error: null });
    supabaseMock.queueResult('events', { data: null, error: null });
  });

  it('treats a NULL or empty check-in form URL as missing, alongside location and image', async () => {
    const inputs = await adminOperationsRepository.loadInputs();
    expect(inputs.events).not.toBeNull();

    const missingInfo = orFilters().find((filter) => filter.includes('check_in_form_url'));
    expect(missingInfo).toBeDefined();
    expect(missingInfo).toContain('check_in_form_url.is.null');
    expect(missingInfo).toContain('check_in_form_url.eq.""');
    expect(missingInfo).toContain('location.is.null');
    expect(missingInfo).toContain('image_url.is.null');
  });

  it('only counts published events', async () => {
    await adminOperationsRepository.loadInputs();
    const eventQueries = supabaseMock.queriesFor('events');
    eventQueries.forEach((query) => expect(query.calls).toContainEqual({ method: 'eq', args: ['is_published', true] }));
  });
});
