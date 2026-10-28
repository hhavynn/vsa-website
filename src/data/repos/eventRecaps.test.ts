import { eventRecapsRepository, type EventRecapFormData } from './eventRecaps';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const input: EventRecapFormData = {
  owner_names: '  Board Team  ',
  cabinet_roles: null,
  attendance_notes: '   ',
  what_worked: '  Participants liked the workshop  ',
  what_failed: null,
  next_time_improvements: null,
  budget_notes: null,
  aftersocial_notes: null,
  risks_issues: null,
  drive_folder_url: null,
  planning_doc_url: null,
  gallery_event_id: null,
  public_highlight: '  A community workshop  ',
  is_public_highlight_published: false,
};

beforeEach(() => supabaseMock.reset());

describe('eventRecapsRepository boundary characterization (#291)', () => {
  it('reads only the requested event and distinguishes missing data from errors', async () => {
    supabaseMock.queueResult('event_recaps', { data: { id: 'recap-1' }, error: null });
    await expect(eventRecapsRepository.getRecapForEvent('event-1')).resolves.toEqual({ id: 'recap-1' });
    expect(supabaseMock.filtersFor('event_recaps')).toContainEqual(['event_id', 'event-1']);
    supabaseMock.queueResult('event_recaps', { data: null, error: null });
    await expect(eventRecapsRepository.getRecapForEvent('absent')).resolves.toBeNull();

    supabaseMock.queueResult('event_recaps', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(eventRecapsRepository.getRecapForEvent('private')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('does not query the database for an empty event-id batch', async () => {
    await expect(eventRecapsRepository.getRecapEventIds([])).resolves.toEqual([]);
    expect(supabaseMock.queriesFor('event_recaps')).toHaveLength(0);
  });

  it('returns only populated recap IDs and filters queries by the requested IDs', async () => {
    supabaseMock.queueResult('event_recaps', {
      data: [{ event_id: 'event-1' }, { event_id: null }, { event_id: 'event-2' }],
      error: null,
    });
    await expect(eventRecapsRepository.getRecapEventIds(['event-1', 'event-2'])).resolves.toEqual([
      'event-1', 'event-2',
    ]);
    expect(supabaseMock.queriesFor('event_recaps')[0].calls).toContainEqual({
      method: 'in', args: ['event_id', ['event-1', 'event-2']],
    });
  });

  it('preserves unpublished highlights and trims private recap text when creating', async () => {
    supabaseMock.queueResult('event_recaps', { data: { id: 'recap-1' }, error: null });
    await eventRecapsRepository.saveRecapForEvent('event-1', input, 'admin-1');
    const insert = supabaseMock.queriesFor('event_recaps')[0].calls.find(c => c.method === 'insert')?.args[0];
    expect(insert).toEqual(expect.objectContaining({
      event_id: 'event-1',
      created_by: 'admin-1',
      updated_by: 'admin-1',
      owner_names: 'Board Team',
      attendance_notes: null,
      what_worked: 'Participants liked the workshop',
      public_highlight: 'A community workshop',
      is_public_highlight_published: false,
    }));
  });

  it('updates by the recap ID, not by event ID, and preserves publication state', async () => {
    supabaseMock.queueResult('event_recaps', { data: { id: 'recap-1' }, error: null });
    await eventRecapsRepository.saveRecapForEvent('event-1', input, 'admin-1', 'recap-1');
    expect(supabaseMock.filtersFor('event_recaps')).toContainEqual(['id', 'recap-1']);
    const patch = supabaseMock.queriesFor('event_recaps')[0].calls.find(c => c.method === 'update')?.args[0];
    expect(patch).toEqual(expect.objectContaining({
      updated_by: 'admin-1', updated_at: expect.any(String),
      is_public_highlight_published: false,
    }));
  });

  it('throws for an empty successful write rather than inventing a saved recap', async () => {
    supabaseMock.queueResult('event_recaps', { data: null, error: null });
    await expect(eventRecapsRepository.saveRecapForEvent('event-1', input, 'admin-1')).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Failed to create event recap',
    });
  });
});
