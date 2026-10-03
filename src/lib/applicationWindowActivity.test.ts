import { ACTIVITY_ACTIONS, sanitizeMetadata } from './adminActivity';
import { WindowSnapshot, applicationWindowActivity } from './applicationWindowActivity';

const NOW = new Date('2026-10-01T16:00:00Z');
const SECRET_URL = 'https://forms.gle/very-private-form';

function snapshot(overrides: Partial<WindowSnapshot> = {}): WindowSnapshot {
  return {
    application_key: 'house_fall',
    title: 'House Application — Fall',
    open_at: '2026-10-05T07:00:00Z',
    due_at: '2026-10-09T06:59:00Z',
    is_enabled: true,
    target_url: SECRET_URL,
    ...overrides,
  };
}

describe('application window activity (Recent Changes entries)', () => {
  it('records the key, previous and new state, schedule, and never the form URL', () => {
    const before = snapshot({ is_enabled: false });
    const after = snapshot({ open_at: '2026-09-25T07:00:00Z', is_enabled: true });
    const draft = applicationWindowActivity('updated', before, after, NOW);

    expect(draft.action).toBe(ACTIVITY_ACTIONS.applicationWindowUpdated);
    expect(draft.entityType).toBe('application_window');
    expect(draft.metadata).toEqual({
      application_key: 'house_fall',
      previous: { state: 'disabled', enabled: false, open_at: '2026-10-05T07:00:00Z', due_at: '2026-10-09T06:59:00Z' },
      next: { state: 'open', enabled: true, open_at: '2026-09-25T07:00:00Z', due_at: '2026-10-09T06:59:00Z' },
      urlChanged: false,
    });
    expect(JSON.stringify(draft)).not.toContain('forms.gle');
    expect(draft.summary).toBe('Updated application window "House Application — Fall": Disabled → Open; schedule Sep 25, 12:00 AM PT to Oct 8, 11:59 PM PT');
  });

  it('notes that the link changed without storing it', () => {
    const draft = applicationWindowActivity('updated', snapshot(), snapshot({ target_url: 'https://forms.gle/another' }), NOW);
    expect(draft.metadata).toMatchObject({ urlChanged: true });
    expect(draft.summary).toContain('form link changed');
    expect(JSON.stringify(draft)).not.toContain('forms.gle');
  });

  it('does not mistake PostgREST\'s "+00:00" timestamps for a schedule change', () => {
    const before = snapshot({ open_at: '2026-10-05T07:00:00+00:00', due_at: '2026-10-09T06:59:00+00:00' });
    const draft = applicationWindowActivity('updated', before, snapshot({ title: 'Renamed' }), NOW);
    expect(draft.summary).toContain('copy edited');
    expect(draft.summary).not.toContain('schedule');
  });

  it('calls a copy-only edit a copy edit', () => {
    const draft = applicationWindowActivity('updated', snapshot(), snapshot({ title: 'House Fall' }), NOW);
    expect(draft.summary).toContain('copy edited');
  });

  it('describes created, toggled, and deleted windows', () => {
    expect(applicationWindowActivity('created', null, snapshot({ is_enabled: false }), NOW)).toMatchObject({
      action: ACTIVITY_ACTIONS.applicationWindowCreated,
      metadata: { previous: null, next: { state: 'disabled' } },
    });
    expect(applicationWindowActivity('toggled', snapshot({ is_enabled: false }), snapshot(), NOW)).toMatchObject({
      action: ACTIVITY_ACTIONS.applicationWindowToggled,
      summary: expect.stringContaining('Disabled → Scheduled'),
    });
    expect(applicationWindowActivity('deleted', snapshot(), null, NOW)).toMatchObject({
      action: ACTIVITY_ACTIONS.applicationWindowDeleted,
      metadata: { previous: { state: 'scheduled' }, next: null },
    });
  });

  it('survives the log\'s metadata sanitizer intact', () => {
    const draft = applicationWindowActivity('updated', snapshot({ is_enabled: false }), snapshot(), NOW);
    expect(sanitizeMetadata(draft.metadata)).toEqual(draft.metadata);
  });
});
