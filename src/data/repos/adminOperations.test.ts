/**
 * The dashboard's Events section must count an upcoming published event as
 * missing info whether a field is NULL or an empty string; a NULL check-in
 * form URL previously slipped through and made the preflight say all was well.
 * It must also do so with ONE read of the events table (it used to issue four
 * requests, three of them count probes over the same filter).
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

const complete = { location: 'PC East', check_in_form_url: 'https://forms.gle/x', image_url: '/images/events/a.jpg' };

describe('events health', () => {
  it('treats a NULL or empty location, check-in form URL, or image as missing info', async () => {
    supabaseMock.queueResult('events', {
      data: [
        { name: 'GBM', date: '2026-10-10T01:00:00Z', ...complete },
        { name: 'Null check-in', date: '2026-10-11T01:00:00Z', ...complete, check_in_form_url: null },
        { name: 'Empty check-in', date: '2026-10-12T01:00:00Z', ...complete, check_in_form_url: '' },
        { name: 'No image', date: '2026-10-13T01:00:00Z', ...complete, image_url: null },
        { name: 'Null location', date: '2026-10-14T01:00:00Z', ...complete, location: null },
        { name: 'Empty location', date: '2026-10-15T01:00:00Z', ...complete, location: '' },
      ],
      error: null,
    });

    const inputs = await adminOperationsRepository.loadInputs();

    expect(inputs.events).toEqual({
      next: { title: 'GBM', date: '2026-10-10T01:00:00Z' },
      upcoming: 6,
      upcomingMissingLocation: 2,
      upcomingMissingInfo: 5,
    });
  });

  it('reports no next event when none are upcoming', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });
    const inputs = await adminOperationsRepository.loadInputs();
    expect(inputs.events).toEqual({ next: null, upcoming: 0, upcomingMissingLocation: 0, upcomingMissingInfo: 0 });
  });

  it('reads only published events, in a single request', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });
    await adminOperationsRepository.loadInputs();

    const eventQueries = supabaseMock.queriesFor('events');
    expect(eventQueries).toHaveLength(1);
    expect(eventQueries[0].calls).toContainEqual({ method: 'eq', args: ['is_published', true] });
    expect(eventQueries[0].calls.some((call) => call.method === 'select' && JSON.stringify(call.args).includes('head'))).toBe(false);
  });

  it('shows the section as unavailable instead of zero when the read fails', async () => {
    supabaseMock.queueResult('events', { data: null, error: { message: 'boom' } });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const inputs = await adminOperationsRepository.loadInputs();
      expect(inputs.events).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });
});
